"""The same encrypted record contract works on SQLite and PostgreSQL."""
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import threading
import time
import uuid

from cryptography.fernet import Fernet
import pytest

from bwc_mcp.config import HostedSettings
from bwc_mcp.oauth_store import OAuthStore, StoreError, _postgres_sql, token_hash


@pytest.fixture(params=['sqlite', 'postgres'])
def store_factory(request, tmp_path):
    key = Fernet.generate_key()
    if request.param == 'sqlite':
        path = tmp_path / 'private' / 'oauth.sqlite'
        yield lambda: OAuthStore(path, key)
        return
    url = os.environ.get('BWC_MCP_TEST_DATABASE_URL')
    if not url:
        pytest.skip('Set BWC_MCP_TEST_DATABASE_URL for isolated PostgreSQL integration checks')
    psycopg2 = pytest.importorskip('psycopg2')
    from psycopg2 import sql
    from psycopg2.extensions import make_dsn
    url = url.replace('postgresql+psycopg2://', 'postgresql://', 1)
    schema = 'bwc_mcp_test_' + uuid.uuid4().hex
    with psycopg2.connect(url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
    dsn = make_dsn(url, options='-csearch_path=' + schema)
    try:
        yield lambda: OAuthStore(None, key, database_url=dsn)
    finally:
        with psycopg2.connect(url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema)))


def test_encryption_parameter_binding_upsert_and_restart(store_factory):
    first = store_factory()
    secret = "synthetic-token-'?; DROP TABLE records; --"
    lookup = token_hash(secret)
    with first.transaction() as db:
        first.put(db, 'client', lookup, {'secret': secret, 'version': 1})
        first.put(db, 'client', lookup, {'secret': secret, 'version': 2})
        row = db.execute('SELECT key,payload FROM records WHERE kind=? AND key=?', ('client', lookup)).fetchone()
        assert secret.encode() not in bytes(row['payload'])
        assert row['key'] != secret
    second = store_factory()
    with second.transaction() as db:
        assert second.get(db, 'client', lookup) == {'secret': secret, 'version': 2}


def test_rollback_expiry_and_orphan_cleanup(store_factory):
    store = store_factory()
    with store.transaction() as db:
        store.put(db, 'grant', 'grant', {'credentials': 'synthetic-secret'}, grant_id='grant')
        store.put(db, 'access', 'token', {}, grant_id='grant', expires=time.time() - 1)
    with store.transaction() as db:
        assert store.get(db, 'access', 'token') is None
        assert store.get(db, 'grant', 'grant') is None
    with pytest.raises(RuntimeError, match='deliberate'):
        with store.transaction() as db:
            store.put(db, 'client', 'rolled-back', {})
            raise RuntimeError('deliberate rollback')
    with store.transaction() as db:
        assert store.get(db, 'client', 'rolled-back') is None


def test_independent_instances_consume_token_once(store_factory):
    stores = [store_factory(), store_factory()]
    with stores[0].transaction() as db:
        stores[0].put(db, 'code', 'one-use', {'value': 'synthetic'}, expires=time.time() + 300)
    barrier = threading.Barrier(2)
    def consume(store):
        barrier.wait(timeout=5)
        with store.transaction() as db:
            payload = store.get(db, 'code', 'one-use')
            if payload:
                time.sleep(0.05)
                store.delete(db, 'code', 'one-use')
            return payload
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(consume, stores))
    assert sum(result is not None for result in results) == 1


def test_postgres_translation_preserves_literals_and_binds_values():
    assert _postgres_sql("SELECT '?' AS literal FROM records WHERE key=?") == (
        "SELECT '?' AS literal FROM bwc_mcp_oauth_records WHERE key=%s")


def test_hosted_postgres_env_fallback_is_combined_only(tmp_path, monkeypatch):
    monkeypatch.setenv('BWC_API_URL', 'https://api.example.test')
    monkeypatch.setenv('BWC_MCP_ISSUER_URL', 'https://mcp.example.test')
    monkeypatch.setenv('BWC_MCP_ENCRYPTION_KEY', Fernet.generate_key().decode())
    monkeypatch.setenv('DATABASE_URL', 'postgresql://user:synthetic-password@db.example.test/app')
    monkeypatch.delenv('BWC_MCP_DATABASE_URL', raising=False)
    monkeypatch.delenv('BWC_MCP_DATABASE_PATH', raising=False)
    with pytest.raises(ValueError, match='DATABASE'):
        HostedSettings.from_env()
    settings = HostedSettings.from_env(combined=True)
    assert settings.database_path is None
    assert settings.database_url == os.environ['DATABASE_URL']
    assert 'synthetic-password' not in repr(settings)
    assert settings.encryption_key not in repr(settings)
    monkeypatch.setenv('BWC_MCP_DATABASE_URL', 'postgresql://db.example.test/dedicated')
    assert HostedSettings.from_env(combined=True).database_url.endswith('/dedicated')


