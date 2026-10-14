import asyncio
import json
from pathlib import Path

import httpx
import pytest

from bwc_mcp.client import APIError, BwcClient
from bwc_mcp.config import Settings
from bwc_mcp.session import Session, SessionStore


def configured(tmp_path: Path) -> Settings:
    settings = Settings(api_url='http://127.0.0.1:8765', session_file=tmp_path / 'private' / 'session.json', credentials_dir=tmp_path / 'credentials')
    SessionStore(settings).save(Session(api_origin=settings.api_origin, access_token='synthetic-old-access', refresh_token='synthetic-old-refresh'))
    return settings


@pytest.mark.asyncio
async def test_rotating_refresh_is_serialized_and_persisted(tmp_path):
    settings = configured(tmp_path)
    refreshes = []
    async def respond(request):
        if request.url.path == '/auth/refresh':
            refreshes.append(json.loads(request.content))
            await asyncio.sleep(0.02)
            return httpx.Response(200, json={'access_token': 'synthetic-new-access', 'refresh_token': 'synthetic-new-refresh'})
        if request.headers.get('authorization') == 'Bearer synthetic-old-access':
            return httpx.Response(401, json={'detail': 'Expired'})
        assert request.headers['authorization'] == 'Bearer synthetic-new-access'
        return httpx.Response(200, json={'id': 'current-user'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        client = BwcClient(settings, http_client=http)
        results = await asyncio.gather(*[client.request('GET', '/auth/me') for _ in range(5)])
    assert results == [{'id': 'current-user'}] * 5
    assert refreshes == [{'refresh_token': 'synthetic-old-refresh'}]
    saved = SessionStore(settings).load()
    assert saved.access_token == 'synthetic-new-access'
    assert saved.refresh_token == 'synthetic-new-refresh'
    assert settings.session_file.stat().st_mode & 0o777 == 0o600


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', ['network', 'server'])
async def test_writes_are_never_retried_on_ambiguous_failure(tmp_path, failure):
    settings = configured(tmp_path)
    calls = []
    async def respond(request):
        calls.append(request)
        if failure == 'network':
            raise httpx.ReadError('synthetic sensitive response material', request=request)
        return httpx.Response(500, json={'detail': 'synthetic sensitive response material'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        client = BwcClient(settings, http_client=http)
        with pytest.raises(APIError) as caught:
            await client.request('POST', '/tasks', json={'title': 'A task'})
    assert len(calls) == 1
    assert 'synthetic sensitive response material' not in str(caught.value)
    assert 'synthetic-old-access' not in str(caught.value)


@pytest.mark.asyncio
async def test_backend_forbidden_is_not_refreshed_or_hidden(tmp_path):
    settings = configured(tmp_path)
    calls = []
    async def respond(request):
        calls.append(request.url.path)
        return httpx.Response(403, json={'detail': 'Bearer synthetic-old-access internal database text'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        client = BwcClient(settings, http_client=http)
        with pytest.raises(APIError) as caught:
            await client.request('PUT', '/tasks/task-id', json={'deadline': '2026-12-01'})
    assert calls == ['/tasks/task-id']
    assert caught.value.status_code == 403
    assert 'synthetic-old-access' not in str(caught.value)
    assert 'internal database text' not in str(caught.value)


def test_session_cannot_be_used_on_another_origin(tmp_path):
    settings = configured(tmp_path)
    other = Settings(api_url='http://127.0.0.1:8766', session_file=settings.session_file, credentials_dir=settings.credentials_dir)
    with pytest.raises(Exception, match='(?i)origin|backend|match'):
        SessionStore(other).load()


@pytest.mark.parametrize('url', ['http://example.com', 'https://user:secret@example.com', 'https://example.com?token=secret', 'https://example.com#fragment'])
def test_settings_reject_unsafe_api_urls(tmp_path, monkeypatch, url):
    monkeypatch.setenv('BWC_API_URL', url)
    monkeypatch.setenv('BWC_SESSION_FILE', str(tmp_path / 'session.json'))
    monkeypatch.setenv('BWC_CREDENTIALS_DIR', str(tmp_path / 'credentials'))
    with pytest.raises(Exception):
        Settings.from_env()
