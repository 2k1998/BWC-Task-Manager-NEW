"""Encrypted single-worker OAuth state. Secret lookup keys are SHA-256 hashes."""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import stat
import threading
import time

from cryptography.fernet import Fernet, InvalidToken

from .session import ensure_private_directory


class StoreError(RuntimeError):
    pass


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


class OAuthStore:
    def __init__(self, database_path: Path, encryption_key: str | bytes):
        self.path = Path(database_path).expanduser().absolute()
        ensure_private_directory(self.path.parent)
        if self.path.is_symlink():
            raise StoreError('OAuth database must not be a symbolic link')
        self.cipher = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        info = os.fstat(fd)
        os.close(fd)
        if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600 or info.st_uid != os.getuid():
            raise StoreError('OAuth database must be privately owned with permissions 0600')
        self._lock = threading.RLock()
        with self.transaction() as db:
            db.execute('''CREATE TABLE IF NOT EXISTS records (
                kind TEXT NOT NULL, key TEXT NOT NULL, payload BLOB NOT NULL,
                expires REAL, client_id TEXT, grant_id TEXT, resource TEXT,
                PRIMARY KEY (kind, key))''')
            db.execute('CREATE INDEX IF NOT EXISTS record_grants ON records(grant_id)')
            db.execute('CREATE INDEX IF NOT EXISTS record_expiry ON records(expires)')

    @contextmanager
    def transaction(self):
        with self._lock:
            db = sqlite3.connect(self.path, timeout=10)
            db.row_factory = sqlite3.Row
            try:
                db.execute('PRAGMA busy_timeout=10000')
                db.execute('BEGIN IMMEDIATE')
                # Expired OAuth requests/tokens must not retain upstream sessions forever.
                if db.execute("SELECT 1 FROM sqlite_master WHERE name='records'").fetchone():
                    db.execute('DELETE FROM records WHERE expires IS NOT NULL AND expires <= ?', (time.time(),))
                    db.execute("DELETE FROM records WHERE kind='grant' AND key NOT IN "
                               "(SELECT grant_id FROM records WHERE kind IN ('code','access','refresh') "
                               "AND grant_id IS NOT NULL)")
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise
            finally:
                db.close()

    def get(self, db, kind: str, key: str) -> dict | None:
        row = db.execute('SELECT payload, expires FROM records WHERE kind=? AND key=?', (kind, key)).fetchone()
        if row is None or (row['expires'] is not None and row['expires'] <= time.time()):
            return None
        try:
            return json.loads(self.cipher.decrypt(row['payload']))
        except (InvalidToken, ValueError, TypeError):
            raise StoreError('OAuth state could not be decrypted; verify the configured encryption key') from None

    def put(self, db, kind: str, key: str, payload: dict, *, expires: float | None = None,
            client_id: str | None = None, grant_id: str | None = None, resource: str | None = None) -> None:
        encrypted = self.cipher.encrypt(json.dumps(payload, separators=(',', ':')).encode())
        db.execute('INSERT OR REPLACE INTO records VALUES (?,?,?,?,?,?,?)',
                   (kind, key, encrypted, expires, client_id, grant_id, resource))

    def delete(self, db, kind: str, key: str) -> None:
        db.execute('DELETE FROM records WHERE kind=? AND key=?', (kind, key))

    def revoke_grant(self, db, grant_id: str) -> None:
        db.execute('DELETE FROM records WHERE grant_id=? OR (kind=? AND key=?)', (grant_id, 'grant', grant_id))
