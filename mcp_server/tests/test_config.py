from cryptography.fernet import Fernet

from bwc_mcp.config import HostedSettings


def test_render_assigned_origin_is_used_without_custom_dns(tmp_path, monkeypatch):
    monkeypatch.setenv('BWC_API_URL', 'https://api.example.test')
    monkeypatch.setenv('BWC_MCP_DATABASE_PATH', str(tmp_path / 'oauth.sqlite3'))
    monkeypatch.setenv('BWC_MCP_ENCRYPTION_KEY', Fernet.generate_key().decode())
    monkeypatch.delenv('BWC_MCP_ISSUER_URL', raising=False)
    monkeypatch.setenv('RENDER_EXTERNAL_URL', 'https://synthetic-service.onrender.com')
    settings = HostedSettings.from_env()
    assert settings.resource_url == 'https://synthetic-service.onrender.com/mcp'
    monkeypatch.setenv('BWC_MCP_ISSUER_URL', 'https://custom.example.test')
    assert HostedSettings.from_env().resource_url == 'https://custom.example.test/mcp'
