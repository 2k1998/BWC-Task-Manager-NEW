"""Login Origin regression; browser cases use only synthetic local identities.

Optional browser run: install playwright and its Chromium browser, then run this
file with pytest. BWC_MCP_BROWSER_EXECUTABLE_PATH may select an existing browser.
No real API, account, database or external callback is used.
"""
import os
import socket
import threading
import time

from cryptography.fernet import Fernet
import httpx
import pytest
from starlette.responses import PlainTextResponse
from starlette.routing import Route
import uvicorn

from bwc_mcp.config import HostedSettings
from bwc_mcp.oauth import OAuthProvider
from bwc_mcp.remote import HEADERS, create_app


class SyntheticProvider(OAuthProvider):
    """Exercise the real login handler without opening OAuth storage or HTTP."""

    def __init__(self):
        self.calls = []
        self.available = True

    def pending(self, nonce):
        if nonce == 'synthetic-request' and self.available:
            return {'client_name': 'Synthetic local client'}
        return None

    async def complete_login(self, nonce, username, password):
        self.calls.append((nonce, username, password))
        self.available = False
        return '/synthetic-callback'

    async def aclose(self):
        pass


def synthetic_app(tmp_path, origin):
    settings = HostedSettings(
        api_url='http://127.0.0.1:1', issuer_url=origin,
        database_path=tmp_path / 'unused.sqlite',
        encryption_key=Fernet.generate_key().decode(),
    )
    provider = SyntheticProvider()
    app = create_app(settings, provider=provider)
    app.routes.append(Route('/synthetic-callback', lambda request: PlainTextResponse('Synthetic account connected')))
    return app, provider


@pytest.mark.asyncio
async def test_login_document_preserves_origin_and_rejects_untrusted_origins(tmp_path):
    origin = 'http://127.0.0.1:8787'
    app, provider = synthetic_app(tmp_path, origin)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=origin) as http:
            page = await http.get('/login?request=synthetic-request')
            assert page.status_code == 200
            assert page.headers['referrer-policy'] == 'same-origin'
            assert HEADERS['Referrer-Policy'] == 'no-referrer'
            # Use the real rendered CSRF field and its browser cookie.
            import re
            csrf = re.search(r'name="csrf" value="([^"]+)"', page.text).group(1)
            form = {'request': 'synthetic-request', 'csrf': csrf, 'username': 'synthetic-user',
                    'password': 'synthetic-password', 'approve': 'yes'}
            for untrusted in ('null', 'https://attacker.example.test'):
                denied = await http.post('/login', data=form, headers={'Origin': untrusted})
                assert denied.status_code == 403
                assert denied.headers['referrer-policy'] == 'no-referrer'
                assert provider.calls == []
            accepted = await http.post('/login', data=form, headers={'Origin': origin})
            assert accepted.status_code == 303
            assert accepted.headers['referrer-policy'] == 'no-referrer'
            assert provider.calls == [('synthetic-request', 'synthetic-user', 'synthetic-password')]
            replay = await http.post('/login', data=form, headers={'Origin': origin})
            assert replay.status_code == 403
            assert replay.headers['referrer-policy'] == 'no-referrer'
            expired = await http.get('/login?request=expired')
            assert expired.status_code == 400
            assert expired.headers['referrer-policy'] == 'no-referrer'


@pytest.mark.parametrize('old_policy', [True, False], ids=['original-no-referrer', 'fixed-same-origin'])
def test_native_browser_form_origin(tmp_path, old_policy):
    """A real navigation sends null under the old policy and reaches login after the fix."""
    playwright = pytest.importorskip('playwright.sync_api')
    listener = socket.socket()
    listener.bind(('127.0.0.1', 0))
    origin = f'http://127.0.0.1:{listener.getsockname()[1]}'
    app, provider = synthetic_app(tmp_path, origin)
    observed_origins = []

    async def observed_app(scope, receive, send):
        if scope['type'] == 'http' and scope.get('path') == '/login' and scope.get('method') == 'POST':
            observed_origins.append(dict(scope['headers']).get(b'origin', b'').decode())

        async def observed_send(message):
            if (old_policy and scope.get('method') == 'GET' and scope.get('path') == '/login'
                    and message['type'] == 'http.response.start' and message['status'] == 200):
                message = {**message, 'headers': [
                    (key, b'no-referrer' if key == b'referrer-policy' else value)
                    for key, value in message['headers']]}
            await send(message)

        await app(scope, receive, observed_send)

    server = uvicorn.Server(uvicorn.Config(observed_app, log_level='error', access_log=False))
    thread = threading.Thread(target=server.run, kwargs={'sockets': [listener]}, daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + 10
        while not server.started and thread.is_alive() and time.monotonic() < deadline:
            time.sleep(0.01)
        assert server.started, 'Local synthetic server did not start'
        with playwright.sync_playwright() as automation:
            executable = os.environ.get('BWC_MCP_BROWSER_EXECUTABLE_PATH')
            browser = automation.chromium.launch(executable_path=executable or None)
            try:
                page = browser.new_page()
                document = page.goto(origin + '/login?request=synthetic-request')
                assert document.headers['referrer-policy'] == ('no-referrer' if old_policy else 'same-origin')
                page.get_by_label('Username or email').fill('synthetic-user')
                page.get_by_label('Password', exact=True).fill('synthetic-password')
                page.get_by_role('checkbox').check()
                with page.expect_response(lambda response: response.url == origin + '/login'
                                          and response.request.method == 'POST') as posted:
                    page.get_by_role('button', name='Connect account').click()
                if old_policy:
                    assert posted.value.status == 403
                    assert observed_origins == ['null']
                    assert provider.calls == []
                    assert page.get_by_text('Invalid authorization request.', exact=True).is_visible()
                else:
                    assert posted.value.status == 303
                    assert observed_origins == [origin]
                    assert provider.calls == [('synthetic-request', 'synthetic-user', 'synthetic-password')]
                    page.wait_for_url(origin + '/synthetic-callback')
                    assert page.get_by_text('Synthetic account connected', exact=True).is_visible()
            finally:
                browser.close()
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        listener.close()
        assert not thread.is_alive(), 'Local synthetic server did not stop'
