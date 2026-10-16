"""Encrypted OAuth state in private SQLite or a dedicated PostgreSQL table."""
import hashlib
import json
import os
from pathlib import Path
import re
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


# All SQL originates in this package. Values always remain driver parameters.
_SQL_TOKEN = re.compile(r"'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"|\brecords\b|\?", re.IGNORECASE)
_ADVISORY_LOCK = 0x4257434D43504F41


def _postgres_sql(sql: str) -> str:
    def replace(match):
        token = match.group()
        if token == '?':
            return '%s'
        if token.lower() == 'records':
            return 'bwc_mcp_oauth_records'
        return token
    return _SQL_TOKEN.sub(replace, sql)


class _PostgresConnection:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql: str, parameters=()):
        from psycopg2.extras import RealDictCursor
        cursor = self.connection.cursor(cursor_factory=RealDictCursor)
        cursor.execute(_postgres_sql(sql), parameters)
        return cursor


class _Transaction:
    def __init__(self, store):
        self.store = store
        self.connection = None

    def __enter__(self):
        store = self.store
        store._lock.acquire()
        try:
            if store._database_url:
                import psycopg2
                dsn = store._database_url.replace('postgresql+psycopg2://', 'postgresql://', 1)
                self.connection = psycopg2.connect(dsn, connect_timeout=10)
                self.connection.set_session(isolation_level='READ COMMITTED')
                db = _PostgresConnection(self.connection)
                # Snapshot after the preceding lock holder commits, without retries.
                db.execute('SELECT pg_advisory_xact_lock(?)', (_ADVISORY_LOCK,))
            else:
                self.connection = sqlite3.connect(store.path, timeout=10)
                self.connection.row_factory = sqlite3.Row
                db = self.connection
                db.execute('PRAGMA busy_timeout=10000')
                db.execute('BEGIN IMMEDIATE')
            if store._initialized:
                db.execute('DELETE FROM records WHERE expires IS NOT NULL AND expires <= ?', (time.time(),))
                db.execute("DELETE FROM records WHERE kind='grant' AND key NOT IN "
                           "(SELECT grant_id FROM records WHERE kind IN ('code','access','refresh') "
                           "AND grant_id IS NOT NULL)")
            return db
        except BaseException as error:
            self.__exit__(type(error), error, error.__traceback__)
            raise

    def __exit__(self, exception_type, error, traceback):
        try:
            if self.connection is not None:
                if exception_type is None:
                    self.connection.commit()
                else:
                    self.connection.rollback()
        except Exception as database_error:
            if self.store._database_url:
                import psycopg2
                if isinstance(database_error, psycopg2.Error):
                    raise StoreError('PostgreSQL OAuth storage operation failed') from None
            raise
        finally:
            if self.connection is not None:
                self.connection.close()
            self.store._lock.release()
        if self.store._database_url and error is not None:
            import psycopg2
            if isinstance(error, psycopg2.Error):
                raise StoreError('PostgreSQL OAuth storage operation failed') from None
        return False


class OAuthStore:
    def __init__(self, database_path: Path | None, encryption_key: str | bytes, *, database_url: str | None = None):
        self.cipher = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
        self._lock = threading.RLock()
        self._database_url = database_url
        self._initialized = False
        self.path = None
        if database_url:
            try:
                import psycopg2  # noqa: F401
            except ImportError:
                raise StoreError('PostgreSQL OAuth storage requires the postgres installation extra') from None
        else:
            if database_path is None:
                raise StoreError('An OAuth database location is required')
            self.path = Path(database_path).expanduser().absolute()
            ensure_private_directory(self.path.parent)
            if self.path.is_symlink():
                raise StoreError('OAuth database must not be a symbolic link')
            fd = os.open(self.path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
            info = os.fstat(fd)
            os.close(fd)
            if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600 or info.st_uid != os.getuid():
                raise StoreError('OAuth database must be privately owned with permissions 0600')
        with self.transaction() as db:
            binary_type = 'BYTEA' if self._database_url else 'BLOB'
            db.execute(f'''CREATE TABLE IF NOT EXISTS records (
                kind TEXT NOT NULL, key TEXT NOT NULL, payload {binary_type} NOT NULL,
                expires DOUBLE PRECISION, client_id TEXT, grant_id TEXT, resource TEXT,
                PRIMARY KEY (kind, key))''')
            prefix = 'bwc_mcp_oauth_' if self._database_url else ''
            db.execute(f'CREATE INDEX IF NOT EXISTS {prefix}record_grants ON records(grant_id)')
            db.execute(f'CREATE INDEX IF NOT EXISTS {prefix}record_expiry ON records(expires)')
        self._initialized = True

    def transaction(self):
        # Explicit context management supports the SDK's frozen exception classes;
        # contextlib.contextmanager tries assigning their __traceback__ on errors.
        return _Transaction(self)

    def get(self, db, kind: str, key: str) -> dict | None:
        row = db.execute('SELECT payload, expires FROM records WHERE kind=? AND key=?', (kind, key)).fetchone()
        if row is None or (row['expires'] is not None and row['expires'] <= time.time()):
            return None
        try:
            return json.loads(self.cipher.decrypt(bytes(row['payload'])))
        except (InvalidToken, ValueError, TypeError):
            raise StoreError('OAuth state could not be decrypted; verify the configured encryption key') from None

    def put(self, db, kind: str, key: str, payload: dict, *, expires: float | None = None,
            client_id: str | None = None, grant_id: str | None = None, resource: str | None = None) -> None:
        encrypted = self.cipher.encrypt(json.dumps(payload, separators=(',', ':')).encode())
        db.execute('INSERT INTO records (kind,key,payload,expires,client_id,grant_id,resource) VALUES (?,?,?,?,?,?,?) '
                   'ON CONFLICT (kind,key) DO UPDATE SET payload=excluded.payload, expires=excluded.expires, '
                   'client_id=excluded.client_id, grant_id=excluded.grant_id, resource=excluded.resource',
                   (kind, key, encrypted, expires, client_id, grant_id, resource))

    def delete(self, db, kind: str, key: str) -> None:
        db.execute('DELETE FROM records WHERE kind=? AND key=?', (kind, key))

    def revoke_grant(self, db, grant_id: str) -> None:
        db.execute('DELETE FROM records WHERE grant_id=? OR (kind=? AND key=?)', (grant_id, 'grant', grant_id))
