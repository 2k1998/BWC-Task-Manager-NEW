"""Hosted login consent and discovery routes are tested without public network."""
import html
import re
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest

from bwc_mcp.oauth import OAuthProvider
from bwc_mcp.remote import create_app
from test_oauth import CHALLENGE, REDIRECT, hosted_settings, register, upstream_handler


async def login_form(http, settings, client_id):
    response = await http.get('/authorize', params={'client_id': client_id, 'redirect_uri': REDIRECT,
        'response_type': 'code', 'code_challenge': CHALLENGE, 'code_challenge_method': 'S256',
        'state': 'synthetic-state', 'scope': 'bwc', 'resource': settings.resource_url})
    assert response.status_code in (302, 303, 307), response.text
    login = await http.get(response.headers['location'])
    assert login.status_code == 200, login.text
    fields = {}
    for tag in re.findall(r'<input\b[^>]*>', login.text):
        attributes = dict(re.findall(r'([\w-]+)=[\'"]([^\'"]*)[\'"]', tag))
        if attributes.get('name') in {'request', 'csrf'}:
            fields[attributes['name']] = html.unescape(attributes.get('value', ''))
    assert set(fields) == {'request', 'csrf'}
    return fields, login


@pytest.mark.asyncio
async def test_discovery_unauthenticated_mcp_and_csrf_browser_binding(tmp_path, monkeypatch):
    settings = hosted_settings(tmp_path, monkeypatch)
    calls = []
    upstream = httpx.AsyncClient(transport=httpx.MockTransport(upstream_handler(calls)))
    provider = OAuthProvider(settings, http_client=upstream)
    app = create_app(settings, provider=provider)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=settings.issuer_url) as http:
            metadata = await http.get('/.well-known/oauth-authorization-server')
            assert metadata.status_code == 200
            assert metadata.json()['issuer'].rstrip('/') == settings.issuer_url.rstrip('/')
            assert 'S256' in metadata.json()['code_challenge_methods_supported']
            resource = await http.get('/.well-known/oauth-protected-resource/mcp')
            assert resource.status_code == 200
            assert resource.json()['resource'] == settings.resource_url
            denied = await http.post('/mcp', json={'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {}})
            assert denied.status_code == 401
            assert 'resource_metadata=' in denied.headers['www-authenticate']
            client_id = await register(http)
            fields, login = await login_form(http, settings, client_id)
            assert login.headers['referrer-policy'] == 'same-origin'
            assert 'synthetic-upstream' not in login.text
            cookie = login.headers.get('set-cookie', '').lower()
            assert 'httponly' in cookie and 'samesite=lax' in cookie
            form = {**fields, 'username': 'alice', 'password': 'synthetic-password', 'approve': 'yes'}
            bad_csrf = await http.post('/login', data={**form, 'csrf': 'incorrect'})
            assert bad_csrf.status_code in (400, 403)
            assert not calls
            no_consent = await http.post('/login', data={**form, 'approve': 'no'})
            assert no_consent.status_code in (400, 403)
            foreign_origin = await http.post('/login', data=form, headers={'Origin': 'https://attacker.example.test'})
            assert foreign_origin.status_code == 403
            assert foreign_origin.headers['referrer-policy'] == 'no-referrer'
            null_origin = await http.post('/login', data=form, headers={'Origin': 'null'})
            assert null_origin.status_code == 403
            assert null_origin.headers['referrer-policy'] == 'no-referrer'
            assert not calls
            # The same hidden fields cannot be submitted from a different browser.
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=settings.issuer_url) as outsider:
                no_cookie = await outsider.post('/login', data=form)
                assert no_cookie.status_code in (400, 403)
            assert not calls
            # Another login request's cookie must not authorize the original form.
            saved_cookies = httpx.Cookies(http.cookies)
            other_fields, _ = await login_form(http, settings, client_id)
            swapped = await http.post('/login', data=form)
            assert swapped.status_code in (400, 403)
            assert not calls
            http.cookies = saved_cookies
            success = await http.post('/login', data=form, headers={'Origin': settings.issuer_url})
            assert success.status_code in (302, 303), success.text
            assert success.headers['referrer-policy'] == 'no-referrer'
            assert success.headers['location'].startswith(REDIRECT)
            query = parse_qs(urlsplit(success.headers['location']).query)
            assert query['state'] == ['synthetic-state'] and query['code']
            assert 'synthetic-password' not in success.text + success.headers['location']
            replay = await http.post('/login', data=form)
            assert replay.status_code in (400, 403)


@pytest.mark.asyncio
async def test_remote_token_endpoint_rejects_wrong_resource_before_exchange(tmp_path, monkeypatch):
    settings = hosted_settings(tmp_path, monkeypatch)
    provider = OAuthProvider(settings, http_client=httpx.AsyncClient(transport=httpx.MockTransport(upstream_handler([]))))
    app = create_app(settings, provider=provider)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=settings.issuer_url) as http:
            response = await http.post('/token', data={'grant_type': 'authorization_code', 'client_id': 'synthetic-client',
                'code': 'synthetic-code', 'code_verifier': 'synthetic-verifier', 'resource': 'https://attacker.example.test/mcp'})
            assert response.status_code == 400
            assert response.json()['error'] == 'invalid_target'


