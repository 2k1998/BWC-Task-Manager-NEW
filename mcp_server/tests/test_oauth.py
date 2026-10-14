"""OAuth grants belong to the consenting BWC user and the MCP resource."""
import base64
import hashlib
import json
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from cryptography.fernet import Fernet
from pydantic import AnyHttpUrl
from starlette.applications import Starlette
from mcp.server.auth.routes import create_auth_routes
from mcp.server.auth.settings import ClientRegistrationOptions, RevocationOptions

from bwc_mcp.config import HostedSettings
from bwc_mcp.oauth import OAuthProvider

VERIFIER = 'synthetic-pkce-verifier-with-at-least-43-characters-long'
CHALLENGE = base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest()).decode().rstrip('=')
REDIRECT = 'https://client.example.test/callback'


def hosted_settings(tmp_path, monkeypatch):
    monkeypatch.setenv('BWC_API_URL', 'http://127.0.0.1:8000')
    monkeypatch.setenv('BWC_MCP_ISSUER_URL', 'http://127.0.0.1:8787')
    monkeypatch.setenv('BWC_MCP_DATABASE_PATH', str(tmp_path / 'private' / 'oauth.sqlite'))
    monkeypatch.setenv('BWC_MCP_ENCRYPTION_KEY', Fernet.generate_key().decode())
    return HostedSettings.from_env()


def upstream_handler(calls):
    async def handler(request):
        body = json.loads(request.content or b'{}')
        auth = request.headers.get('authorization')
        calls.append((request.method, request.url.path, body, auth))
        if request.url.path == '/auth/login':
            user = body['username_or_email']
            return httpx.Response(200, json={'access_token': f'synthetic-upstream-{user}', 'refresh_token': f'synthetic-refresh-{user}'})
        if request.url.path == '/auth/me/module-permissions':
            return httpx.Response(200, json={'permissions': {'tasks': 'edit', 'companies': 'view'}})
        if request.url.path == '/auth/me':
            user = (auth or '').removeprefix('Bearer synthetic-upstream-')
            return httpx.Response(200, json={'id': user, 'username': user, 'user_type': 'Agent', 'is_active': True})
        if request.url.path.startswith('/tasks') and request.method in {'POST', 'PUT'}:
            return httpx.Response(200, json={'id': '11111111-2222-4333-8444-555555555555', **body})
        if request.url.path == '/tasks':
            return httpx.Response(200, json={'tasks': [{'title': auth}], 'total': 1})
        return httpx.Response(403, json={'detail': 'synthetic backend-private-details'})
    return handler


def auth_app(provider, settings):
    return Starlette(routes=create_auth_routes(provider, AnyHttpUrl(settings.issuer_url),
        client_registration_options=ClientRegistrationOptions(enabled=True, valid_scopes=['bwc'], default_scopes=['bwc']),
        revocation_options=RevocationOptions(enabled=True)))


async def register(http):
    response = await http.post('/register', json={'redirect_uris': [REDIRECT], 'client_name': 'Synthetic client',
        'token_endpoint_auth_method': 'none', 'grant_types': ['authorization_code', 'refresh_token'], 'scope': 'bwc'})
    assert response.status_code in (200, 201), response.text
    return response.json()['client_id']


async def authorize(http, provider, settings, client_id, user='alice', resource=None):
    response = await http.get('/authorize', params={'client_id': client_id, 'redirect_uri': REDIRECT,
        'response_type': 'code', 'code_challenge': CHALLENGE, 'code_challenge_method': 'S256',
        'state': 'synthetic-client-state', 'scope': 'bwc', 'resource': resource or settings.resource_url})
    assert response.status_code in (302, 303, 307), response.text
    location = response.headers['location']
    query = parse_qs(urlsplit(location).query)
    nonce = (query.get('request') or query.get('nonce'))[0]
    redirect = await provider.complete_login(nonce, user, 'synthetic-password-never-persisted')
    completed = parse_qs(urlsplit(redirect).query)
    assert completed['state'] == ['synthetic-client-state']
    assert 'synthetic-password' not in redirect
    return completed['code'][0]


async def exchange(http, settings, client_id, code, verifier=VERIFIER, resource=None):
    return await http.post('/token', data={'grant_type': 'authorization_code', 'client_id': client_id,
        'code': code, 'code_verifier': verifier, 'redirect_uri': REDIRECT,
        'resource': resource or settings.resource_url})