def test_combined_public_origin_defaults_and_safe_url_errors(monkeypatch):
    for name in ('BWC_API_URL', 'BWC_MCP_ISSUER_URL', 'BWC_MCP_DATABASE_PATH'):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv('RENDER_EXTERNAL_URL', 'https://bwc.example.test')
    monkeypatch.setenv('DATABASE_URL', 'postgresql://db.example.test/app')
    monkeypatch.setenv('BWC_MCP_ENCRYPTION_KEY', Fernet.generate_key().decode())
    monkeypatch.delenv('BWC_MCP_DATABASE_URL', raising=False)
    settings = HostedSettings.from_env(combined=True)
    assert settings.issuer_url == 'https://bwc.example.test'
    assert settings.api_url == 'http://127.0.0.1:' + os.environ.get('PORT', '8000')
    monkeypatch.setenv('BWC_MCP_DATABASE_URL', 'https://user:synthetic-private@db.example.test/app')
    with pytest.raises(ValueError) as raised:
        HostedSettings.from_env(combined=True)
    assert 'synthetic-private' not in str(raised.value)


def test_combined_requires_postgres_even_with_legacy_sqlite_path(tmp_path, monkeypatch):
    monkeypatch.setenv('BWC_API_URL', 'https://api.example.test')
    monkeypatch.setenv('BWC_MCP_ISSUER_URL', 'https://mcp.example.test')
    monkeypatch.setenv('BWC_MCP_ENCRYPTION_KEY', Fernet.generate_key().decode())
    monkeypatch.setenv('BWC_MCP_DATABASE_PATH', str(tmp_path / 'legacy.sqlite'))
    monkeypatch.delenv('BWC_MCP_DATABASE_URL', raising=False)
    monkeypatch.delenv('DATABASE_URL', raising=False)
    with pytest.raises(ValueError, match='DATABASE_URL'):
        HostedSettings.from_env(combined=True)


@pytest.mark.asyncio
async def test_provider_code_refresh_and_revoke_share_storage_contract(store_factory, tmp_path, monkeypatch):
    from urllib.parse import parse_qs, urlsplit
    import httpx
    from mcp.server.auth.provider import AuthorizationParams, TokenError
    from mcp.shared.auth import OAuthClientInformationFull
    from bwc_mcp import oauth

    # Exercise provider-authored SQL (including pair revocation) on each backend.
    monkeypatch.setattr(oauth, 'OAuthStore', lambda *args, **kwargs: store_factory())
    settings = HostedSettings('http://127.0.0.1:8000', 'https://mcp.example.test',
                              tmp_path / 'unused', Fernet.generate_key().decode())
    async def handler(request):
        if request.url.path == '/auth/login':
            return httpx.Response(200, json={'access_token': 'synthetic-upstream', 'refresh_token': 'synthetic-upstream-refresh'})
        if request.url.path == '/auth/me':
            return httpx.Response(200, json={'id': 'synthetic-user', 'is_active': True})
        return httpx.Response(200, json={'tasks': []})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as upstream:
        provider = oauth.OAuthProvider(settings, http_client=upstream)
        client = OAuthClientInformationFull(client_id='synthetic-client', redirect_uris=['https://client.example.test/callback'],
                                            token_endpoint_auth_method='none', scope='bwc')
        await provider.register_client(client)
        redirect = await provider.authorize(client, AuthorizationParams(state='synthetic-state', scopes=['bwc'],
            code_challenge='A' * 43, redirect_uri=client.redirect_uris[0], redirect_uri_provided_explicitly=True,
            resource=settings.resource_url))
        nonce = parse_qs(urlsplit(redirect).query)['request'][0]
        callback = await provider.complete_login(nonce, 'synthetic-user', 'synthetic-password')
        code_string = parse_qs(urlsplit(callback).query)['code'][0]
        code = await provider.load_authorization_code(client, code_string)
        tokens = await provider.exchange_authorization_code(client, code)
        assert await provider.load_authorization_code(client, code_string) is None
        assert await provider.request_for_token(tokens.access_token, 'GET', '/tasks') == {'tasks': []}
        refresh = await provider.load_refresh_token(client, tokens.refresh_token)
        rotated = await provider.exchange_refresh_token(client, refresh, ['bwc'])
        assert await provider.load_access_token(tokens.access_token) is None
        assert await provider.load_refresh_token(client, tokens.refresh_token) is None
        with pytest.raises(TokenError):
            await provider.exchange_refresh_token(client, refresh, ['bwc'])
        access = await provider.load_access_token(rotated.access_token)
        await provider.revoke_token(access)
        assert await provider.load_access_token(rotated.access_token) is None
        assert await provider.load_refresh_token(client, rotated.refresh_token) is None
