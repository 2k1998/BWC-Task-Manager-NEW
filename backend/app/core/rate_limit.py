"""Shared rate limiter.

Lives in its own module (rather than in app.main) so routers can import the
limiter for their @limiter.limit(...) decorators without a circular import
back into app.main.
"""
from fastapi import Request
from slowapi import Limiter


def get_real_client_ip(request: Request) -> str:
    """Client IP for rate-limit bucketing, aware of Render's reverse proxy.

    In production the app sits behind Render's proxy, so request.client.host is
    the proxy's address and every caller would share a single bucket. The real
    caller is the FIRST hop of X-Forwarded-For (later hops are the proxy chain).

    NOTE: this only holds because uvicorn runs with --proxy-headers behind a
    trusted proxy. X-Forwarded-For is client-supplied and spoofable when the app
    is exposed directly, so do not deploy this without the proxy in front.
    """
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_hop = forwarded_for.split(",")[0].strip()
        if first_hop:
            return first_hop
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=get_real_client_ip)
