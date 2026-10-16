"""Local MCP configuration; never import application settings or secrets."""
from dataclasses import dataclass, field
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
    database_path: Path | None
    encryption_key: str = field(repr=False)
    database_url: str | None = field(default=None, repr=False)

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
        if self.database_url is not None:
            try:
                database = urlsplit(self.database_url)
                if database.scheme not in {'postgres', 'postgresql', 'postgresql+psycopg2'} or not database.path.strip('/'):
                    raise ValueError
                database.port
            except ValueError:
                raise ValueError('BWC_MCP_DATABASE_URL must be a PostgreSQL connection URL') from None
        elif self.database_path is None:
            raise ValueError('An OAuth database URL or private SQLite path is required')
        if self.database_path is not None:
            object.__setattr__(self, 'database_path', Path(self.database_path).expanduser().absolute())

    @property
    def resource_url(self) -> str:
        return self.issuer_url + '/mcp'

    @classmethod
    def from_env(cls, *, combined: bool = False) -> 'HostedSettings':
        required = ('BWC_API_URL', 'BWC_MCP_ISSUER_URL', 'BWC_MCP_ENCRYPTION_KEY')
        values = {key: os.environ.get(key, '').strip() for key in required}
        values['BWC_MCP_ISSUER_URL'] = values['BWC_MCP_ISSUER_URL'] or os.environ.get('RENDER_EXTERNAL_URL', '').strip()
        if combined and not values['BWC_API_URL']:
            values['BWC_API_URL'] = 'http://127.0.0.1:' + os.environ.get('PORT', '8000')
        database_url = os.environ.get('BWC_MCP_DATABASE_URL', '').strip()
        if combined and not database_url:
            database_url = os.environ.get('DATABASE_URL', '').strip()
        database_path = os.environ.get('BWC_MCP_DATABASE_PATH', '').strip()
        missing = [key for key, value in values.items() if not value]
        if combined and not database_url:
            missing.append('BWC_MCP_DATABASE_URL or DATABASE_URL')
        elif not database_url and not database_path:
            missing.append('BWC_MCP_DATABASE_URL or BWC_MCP_DATABASE_PATH')
        if missing:
            raise ValueError('Missing deployment settings: ' + ', '.join(missing))
        return cls(values['BWC_API_URL'], values['BWC_MCP_ISSUER_URL'],
                   Path(database_path) if database_path and not database_url else None, values['BWC_MCP_ENCRYPTION_KEY'],
                   database_url=database_url or None)
