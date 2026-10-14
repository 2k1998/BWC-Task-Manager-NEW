"""User-scoped REST adapter with bounded authentication recovery."""
import asyncio
import re
from typing import Any

import httpx

from .config import Settings
from .session import Session, SessionError, SessionStore


class APIError(RuntimeError):
    """Safe errors: never include HTTP representations or response bodies."""
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class BwcClient:
    def __init__(self, settings: Settings, *, http_client: httpx.AsyncClient | None = None):
        self.settings = settings
        self.store = SessionStore(settings)
        self._http = http_client or httpx.AsyncClient(timeout=30, follow_redirects=False)
        self._owns_http = http_client is None
        self._refresh_lock = asyncio.Lock()

    def _load(self) -> Session:
        try:
            return self.store.load()
        except SessionError as error:
            raise APIError(str(error)) from None

    async def _send(self, method: str, path: str, token: str, **kwargs: Any) -> httpx.Response:
        try:
            return await self._http.request(method, self.settings.api_url + path,
                headers={'Authorization': 'Bearer ' + token}, follow_redirects=False, **kwargs)
        except httpx.HTTPError:
            raise APIError('BWC API connection failed; operation was not automatically retried') from None

    async def _refresh(self, expired_token: str) -> Session:
        async with self._refresh_lock:
            current = self._load()
            if current.access_token != expired_token:
                return current
            response = await self._send('POST', '/auth/refresh', current.access_token,
                                        json={'refresh_token': current.refresh_token})
            if response.status_code != 200:
                raise APIError('Session refresh failed; run bwc-mcp-login', response.status_code)
            try:
                payload = response.json()
                session = Session(self.settings.api_origin, payload['access_token'], payload['refresh_token'])
                self.store.save(session)
            except (ValueError, KeyError, TypeError):
                raise APIError('Cannot persist refreshed session; run bwc-mcp-login') from None
            return session

    async def request(self, method: str, path: str, *, params: dict | None = None,
                      json: dict | None = None) -> dict | list:
        method = method.upper()
        if method not in {'GET', 'POST', 'PUT', 'DELETE', 'PATCH'} or not re.fullmatch(r'/[A-Za-z0-9_/-]+', path) or '..' in path or '//' in path:
            raise APIError('Invalid API operation')
        if path.startswith('/auth/') and (method != 'GET' or path not in {'/auth/me', '/auth/me/module-permissions'}):
            raise APIError('Authentication endpoints are not exposed as tools')
        session = self._load()
        response = await self._send(method, path, session.access_token, params=params, json=json)
        if response.status_code == 401:
            session = await self._refresh(session.access_token)
            response = await self._send(method, path, session.access_token, params=params, json=json)
        if not 200 <= response.status_code < 300:
            messages = {401: 'Session expired; run bwc-mcp-login', 403: 'You do not have permission for this operation',
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

    close = aclose

    async def __aenter__(self) -> 'BwcClient':
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.aclose()