@pytest.mark.asyncio
async def test_pkce_code_replay_client_binding_and_encrypted_persistence(tmp_path, monkeypatch):
    settings = hosted_settings(tmp_path, monkeypatch)
    calls = []
    upstream = httpx.AsyncClient(transport=httpx.MockTransport(upstream_handler(calls)))
    provider = OAuthProvider(settings, http_client=upstream)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app(provider, settings)), base_url=settings.issuer_url) as http:
        client_id = await register(http)
        other_client = await register(http)
        code = await authorize(http, provider, settings, client_id)
        assert (await exchange(http, settings, other_client, code)).status_code == 400
        assert (await exchange(http, settings, client_id, code, verifier='wrong-verifier')).status_code == 400
        response = await exchange(http, settings, client_id, code)
        assert response.status_code == 200, response.text
        token = response.json()['access_token']
        assert token != 'synthetic-upstream-alice'
        assert (await exchange(http, settings, client_id, code)).status_code == 400
        tasks = await provider.request_for_token(token, 'GET', '/tasks')
        assert tasks['tasks'][0]['title'] == 'Bearer synthetic-upstream-alice'
        second = OAuthProvider(settings, http_client=upstream)
        assert (await second.load_access_token(token)) is not None
        from dataclasses import replace
        another_resource = OAuthProvider(replace(settings, issuer_url='http://127.0.0.1:9898'), http_client=upstream)
        assert await another_resource.load_access_token(token) is None
        another_backend = OAuthProvider(replace(settings, api_url='http://127.0.0.1:9999'), http_client=upstream)
        assert await another_backend.load_access_token(token) is None
        await another_resource.aclose()
        await another_backend.aclose()
        await second.aclose()
    raw = settings.database_path.read_bytes()
    for secret in [b'synthetic-upstream-alice', b'synthetic-refresh-alice', b'synthetic-password-never-persisted', token.encode(), code.encode()]:
        assert secret not in raw
    assert settings.database_path.stat().st_mode & 0o777 == 0o600
    await provider.aclose()


@pytest.mark.asyncio
async def test_per_user_upstream_credentials_refresh_rotation_and_revocation(tmp_path, monkeypatch):
    settings = hosted_settings(tmp_path, monkeypatch)
    calls = []
    upstream = httpx.AsyncClient(transport=httpx.MockTransport(upstream_handler(calls)))
    provider = OAuthProvider(settings, http_client=upstream)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app(provider, settings)), base_url=settings.issuer_url) as http:
        client_id = await register(http)
        tokens = []
        for user in ['alice', 'bob']:
            code = await authorize(http, provider, settings, client_id, user)
            response = await exchange(http, settings, client_id, code)
            assert response.status_code == 200, response.text
            tokens.append(response.json())
        for user, token in zip(['alice', 'bob'], tokens):
            result = await provider.request_for_token(token['access_token'], 'GET', '/tasks')
            assert result['tasks'][0]['title'] == f'Bearer synthetic-upstream-{user}'
        refresh = tokens[0]['refresh_token']
        rotated = await http.post('/token', data={'grant_type': 'refresh_token', 'client_id': client_id,
            'refresh_token': refresh, 'resource': settings.resource_url})
        assert rotated.status_code == 200, rotated.text
        assert rotated.json()['refresh_token'] != refresh
        assert (await http.post('/token', data={'grant_type': 'refresh_token', 'client_id': client_id,
            'refresh_token': refresh, 'resource': settings.resource_url})).status_code == 400
        response = await http.post('/revoke', data={'client_id': client_id, 'client_secret': '', 'token': rotated.json()['access_token']})
        assert response.status_code == 200, response.text
        assert await provider.load_access_token(rotated.json()['access_token']) is None
        assert await provider.load_access_token(tokens[1]['access_token']) is not None
    await provider.aclose()


@pytest.mark.asyncio
async def test_authorization_rejects_wrong_resource_and_unregistered_redirect(tmp_path, monkeypatch):
    settings = hosted_settings(tmp_path, monkeypatch)
    upstream = httpx.AsyncClient(transport=httpx.MockTransport(upstream_handler([])))
    provider = OAuthProvider(settings, http_client=upstream)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app(provider, settings)), base_url=settings.issuer_url) as http:
        client_id = await register(http)
        params = {'client_id': client_id, 'redirect_uri': REDIRECT, 'response_type': 'code',
            'code_challenge': CHALLENGE, 'code_challenge_method': 'S256', 'scope': 'bwc',
            'resource': 'https://attacker.example.test/mcp'}
        wrong_resource = await http.get('/authorize', params=params)
        assert wrong_resource.status_code == 400 or 'error=' in wrong_resource.headers.get('location', '')
        params.update(resource=settings.resource_url, redirect_uri='https://attacker.example.test/callback')
        bad_redirect = await http.get('/authorize', params=params)
        assert bad_redirect.status_code == 400
        assert 'attacker.example.test/callback' not in bad_redirect.headers.get('location', '')
    await provider.aclose()