@pytest.mark.asyncio
async def test_mcp_protocol_initialize_list_and_call_use_consented_identity(tmp_path, monkeypatch):
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client
    from test_oauth import VERIFIER

    settings = hosted_settings(tmp_path, monkeypatch)
    calls = []
    provider = OAuthProvider(settings, http_client=httpx.AsyncClient(transport=httpx.MockTransport(upstream_handler(calls))))
    app = create_app(settings, provider=provider)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=settings.issuer_url) as http:
            client_id = await register(http)
            fields, _ = await login_form(http, settings, client_id)
            consent = await http.post('/login', data={**fields, 'username': 'alice', 'password': 'synthetic-password', 'approve': 'yes'})
            assert consent.status_code in (302, 303), consent.text
            code = parse_qs(urlsplit(consent.headers['location']).query)['code'][0]
            wrong_resource = await http.post('/token', data={'grant_type': 'authorization_code', 'client_id': client_id,
                'code': code, 'code_verifier': VERIFIER, 'redirect_uri': REDIRECT, 'resource': 'https://attacker.example.test/mcp'})
            assert wrong_resource.status_code == 400
            assert wrong_resource.json()['error'] == 'invalid_target'
            response = await http.post('/token', data={'grant_type': 'authorization_code', 'client_id': client_id,
                'code': code, 'code_verifier': VERIFIER, 'redirect_uri': REDIRECT, 'resource': settings.resource_url})
            assert response.status_code == 200, response.text
            token = response.json()['access_token']
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
            headers={'Authorization': f'Bearer {token}'}) as mcp_http, streamable_http_client(
            settings.resource_url, http_client=mcp_http) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools = await session.list_tools()
                assert {'who_am_i', 'list_tasks', 'create_task', 'update_task', 'create_user'} <= {tool.name for tool in tools.tools}
                result = await session.call_tool('who_am_i', {})
                assert not result.isError, result.model_dump()
                assert 'alice' in str(result)
                tasks = await session.call_tool('list_tasks', {})
                assert not tasks.isError, tasks.model_dump()
                assert any(path == '/tasks' and auth == 'Bearer synthetic-upstream-alice' for _, path, _, auth in calls)
                assert 'synthetic-upstream-alice' not in str(result)
                created = await session.call_tool('create_task', {
                    'title': 'Created through protocol', 'company_id': '22222222-2222-4333-8444-555555555555',
                    'department': 'Operations', 'start_date': '2026-11-01', 'deadline': '2026-12-01',
                    'urgency_label': 'Important', 'assigned_user_id': 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
                })
                assert not created.isError, created.model_dump()
                task_id = '11111111-2222-4333-8444-555555555555'
                updated = await session.call_tool('update_task', {'task_id': task_id, 'deadline': '2026-12-15'})
                assert not updated.isError, updated.model_dump()
                assert ('PUT', f'/tasks/{task_id}', {'deadline': '2026-12-15'}, 'Bearer synthetic-upstream-alice') in calls
                before = len(calls)
                invalid = await session.call_tool('update_task', {'task_id': task_id, 'deadline': 'invalid-date'})
                assert invalid.isError
                assert len(calls) == before
                forbidden = await session.call_tool('list_departments', {})
                assert forbidden.isError
                assert 'synthetic backend-private-details' not in str(forbidden)

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=settings.issuer_url) as http:
            revoked = await http.post('/revoke', data={'client_id': client_id, 'token': token})
            assert revoked.status_code == 200
            assert await provider.load_access_token(token) is None


@pytest.mark.asyncio
async def test_canonical_host_blocks_discovery_but_allows_hosting_health_probe(tmp_path, monkeypatch):
    settings = hosted_settings(tmp_path, monkeypatch)
    provider = OAuthProvider(settings, http_client=httpx.AsyncClient(transport=httpx.MockTransport(upstream_handler([]))))
    app = create_app(settings, provider=provider)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://untrusted.example.test') as http:
            metadata = await http.get('/.well-known/oauth-authorization-server')
            assert metadata.status_code == 400
            health = await http.get('/health')
            assert health.status_code == 200
            assert health.json() == {'status': 'healthy'}
            assert (await http.post('/health')).status_code == 400


@pytest.mark.asyncio
async def test_registration_limit_returns_retry_after_and_recovers_after_window(tmp_path, monkeypatch):
    settings = hosted_settings(tmp_path, monkeypatch)
    provider = OAuthProvider(settings, http_client=httpx.AsyncClient(transport=httpx.MockTransport(upstream_handler([]))))
    app = create_app(settings, provider=provider)
    import bwc_mcp.remote as remote
    clock = [1000.0]
    # Patch only the limiter's view of time; leave asyncio's monotonic clock intact.
    class Clock:
        @staticmethod
        def monotonic():
            return clock[0]
    monkeypatch.setattr(remote, 'time', Clock)
    payload = {'redirect_uris': [REDIRECT], 'token_endpoint_auth_method': 'none',
        'grant_types': ['authorization_code', 'refresh_token'], 'scope': 'bwc'}
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=settings.issuer_url) as http:
            for _ in range(30):
                assert (await http.post('/register', json=payload)).status_code == 201
            limited = await http.post('/register', json=payload)
            assert limited.status_code == 429
            assert limited.headers['retry-after'] == '60'
            assert limited.json()['error'] == 'temporarily_unavailable'
            clock[0] += 61
            assert (await http.post('/register', json=payload)).status_code == 201
