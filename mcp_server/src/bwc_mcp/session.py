"""Private local session storage with atomic token rotation."""
from dataclasses import asdict, dataclass
import json
import os
from pathlib import Path
import stat
import tempfile

from .config import Settings


class SessionError(ValueError):
    pass


def _reject_symlinks(path: Path) -> None:
    for component in (path, *path.parents):
        if component.is_symlink():
            raise SessionError('Credential paths must not contain symbolic links')


def ensure_private_directory(path: Path) -> None:
    path = Path(path).expanduser().absolute()
    _reject_symlinks(path)
    try:
        path.mkdir(mode=0o700, parents=True, exist_ok=True)
        info = path.stat()
        if not stat.S_ISDIR(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o700 or info.st_uid != os.getuid():
            raise SessionError('Credential directory must be owned by you with permissions 0700')
    except OSError:
        raise SessionError('Cannot access private credential directory') from None


@dataclass(frozen=True)
class Session:
    api_origin: str
    access_token: str
    refresh_token: str


class SessionStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.path = settings.session_file

    def _validate_file(self) -> None:
        _reject_symlinks(self.path)
        if not self.path.exists():
            return
        info = self.path.stat()
        if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600 or info.st_uid != os.getuid():
            raise SessionError('Session file must be owned by you with permissions 0600')

    def _validate_session(self, session: Session) -> None:
        if session.api_origin != self.settings.api_origin:
            raise SessionError('Session belongs to another API origin; log in again')
        if not all(isinstance(token, str) and token and not any(c.isspace() for c in token)
                   for token in (session.access_token, session.refresh_token)):
            raise SessionError('Invalid session; log in again')

    def load(self) -> Session:
        ensure_private_directory(self.path.parent)
        self._validate_file()
        try:
            fd = os.open(self.path, os.O_RDONLY | os.O_NOFOLLOW)
            with os.fdopen(fd, 'r', encoding='utf-8') as handle:
                session = Session(**json.load(handle))
            self._validate_session(session)
            return session
        except (OSError, TypeError, json.JSONDecodeError):
            raise SessionError('No valid local session; run bwc-mcp-login') from None

    def save(self, session: Session) -> None:
        self._validate_session(session)
        ensure_private_directory(self.path.parent)
        self._validate_file()
        temporary = None
        try:
            fd, temporary = tempfile.mkstemp(prefix='.session-', dir=self.path.parent)
            with os.fdopen(fd, 'w', encoding='utf-8') as handle:
                os.fchmod(handle.fileno(), 0o600)
                json.dump(asdict(session), handle)
                handle.flush()
                os.fsync(handle.fileno())
            self._validate_file()
            os.replace(temporary, self.path)
            temporary = None
        except OSError:
            raise SessionError('Cannot save private local session') from None
        finally:
            if temporary is not None:
                os.unlink(temporary)