@pytest.mark.asyncio
async def test_upstream_refresh_is_serialized_for_the_consented_grant(tmp_path, monkeypatch):
    import asyncio
    settings = hosted_settings(tmp_path, monkeypatch)
    calls = []
    default = upstream_handler(calls)
    refreshing = []
    async def handler(request):
        if request.url.path == '/auth/refresh':
            refreshing.append(json.loads(request.content))
            await asyncio.sleep(0.02)
            return httpx.Response(200, json={'access_token': 'synthetic-upstream-rotated', 'refresh_token': 'synthetic-refresh-rotated'})
        if request.url.path == '/tasks':
            if request.headers['authorization'] == 'Bearer synthetic-upstream-alice':
                return httpx.Response(401, json={'detail': 'Expired'})
            assert request.headers['authorization'] == 'Bearer synthetic-upstream-rotated'
            return httpx.Response(200, json={'tasks': []})
        return await default(request)
    upstream = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = OAuthProvider(settings, http_client=upstream)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app(provider, settings)), base_url=settings.issuer_url) as http:
        client_id = await register(http)
        code = await authorize(http, provider, settings, client_id)
        token = (await exchange(http, settings, client_id, code)).json()['access_token']
    result = await asyncio.gather(*[provider.request_for_token(token, 'GET', '/tasks') for _ in range(5)])
    assert result == [{'tasks': []}] * 5
    assert refreshing == [{'refresh_token': 'synthetic-refresh-alice'}]
    await provider.aclose()


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', ['network', '500', '403'])
async def test_hosted_write_errors_are_safe_and_not_automatically_retried(tmp_path, monkeypatch, failure):
    from bwc_mcp.client import APIError
    settings = hosted_settings(tmp_path, monkeypatch)
    calls = []
    writes = []
    default = upstream_handler(calls)
    async def handler(request):
        if request.url.path.startswith('/tasks'):
            writes.append(request)
            if failure == 'network':
                raise httpx.ReadError('synthetic-internal-secret', request=request)
            return httpx.Response(int(failure), json={'detail': 'synthetic-internal-secret'})
        return await default(request)
    provider = OAuthProvider(settings, http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app(provider, settings)), base_url=settings.issuer_url) as http:
        client_id = await register(http)
        code = await authorize(http, provider, settings, client_id)
        token = (await exchange(http, settings, client_id, code)).json()['access_token']
    with pytest.raises(APIError) as caught:
        await provider.request_for_token(token, 'POST', '/tasks', json={'title': 'Synthetic'})
    assert len(writes) == 1
    assert 'synthetic-internal-secret' not in str(caught.value)
    if failure == '403':
        assert caught.value.status_code == 403
    await provider.aclose()


def test_store_cleanup_purges_expired_tokens_and_orphan_grants_only(tmp_path, monkeypatch):
    import time
    from bwc_mcp.oauth_store import OAuthStore
    settings = hosted_settings(tmp_path, monkeypatch)
    store = OAuthStore(settings.database_path, settings.encryption_key)
    with store.transaction() as db:
        store.put(db, 'client', 'keep-client', {'client_id': 'keep-client'})
        store.put(db, 'pending', 'expired-pending', {'request': 'stale'}, expires=time.time() - 1)
        store.put(db, 'grant', 'orphan', {'credentials': {'access_token': 'synthetic-orphan-secret'}}, grant_id='orphan')
        store.put(db, 'grant', 'expired-grant', {'credentials': {'access_token': 'synthetic-expired-secret'}}, grant_id='expired-grant')
        store.put(db, 'access', 'expired-token', {'token': 'stale'}, grant_id='expired-grant', expires=time.time() - 1)
        store.put(db, 'refresh', 'expired-refresh', {'token': 'stale'}, grant_id='expired-grant', expires=time.time() - 1)
        store.put(db, 'grant', 'live-grant', {'credentials': {'access_token': 'synthetic-live-secret'}}, grant_id='live-grant')
        store.put(db, 'refresh', 'live-refresh', {'token': 'live'}, grant_id='live-grant', expires=time.time() + 3600)
        store.put(db, 'grant', 'pending-code-grant', {'credentials': {'access_token': 'synthetic-new-secret'}}, grant_id='pending-code-grant')
        store.put(db, 'code', 'live-code', {'code': 'live'}, grant_id='pending-code-grant', expires=time.time() + 60)
    # Every subsequent transaction sweeps expired records and newly orphaned grants.
    with store.transaction() as db:
        remaining = {(row['kind'], row['key']) for row in db.execute('SELECT kind,key FROM records')}
    assert remaining == {('client', 'keep-client'), ('grant', 'live-grant'), ('refresh', 'live-refresh'),
                         ('grant', 'pending-code-grant'), ('code', 'live-code')}
