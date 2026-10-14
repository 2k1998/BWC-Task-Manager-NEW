"""Interactive local sign-in; credentials never enter MCP tool arguments."""
import getpass
import sys

import httpx

from .config import Settings
from .session import Session, SessionError, SessionStore, ensure_private_directory


def main() -> None:
    try:
        settings = Settings.from_env()
        store = SessionStore(settings)
        ensure_private_directory(settings.session_file.parent)
        store._validate_file()
        username = input('BWC username or email: ').strip()
        password = getpass.getpass('BWC password: ')
        with httpx.Client(timeout=30, follow_redirects=False) as client:
            response = client.post(settings.api_url + '/auth/login',
                                   json={'username_or_email': username, 'password': password})
        if response.status_code != 200:
            raise ValueError('Login failed; check your account credentials and access')
        payload = response.json()
        store.save(Session(settings.api_origin, payload['access_token'], payload['refresh_token']))
    except (ValueError, KeyError, TypeError, SessionError, httpx.HTTPError, EOFError):
        print('Login failed or private session storage is unavailable. Check configuration and try again.', file=sys.stderr)
        raise SystemExit(1) from None
    print('Signed in. Session saved privately.', file=sys.stderr)


if __name__ == '__main__':
    main()
