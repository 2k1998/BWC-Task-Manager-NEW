"""The cohost dispatcher preserves API behavior and owns both service lifetimes."""
from contextlib import asynccontextmanager

import httpx
import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route, WebSocketRoute
from starlette.testclient import TestClient

from bwc_mcp.combined import create_combined_app
from bwc_mcp.oauth import OAuthProvider
from bwc_mcp.remote import create_app
from test_oauth import hosted_settings, upstream_handler


def fake_app(name, events, *, fail_start=False, fail_stop=False):
    @asynccontextmanager
    async def lifespan(app):
        events.append(f'{name}:start')
        if fail_start:
            raise RuntimeError(f'{name} startup failed')
        try:
            yield
        finally:
            events.append(f'{name}:stop')
            if fail_stop:
                raise RuntimeError(f'{name} shutdown failed')
    async def endpoint(request: Request):
        body = (await request.body()).decode()
        return JSONResponse({'service': name, 'path': request.url.path,
                             'method': request.method, 'query': request.url.query, 'body': body})
    async def websocket(socket):
        await socket.accept()
        value = await socket.receive_text()
        await socket.send_json({'service': name, 'path': socket.url.path, 'message': value})
        await socket.close()
    return Starlette(routes=[Route('/{path:path}', endpoint, methods=['GET', 'POST', 'PUT', 'OPTIONS', 'HEAD']),
        WebSocketRoute('/{path:path}', websocket)], lifespan=lifespan)


@pytest.mark.asyncio
async def test_dispatcher_preserves_api_requests_and_both_lifespans():
    events = []
    app = create_combined_app(fake_app('api', events), fake_app('mcp', events))
    async with app.router.lifespan_context(app):
        assert events == ['api:start', 'mcp:start']
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://testserver') as client:
            for path in ['/health', '/', '/docs', '/openapi.json', '/auth/login', '/auth/refresh', '/tasks', '/companies', '/login/other']:
                response = await client.post(path + '?kept=1', content='synthetic-api-body')
                assert response.status_code == 200
                assert response.json() == {'service': 'api', 'path': path, 'method': 'POST',
                    'query': 'kept=1', 'body': 'synthetic-api-body'}
            health = await client.get('/health')
            assert health.status_code == 200
            assert health.json()['service'] == 'api'
            for path in ['/mcp', '/mcp/', '/authorize', '/token', '/register', '/revoke', '/login',
                '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource',
                '/.well-known/oauth-protected-resource/mcp']:
                response = await client.post(path + '?kept=1', content='synthetic-oauth-body')
                assert response.status_code == 200
                assert response.json()['service'] == 'mcp', path
                assert response.json()['query'] == 'kept=1'
                assert response.json()['body'] == 'synthetic-oauth-body'
    assert events == ['api:start', 'mcp:start', 'mcp:stop', 'api:stop']


@pytest.mark.asyncio
async def test_health_reports_unready_before_start_and_after_shutdown():
    app = create_combined_app(fake_app('api', []), fake_app('mcp', []))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://testserver') as client:
        assert (await client.get('/health')).status_code == 503
        assert (await client.head('/health')).status_code == 503
        async with app.router.lifespan_context(app):
            assert (await client.get('/health')).status_code == 200
        assert (await client.get('/health')).status_code == 503


@pytest.mark.asyncio
@pytest.mark.parametrize('failing', ['api', 'mcp'])
async def test_failed_service_startup_propagates_and_does_not_mark_healthy(failing):
    events = []
    app = create_combined_app(fake_app('api', events, fail_start=failing == 'api'),
                             fake_app('mcp', events, fail_start=failing == 'mcp'))
    with pytest.raises(RuntimeError, match=f'{failing} startup failed'):
        async with app.router.lifespan_context(app):
            pytest.fail('A failed startup must not yield a running application')
    assert events == (['api:start'] if failing == 'api' else ['api:start', 'mcp:start', 'api:stop'])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://testserver') as client:
        assert (await client.get('/health')).status_code == 503


@pytest.mark.asyncio
async def test_shutdown_error_still_closes_the_backend_and_clears_readiness():
    events = []
    app = create_combined_app(fake_app('api', events), fake_app('mcp', events, fail_stop=True))
    with pytest.raises(RuntimeError, match='mcp shutdown failed'):
        async with app.router.lifespan_context(app):
            pass
    assert events == ['api:start', 'mcp:start', 'mcp:stop', 'api:stop']
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://testserver') as client:
        assert (await client.get('/health')).status_code == 503


