"""
Defense-in-depth tests for the permanent rule:
"Passwords are admin-controlled only."

See CLAUDE.md "Permanent product rules". These tests MUST stay passing.
If any test here fails, do NOT delete or weaken the test — instead, remove
the offending code that violated the rule.

The single allowed password mutation endpoint is:
    POST /admin/users/{user_id}/reset-password
Everything else is a violation.
"""

ALLOWED_PASSWORD_PATHS = {
    "/admin/users/{user_id}/reset-password",
}


def test_no_user_initiated_password_endpoints():
    from app.main import app

    violations = []
    for route in app.routes:
        path = getattr(route, "path", "")
        methods = getattr(route, "methods", None)
        if not methods:
            continue
        if "password" not in path.lower():
            continue
        if path in ALLOWED_PASSWORD_PATHS:
            continue
        violations.append(f"{','.join(sorted(methods))} {path}")

    assert not violations, (
        f"Forbidden password endpoints found: {violations}. "
        "Passwords are admin-controlled only — see CLAUDE.md permanent rules."
    )


def test_no_change_password_schemas():
    import re
    import importlib
    import pkgutil
    import inspect as _inspect
    import app.schemas as schemas_pkg

    forbidden_patterns = [
        re.compile(r".*ChangePassword.*", re.IGNORECASE),
        re.compile(r".*UpdatePassword.*", re.IGNORECASE),
        re.compile(r".*PasswordChange.*", re.IGNORECASE),
        re.compile(r".*PasswordUpdate.*", re.IGNORECASE),
        re.compile(r".*SetPassword.*", re.IGNORECASE),
    ]

    violations = []
    for _, modname, _ in pkgutil.iter_modules(schemas_pkg.__path__):
        module = importlib.import_module(f"app.schemas.{modname}")
        for attr_name, attr in _inspect.getmembers(module, _inspect.isclass):
            if attr.__module__ != module.__name__:
                continue
            for pattern in forbidden_patterns:
                if pattern.match(attr_name):
                    violations.append(f"{modname}.{attr_name}")
                    break

    assert not violations, (
        f"Forbidden password schemas found: {violations}. "
        "ChangePasswordRequest etc. were removed in migration 026 — do not re-introduce."
    )


def test_no_force_password_change_column():
    import pytest
    from app.core.database import engine
    from sqlalchemy import inspect

    try:
        inspector = inspect(engine)
        columns = [c["name"] for c in inspector.get_columns("users")]
    except Exception as e:
        pytest.skip(f"Cannot connect to DB: {e}")

    assert "force_password_change" not in columns, (
        "force_password_change column resurfaced in users table. "
        "Dropped in migration 026 — do not re-introduce. See CLAUDE.md."
    )


def test_no_force_password_change_in_user_response():
    from app.schemas.user import UserResponse

    fields = set(UserResponse.model_fields.keys())

    assert "force_password_change" not in fields, (
        "force_password_change reappeared in UserResponse schema. "
        "Removed during password-admin-only refactor — do not re-introduce."
    )


def test_no_frontend_password_routes():
    import os
    import pytest
    from pathlib import Path

    repo_root = Path(__file__).resolve().parent.parent.parent
    frontend_app = repo_root / "frontend" / "app"

    if not frontend_app.exists():
        pytest.skip(f"Frontend app dir not found at {frontend_app}")

    forbidden_dir_names = {
        "change-password",
        "reset-password",
        "forgot-password",
        "set-password",
        "new-password",
    }

    violations = []
    for dirpath, dirnames, _ in os.walk(frontend_app):
        for dirname in dirnames:
            if dirname.lower() in forbidden_dir_names:
                full_path = Path(dirpath) / dirname
                relative = full_path.relative_to(repo_root)
                if "admin" in str(relative).lower().replace("\\", "/").split("/"):
                    continue
                violations.append(str(relative))

    assert not violations, (
        f"User-side password routes found in frontend: {violations}. "
        "Admin uses the password-display modal on the admin users page — no other password UI allowed."
    )
