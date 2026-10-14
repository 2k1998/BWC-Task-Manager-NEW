"""OAuth broker for individual BWC accounts; upstream sessions never leave it."""
import asyncio
import ipaddress
import re
import secrets
import time
from urllib.parse import urlencode, urlsplit

import httpx
from mcp.server.auth.provider import (
    AccessToken, AuthorizationCode, AuthorizationParams, AuthorizeError,
    RefreshToken, RegistrationError, TokenError, construct_redirect_uri,
)
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken

from .client import APIError
from .oauth_store import OAuthStore, token_hash


class BwcAccessToken(AccessToken):
    grant_id: str
    user_id: str


class BwcRefreshToken(RefreshToken):
    grant_id: str
    resource: str


class BwcAuthorizationCode(AuthorizationCode):
    grant_id: str


class OAuthProvider:
    """Single-process/single-worker provider with durable encrypted state."""
    def __init__(self, settings, *, http_client: httpx.AsyncClient | None = None):
        self.settings = settings
        self.store = OAuthStore(settings.database_path, settings.encryption_key)
        self._http = http_client or httpx.AsyncClient(timeout=30, follow_redirects=False)
        self._owns_http = http_client is None
        self._grant_locks: dict[str, asyncio.Lock] = {}

    async def get_client(self, client_id: str) -> OAuthClientInformationFull | None:
        with self.store.transaction() as db:
            payload = self.store.get(db, 'client', client_id)
        return OAuthClientInformationFull.model_validate(payload) if payload else None

    async def register_client(self, client_info: OAuthClientInformationFull) -> None:
        if (not client_info.client_id or client_info.token_endpoint_auth_method not in
                {'none', 'client_secret_post', 'client_secret_basic'} or
                set(client_info.grant_types) != {'authorization_code', 'refresh_token'} or
                client_info.response_types != ['code']):
            raise RegistrationError('invalid_client_metadata', 'Unsupported client metadata')
        if client_info.scope and not set(client_info.scope.split()).issubset({'bwc'}):
            raise RegistrationError('invalid_client_metadata', 'Unsupported scope')
        for redirect in client_info.redirect_uris or []:
            try:
                url = urlsplit(str(redirect))
                host = url.hostname
                port = url.port
                try:
                    loopback = ipaddress.ip_address(host or '').is_loopback
                except ValueError:
                    loopback = host == 'localhost'
                if (not host or url.username is not None or url.password is not None or '#' in str(redirect)
                    or (url.scheme != 'https' and not (url.scheme == 'http' and loopback))
                    or (port is not None and not 1 <= port <= 65535)):
                    raise ValueError
            except ValueError:
                raise RegistrationError('invalid_redirect_uri', 'Redirect must use HTTPS or loopback HTTP') from None
        if not client_info.redirect_uris:
            raise RegistrationError('invalid_redirect_uri', 'At least one redirect is required')
        with self.store.transaction() as db:
            if self.store.get(db, 'client', client_info.client_id):
                raise RegistrationError('invalid_client_metadata', 'Client is already registered')
            self.store.put(db, 'client', client_info.client_id, client_info.model_dump(mode='json'))

    async def authorize(self, client: OAuthClientInformationFull, params: AuthorizationParams) -> str:
        if params.resource is not None and params.resource != self.settings.resource_url:
            raise AuthorizeError('invalid_request', 'Unsupported resource')
        scopes = params.scopes or ['bwc']
        if not set(scopes).issubset({'bwc'}):
            raise AuthorizeError('invalid_scope', 'Unsupported scope')
        if str(params.redirect_uri) not in [str(value) for value in client.redirect_uris or []]:
            raise AuthorizeError('invalid_request', 'Unregistered redirect')
        if not re.fullmatch(r'[A-Za-z0-9_-]{43}', params.code_challenge):
            raise AuthorizeError('invalid_request', 'A valid S256 PKCE challenge is required')
        nonce = secrets.token_urlsafe(32)
        payload = params.model_dump(mode='json')
        payload.update(client_id=client.client_id, client_name=client.client_name or 'MCP client',
                       resource=self.settings.resource_url, scopes=scopes)
        with self.store.transaction() as db:
            self.store.put(db, 'pending', token_hash(nonce), payload, expires=time.time() + 600)
        return self.settings.issuer_url.rstrip('/') + '/login?' + urlencode({'request': nonce})

    def pending(self, nonce: str) -> dict | None:
        if not isinstance(nonce, str) or len(nonce) > 256:
            return None
        with self.store.transaction() as db:
            return self.store.get(db, 'pending', token_hash(nonce))

    async def _upstream(self, method: str, path: str, *, token: str | None = None, **kwargs) -> httpx.Response:
        headers = {'Authorization': 'Bearer ' + token} if token else {}
        try:
            return await self._http.request(method, self.settings.api_url + path, headers=headers,
                                           follow_redirects=False, **kwargs)
        except httpx.HTTPError:
            raise APIError('BWC API connection failed; operation was not automatically retried') from None

    @staticmethod
    def _tokens(response: httpx.Response) -> dict:
        try:
            payload = response.json()
            tokens = {key: payload[key] for key in ('access_token', 'refresh_token')}
            if not all(isinstance(value, str) and value and not any(ch.isspace() for ch in value)
                       for value in tokens.values()):
                raise ValueError
            return tokens
        except (ValueError, KeyError, TypeError):
            raise APIError('BWC API returned invalid authentication data') from None

    async def complete_login(self, nonce: str, username: str, password: str) -> str:
        pending = self.pending(nonce)
        if pending is None:
            raise APIError('Authorization request expired; reconnect your MCP client')
        response = await self._upstream('POST', '/auth/login', json={'username_or_email': username, 'password': password})
        if response.status_code != 200:
            raise APIError('Sign-in failed; check your account credentials and access', response.status_code)
        credentials = self._tokens(response)
        profile = await self._upstream('GET', '/auth/me', token=credentials['access_token'])
        if profile.status_code != 200:
            raise APIError('Could not verify your BWC account', profile.status_code)
        try:
            user = profile.json()
            if not isinstance(user, dict) or not user.get('id') or user.get('is_active') is not True:
                raise ValueError
        except ValueError:
            raise APIError('Your BWC account could not be verified') from None
        code = secrets.token_urlsafe(32)
        grant_id = secrets.token_urlsafe(24)
        with self.store.transaction() as db:
            current = self.store.get(db, 'pending', token_hash(nonce))
            if current is None:
                raise APIError('Authorization request expired; reconnect your MCP client')
            self.store.delete(db, 'pending', token_hash(nonce))
            self.store.put(db, 'grant', grant_id,
                           {'user_id': str(user['id']), 'credentials': credentials,
                            'api_url': self.settings.api_url}, grant_id=grant_id)
            code_data = {key: current[key] for key in
                         ('scopes', 'client_id', 'code_challenge', 'redirect_uri',
                          'redirect_uri_provided_explicitly', 'resource')}
            code_data.update(grant_id=grant_id, expires_at=time.time() + 300)
            self.store.put(db, 'code', token_hash(code), code_data,
                           expires=code_data['expires_at'], client_id=current['client_id'],
                           grant_id=grant_id, resource=self.settings.resource_url)
        return construct_redirect_uri(current['redirect_uri'], code=code, state=current.get('state'))

    async def load_authorization_code(self, client: OAuthClientInformationFull, authorization_code: str) -> BwcAuthorizationCode | None:
        with self.store.transaction() as db:
            payload = self.store.get(db, 'code', token_hash(authorization_code))
            if not payload or payload['client_id'] != client.client_id or payload['resource'] != self.settings.resource_url:
                return None
            if not self.store.get(db, 'grant', payload['grant_id']):
                return None
        return BwcAuthorizationCode(code=authorization_code, **payload)

    def _issue(self, db, client_id: str, grant_id: str, scopes: list[str]) -> OAuthToken:
        access = secrets.token_urlsafe(32)
        refresh = secrets.token_urlsafe(32)
        now = int(time.time())
        grant = self.store.get(db, 'grant', grant_id)
        if not grant or grant['api_url'] != self.settings.api_url:
            raise TokenError('invalid_grant', 'Account connection is unavailable')
        common = {'client_id': client_id, 'grant_id': grant_id,
                  'scopes': scopes, 'resource': self.settings.resource_url}
        self.store.put(db, 'access', token_hash(access), {**common, 'user_id': grant['user_id'], 'expires_at': now + 900},
                       expires=now + 900, client_id=client_id, grant_id=grant_id, resource=self.settings.resource_url)
        self.store.put(db, 'refresh', token_hash(refresh), {**common, 'expires_at': now + 604800},
                       expires=now + 604800, client_id=client_id, grant_id=grant_id, resource=self.settings.resource_url)
        return OAuthToken(access_token=access, refresh_token=refresh, expires_in=900, scope=' '.join(scopes))

    async def exchange_authorization_code(self, client: OAuthClientInformationFull, authorization_code: AuthorizationCode) -> OAuthToken:
        with self.store.transaction() as db:
            payload = self.store.get(db, 'code', token_hash(authorization_code.code))
            if not payload or payload['client_id'] != client.client_id or payload['resource'] != self.settings.resource_url:
                raise TokenError('invalid_grant', 'Authorization code is unavailable')
            self.store.delete(db, 'code', token_hash(authorization_code.code))
            return self._issue(db, payload['client_id'], payload['grant_id'], payload['scopes'])

    async def load_refresh_token(self, client: OAuthClientInformationFull, refresh_token: str) -> BwcRefreshToken | None:
        with self.store.transaction() as db:
            payload = self.store.get(db, 'refresh', token_hash(refresh_token))
            if not payload or payload['client_id'] != client.client_id or payload['resource'] != self.settings.resource_url:
                return None
            if not self.store.get(db, 'grant', payload['grant_id']):
                return None
        return BwcRefreshToken(token=refresh_token, **payload)

    async def exchange_refresh_token(self, client: OAuthClientInformationFull, refresh_token: RefreshToken, scopes: list[str]) -> OAuthToken:
        with self.store.transaction() as db:
            payload = self.store.get(db, 'refresh', token_hash(refresh_token.token))
            if not payload or payload['client_id'] != client.client_id or payload['resource'] != self.settings.resource_url:
                raise TokenError('invalid_grant', 'Refresh token is unavailable')
            if not set(scopes).issubset(payload['scopes']):
                raise TokenError('invalid_scope', 'Scope cannot be expanded')
            # Revoke the preceding access/refresh pair, preserving only upstream account state.
            db.execute("DELETE FROM records WHERE grant_id=? AND kind IN ('access','refresh')", (payload['grant_id'],))
            return self._issue(db, payload['client_id'], payload['grant_id'], scopes)

    async def load_access_token(self, token: str) -> BwcAccessToken | None:
        with self.store.transaction() as db:
            payload = self.store.get(db, 'access', token_hash(token))
            if not payload or payload['resource'] != self.settings.resource_url:
                return None
            grant = self.store.get(db, 'grant', payload['grant_id'])
            if not grant or grant['api_url'] != self.settings.api_url:
                return None
        return BwcAccessToken(token=token, **payload)

    async def revoke_token(self, token: AccessToken | RefreshToken) -> None:
        kind = 'access' if isinstance(token, AccessToken) else 'refresh'
        with self.store.transaction() as db:
            payload = self.store.get(db, kind, token_hash(token.token))
            if payload and payload['client_id'] == token.client_id:
                self.store.revoke_grant(db, payload['grant_id'])

    def _grant(self, grant_id: str) -> dict:
        with self.store.transaction() as db:
            grant = self.store.get(db, 'grant', grant_id)
        if not grant or grant['api_url'] != self.settings.api_url:
            raise APIError('Account connection is unavailable; reconnect your MCP client', 401)
        return grant

    async def _refresh_upstream(self, grant_id: str, expired: str) -> dict:
        lock = self._grant_locks.setdefault(grant_id, asyncio.Lock())
        async with lock:
            grant = self._grant(grant_id)
            if grant['credentials']['access_token'] != expired:
                return grant['credentials']
            response = await self._upstream('POST', '/auth/refresh', token=expired,
                                           json={'refresh_token': grant['credentials']['refresh_token']})
            if response.status_code != 200:
                if response.status_code in (401, 403):
                    with self.store.transaction() as db:
                        self.store.revoke_grant(db, grant_id)
                raise APIError('Account session could not be refreshed; reconnect your MCP client', response.status_code)
            credentials = self._tokens(response)
            with self.store.transaction() as db:
                current = self.store.get(db, 'grant', grant_id)
                if not current:
                    raise APIError('Account connection has been revoked', 401)
                current['credentials'] = credentials
                self.store.put(db, 'grant', grant_id, current, grant_id=grant_id)
            return credentials

    async def request_for_token(self, token: str, method: str, path: str, *, params: dict | None = None,
                                json: dict | None = None) -> dict | list:
        method = method.upper()
        if method not in {'GET', 'POST', 'PUT', 'DELETE', 'PATCH'} or not re.fullmatch(r'/[A-Za-z0-9_/-]+', path) or '//' in path or '..' in path:
            raise APIError('Invalid API operation')
        if path.startswith('/auth/') and (method != 'GET' or path not in {'/auth/me', '/auth/me/module-permissions'}):
            raise APIError('Authentication endpoints are not exposed as tools')
        account = await self.load_access_token(token)
        if account is None or 'bwc' not in account.scopes:
            raise APIError('MCP authorization expired; reconnect your client', 401)
        credentials = self._grant(account.grant_id)['credentials']
        response = await self._upstream(method, path, token=credentials['access_token'], params=params, json=json)
        if response.status_code == 401:
            credentials = await self._refresh_upstream(account.grant_id, credentials['access_token'])
            # Recheck revocation and MCP token validity after asynchronous refresh.
            if await self.load_access_token(token) is None:
                raise APIError('MCP authorization expired; reconnect your client', 401)
            response = await self._upstream(method, path, token=credentials['access_token'], params=params, json=json)
        if not 200 <= response.status_code < 300:
            messages = {401: 'Account session expired; reconnect your client', 403: 'You do not have permission for this operation',
                        404: 'Requested resource was not found', 422: 'BWC API rejected the supplied fields',
                        429: 'BWC API rate limit reached; try again later'}
            raise APIError(messages.get(response.status_code, 'BWC API rejected the operation'), response.status_code)
        if response.status_code == 204:
            return {}
        try:
            result = response.json()
            if not isinstance(result, (dict, list)):
                raise ValueError
            return result
        except ValueError:
            raise APIError('BWC API returned an invalid response') from None

    async def aclose(self) -> None:
        if self._owns_http:
            await self._http.aclose()
