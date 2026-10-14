"""Local MCP configuration; never import application settings or secrets."""
from dataclasses import dataclass
import ipaddress
import os
from pathlib import Path
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Settings:
    api_url: str
    session_file: Path
    credentials_dir: Path

    def __post_init__(self) -> None:
        try:
            url = urlsplit(self.api_url)
            port = url.port
            host = url.hostname
        except ValueError:
            raise ValueError("BWC_API_URL must be a valid API origin") from None
        if (not host or url.username is not None or url.password is not None
                or '?' in self.api_url or '#' in self.api_url
                or any(ord(ch) <= 32 or ord(ch) == 127 for ch in self.api_url)):
            raise ValueError("BWC_API_URL must not contain credentials, query, or fragment")
        if url.path not in ('', '/'):
            raise ValueError("BWC_API_URL must contain only the API origin")
        try:
            loopback = ipaddress.ip_address(host).is_loopback
        except ValueError:
            loopback = host.lower() == 'localhost'
        if url.scheme != 'https' and not (url.scheme == 'http' and loopback):
            raise ValueError("BWC_API_URL requires HTTPS, except for loopback development")
        if port is not None and not 1 <= port <= 65535:
            raise ValueError("BWC_API_URL has an invalid port")
        object.__setattr__(self, 'api_url', self.api_url.rstrip('/'))
        object.__setattr__(self, 'session_file', Path(self.session_file).expanduser().absolute())
        object.__setattr__(self, 'credentials_dir', Path(self.credentials_dir).expanduser().absolute())

    @property
    def api_origin(self) -> str:
        return self.api_url

    @classmethod
    def from_env(cls) -> 'Settings':
        api_url = os.environ.get('BWC_API_URL', '').strip()
        if not api_url:
            raise ValueError("BWC_API_URL is required")
        root = Path.home() / '.local' / 'share' / 'bwc-mcp'
        return cls(api_url, Path(os.environ.get('BWC_SESSION_FILE', str(root / 'session.json'))),
                   Path(os.environ.get('BWC_CREDENTIALS_DIR', str(root / 'credentials'))))


@dataclass(frozen=True)
class HostedSettings:
    """OAuth deployment configuration, independent of local account sessions."""
    api_url: str
    issuer_url: str
    database_path: Path
    encryption_key: str

    def __post_init__(self) -> None:
        from cryptography.fernet import Fernet
        for value in (self.api_url, self.issuer_url):
            # Reuse strict origin validation; HTTP is allowed only on loopback.
            Settings(value, Path('/tmp/unused-session'), Path('/tmp/unused-credentials'))
        try:
            Fernet(self.encryption_key.encode('ascii'))
        except (ValueError, UnicodeError):
            raise ValueError('BWC_MCP_ENCRYPTION_KEY must be a valid Fernet key') from None
        object.__setattr__(self, 'api_url', self.api_url.rstrip('/'))
        object.__setattr__(self, 'issuer_url', self.issuer_url.rstrip('/'))
        object.__setattr__(self, 'database_path', Path(self.database_path).expanduser().absolute())

    @property
    def resource_url(self) -> str:
        return self.issuer_url + '/mcp'

    @classmethod
    def from_env(cls) -> 'HostedSettings':
        required = ('BWC_API_URL', 'BWC_MCP_ISSUER_URL', 'BWC_MCP_DATABASE_PATH', 'BWC_MCP_ENCRYPTION_KEY')
        values = {key: os.environ.get(key, '').strip() for key in required}
        values['BWC_MCP_ISSUER_URL'] = values['BWC_MCP_ISSUER_URL'] or os.environ.get('RENDER_EXTERNAL_URL', '').strip()
        missing = [key for key, value in values.items() if not value]
        if missing:
            raise ValueError('Missing deployment settings: ' + ', '.join(missing))
        return cls(values['BWC_API_URL'], values['BWC_MCP_ISSUER_URL'],
                   Path(values['BWC_MCP_DATABASE_PATH']), values['BWC_MCP_ENCRYPTION_KEY'])