def test_websocket_traffic_is_preserved_on_the_backend():
    events = []
    app = create_combined_app(fake_app('api', events), fake_app('mcp', events))
    with TestClient(app) as client:
        for path in ['/presence/ws', '/chat/ws', '/mcp']:
            with client.websocket_connect(path) as socket:
                socket.send_text('synthetic message')
                assert socket.receive_json() == {'service': 'api', 'path': path, 'message': 'synthetic message'}
    assert events == ['api:start', 'mcp:start', 'mcp:stop', 'api:stop']


@pytest.mark.asyncio
async def test_actual_mcp_discovery_and_backend_auth_coexist(tmp_path, monkeypatch):
    settings = hosted_settings(tmp_path, monkeypatch)
    provider = OAuthProvider(settings, http_client=httpx.AsyncClient(transport=httpx.MockTransport(upstream_handler([]))))
    mcp = create_app(settings, provider=provider)
    events = []
    app = create_combined_app(fake_app('api', events), mcp)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=settings.issuer_url) as client:
            metadata = await client.get('/.well-known/oauth-authorization-server')
            assert metadata.status_code == 200
            assert metadata.json()['issuer'].rstrip('/') == settings.issuer_url
            resources = await client.get('/.well-known/oauth-protected-resource/mcp')
            assert resources.status_code == 200
            assert resources.json()['resource'] == settings.resource_url
            auth = await client.post('/auth/login', json={'username_or_email': 'synthetic', 'password': 'synthetic'})
            assert auth.json()['service'] == 'api'
            login = await client.get('/login')
            assert login.status_code == 400
            assert 'Authorization request expired' in login.text
            health = await client.get('/health')
            assert health.status_code == 200 and health.json()['service'] == 'api'
            denied = await client.post('/mcp', json={'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {}})
            assert denied.status_code == 401


@pytest.mark.asyncio
async def test_real_fastapi_routes_openapi_and_lifespan_survive_cohosting(tmp_path, monkeypatch):
    # Standalone MCP installs do not include backend dependencies. The combined
    # deployment environment runs this against the actual FastAPI application.
    pytest.importorskip('fastapi')
    pytest.importorskip('sqlalchemy')
    import importlib
    from pathlib import Path
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[2] / 'backend'))
    for key, value in {
        'DATABASE_URL': 'sqlite:///:memory:', 'JWT_SECRET_KEY': 'synthetic-combined-test-key',
        'ACCESS_TOKEN_EXPIRE_MINUTES': '15', 'REFRESH_TOKEN_EXPIRE_DAYS': '7',
    }.items():
        monkeypatch.setenv(key, value)
    backend = importlib.import_module('app.main')
    events = []
    for attribute, event in [('_upgrade_database', 'api:migrations'),
        ('start_daily_call_reminder_loop', 'api:reminder:start'),
        ('start_retention_scheduler', 'api:retention:start'),
        ('stop_retention_scheduler', 'api:retention:stop'),
        ('stop_daily_call_reminder_loop', 'api:reminder:stop')]:
        monkeypatch.setattr(backend, attribute, lambda name=event: events.append(name))
    settings = hosted_settings(tmp_path, monkeypatch)
    provider = OAuthProvider(settings, http_client=httpx.AsyncClient(transport=httpx.MockTransport(upstream_handler([]))))
    app = create_combined_app(backend.app, create_app(settings, provider=provider))
    async with app.router.lifespan_context(app):
        assert events == ['api:migrations', 'api:reminder:start', 'api:retention:start']
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=settings.issuer_url) as client:
            root = await client.get('/')
            assert root.status_code == 200
            assert root.json()['message'] == 'BWC Task Manager API'
            health = await client.get('/health')
            assert health.status_code == 200
            assert health.json() == {'status': 'healthy'}
            schema = await client.get('/openapi.json')
            assert schema.status_code == 200
            paths = schema.json()['paths']
            assert {'/auth/login', '/tasks', '/events', '/admin/users'} <= set(paths)
            assert '/authorize' not in paths
            docs = await client.get('/docs')
            assert docs.status_code == 200 and 'swagger-ui' in docs.text
            invalid_login = await client.post('/auth/login', json={})
            assert invalid_login.status_code == 422
            assert any('username_or_email' in error['loc'] for error in invalid_login.json()['detail'])
            no_token = await client.get('/tasks')
            assert no_token.status_code in (401, 403)
            oauth = await client.get('/.well-known/oauth-authorization-server')
            assert oauth.status_code == 200
            assert oauth.json()['issuer'].rstrip('/') == settings.issuer_url
            assert (await client.get('/login')).status_code == 400
    assert events == ['api:migrations', 'api:reminder:start', 'api:retention:start',
                      'api:retention:stop', 'api:reminder:stop']
