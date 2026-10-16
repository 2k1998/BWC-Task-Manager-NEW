"""Serve the existing BWC API and OAuth MCP endpoint on one paid service."""
from __future__ import annotations

from contextlib import AsyncExitStack, asynccontextmanager
import os

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send


MCP_PATHS = frozenset({
    '/mcp', '/authorize', '/token', '/register', '/revoke', '/login',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/mcp',
})


def create_combined_app(api_app: Starlette, mcp_app: Starlette) -> Starlette:
    """Compose injectable apps without modifying either app's routes or lifespan."""
    @asynccontextmanager
    async def lifespan(app: Starlette):
        app.state.ready = False
        async with AsyncExitStack() as stack:
            await stack.enter_async_context(api_app.router.lifespan_context(api_app))
            await stack.enter_async_context(mcp_app.router.lifespan_context(mcp_app))
            app.state.ready = True
            try:
                yield
            finally:
                app.state.ready = False

    class CombinedApp(Starlette):
        async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
            if scope['type'] == 'lifespan':
                return await super().__call__(scope, receive, send)
            path = scope.get('path', '')
            if scope['type'] == 'http' and path == '/health' and not self.state.ready:
                response = JSONResponse({'status': 'starting'}, status_code=503,
                                        headers={'Cache-Control': 'no-store'})
                return await response(scope, receive, send)
            target: ASGIApp = mcp_app if scope['type'] == 'http' and path.rstrip('/') in MCP_PATHS else api_app
            # Keep the complete original scope: HTTP paths, proxy identity,
            # WebSocket paths, and root_path retain their API behavior.
            return await target(scope, receive, send)

    app = CombinedApp(lifespan=lifespan)
    app.state.ready = False
    return app


def create_app() -> Starlette:
    """Load production apps only when this explicitly selected entry point runs."""
    from app.main import app as api_app
    from .config import HostedSettings
    from .remote import create_app as create_mcp_app

    settings = HostedSettings.from_env(combined=True)
    return create_combined_app(api_app, create_mcp_app(settings))


def main() -> None:
    import uvicorn

    # Render terminates TLS and supplies the trusted forwarding headers. Keep a
    # single worker so the API schedulers and MCP rate limiter each run once.
    uvicorn.run(create_app(), host='0.0.0.0', port=int(os.environ.get('PORT', '8000')),
                workers=1, access_log=False, proxy_headers=True, forwarded_allow_ips='*')


if __name__ == '__main__':
    main()
