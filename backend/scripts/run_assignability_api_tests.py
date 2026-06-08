"""
Backend API tests for assignability E2E (Phase 1 + 3 + partial cleanup).

Run from backend/ after setup_assignability_test.py setup:
    .venv\\Scripts\\python scripts/run_assignability_api_tests.py
"""
from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal
from app.models.company import Company
from app.models.department import Department
from app.models.task import Task
from app.models.user import User
from app.utils.hierarchy import get_organization_admin

BASE = "http://127.0.0.1:8000"
STATE_FILE = Path(__file__).parent / ".assignability_test_state.json"
ADMIN_EMAIL = "kabaniskostas1998@gmail.com"
ADMIN_PASS = "Administrator"
AGENT_EMAIL = "phase8_test@example.com"
AGENT_PASS = "TestAgent123"

results: dict[str, str] = {}
created_task_id: str | None = None
promo_id: str | None = None


def login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE}/auth/login",
        json={"username_or_email": email, "password": password},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def record(key: str, ok: bool, detail: str = "") -> None:
    results[key] = ("PASS" if ok else "FAIL") + (f" — {detail}" if detail else "")
    status = "OK" if ok else "FAIL"
    print(f"  [{status}] {key}: {results[key]}")


def main() -> int:
    global created_task_id, promo_id

    if not STATE_FILE.exists():
        print("ERROR: run setup_assignability_test.py setup first", file=sys.stderr)
        return 1

    state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    new_parent_id = state["new_parent_id"]

    print("=== P1.1-P1.2 Login ===")
    admin_token = login(ADMIN_EMAIL, ADMIN_PASS)
    agent_token = login(AGENT_EMAIL, AGENT_PASS)
    print("  Logins OK")

    print("\n=== P1.3 Admin assignable ===")
    r = requests.get(f"{BASE}/users/assignable", headers=hdr(admin_token), timeout=30)
    n_admin = len(r.json()) if r.status_code == 200 else 0
    record("P1.3", r.status_code == 200, f"N={n_admin}")

    print("\n=== P1.4 Agent assignable ===")
    r = requests.get(f"{BASE}/users/assignable", headers=hdr(agent_token), timeout=30)
    agent_list = r.json() if r.status_code == 200 else []
    n_agent = len(agent_list)
    types = sorted({u["user_type"] for u in agent_list})
    parent_in = any(u["id"] == new_parent_id for u in agent_list)
    record("P1.4_count", r.status_code == 200 and n_agent > 1, f"N={n_agent}, types={types}")
    record("P1.4_parent", parent_in, state["new_parent_email"])

    # Cross-branch check via DB
    db = SessionLocal()
    try:
        agent_user = db.query(User).filter(User.email == AGENT_EMAIL).first()
        agent_org_admin = get_organization_admin(agent_user, db)
        cross_user = None
        for u in db.query(User).filter(User.is_active == True, User.id != agent_user.id).all():
            other_org_admin = get_organization_admin(u, db)
            if other_org_admin and agent_org_admin and other_org_admin.id != agent_org_admin.id:
                cross_user = u
                break
        if cross_user:
            cross_in = any(str(u["id"]) == str(cross_user.id) for u in agent_list)
            record("P1.4_cross", not cross_in, f"excluded {cross_user.email}")
        else:
            results["P1.4_cross"] = "SKIP — only one branch in local DB"
            print(f"  [SKIP] P1.4_cross: {results['P1.4_cross']}")
    finally:
        db.close()

    print("\n=== P1.5 Assign upward ===")
    db = SessionLocal()
    try:
        company = db.query(Company).first()
        dept = db.query(Department).first()
        company_id = str(company.id) if company else None
        dept_name = dept.name if dept else "General"
    finally:
        db.close()

    today = date.today()
    payload = {
        "title": "E2E test: assign upward",
        "description": "assignability e2e",
        "company_id": company_id,
        "department": dept_name,
        "urgency_label": "Not Urgent & Not Important",
        "start_date": today.isoformat(),
        "deadline": (today + timedelta(days=7)).isoformat(),
        "assigned_user_id": new_parent_id,
    }
    r = requests.post(f"{BASE}/tasks", json=payload, headers=hdr(agent_token), timeout=30)
    if r.status_code in (200, 201):
        created_task_id = r.json().get("id") or r.json().get("task_id")
        if not created_task_id and isinstance(r.json(), dict):
            created_task_id = r.json().get("id")
        record("P1.5", True, f"task_id={created_task_id}")
    else:
        record("P1.5", False, f"status={r.status_code} body={r.text[:300]}")

    print("\n=== P1.6 Cross-branch assign (must fail) ===")
    db = SessionLocal()
    try:
        agent_user = db.query(User).filter(User.email == AGENT_EMAIL).first()
        agent_org_admin = get_organization_admin(agent_user, db)
        cross_user = None
        for u in db.query(User).filter(User.is_active == True, User.id != agent_user.id).all():
            other_org_admin = get_organization_admin(u, db)
            if other_org_admin and agent_org_admin and other_org_admin.id != agent_org_admin.id:
                cross_user = u
                break
        if cross_user:
            bad_payload = {**payload, "title": "E2E cross-branch", "assigned_user_id": str(cross_user.id)}
            r = requests.post(f"{BASE}/tasks", json=bad_payload, headers=hdr(agent_token), timeout=30)
            record("P1.6", r.status_code == 403, f"status={r.status_code}")
        else:
            results["P1.6"] = "SKIP — only one branch in local DB"
            print(f"  [SKIP] P1.6: {results['P1.6']}")
    finally:
        db.close()

    print("\n=== P1.7 Departments as agent ===")
    r = requests.get(f"{BASE}/departments", headers=hdr(agent_token), timeout=30)
    record("P1.7", r.status_code == 200, f"count={len(r.json()) if r.status_code == 200 else 0}")

    print("\n=== P1.8 Admin promotion ===")
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        admin_id = str(admin_user.id)
    finally:
        db.close()

    promo_email = f"e2e_promote_{int(__import__('time').time())}@example.com"
    promo_username = f"e2e_promote_{int(__import__('time').time())}"
    create_body = {
        "email": promo_email,
        "username": promo_username,
        "first_name": "E2E",
        "last_name": "Promote Test",
        "user_type": "Agent",
        "parent_id": admin_id,
    }
    r = requests.post(f"{BASE}/admin/users", json=create_body, headers=hdr(admin_token), timeout=30)
    if r.status_code == 201:
        promo_id = str(r.json().get("user_id") or r.json().get("id"))
        r2 = requests.patch(
            f"{BASE}/admin/users/{promo_id}",
            json={"user_type": "Admin"},
            headers=hdr(admin_token),
            timeout=30,
        )
        r3 = requests.get(f"{BASE}/admin/users/{promo_id}", headers=hdr(admin_token), timeout=30)
        promoted = r3.json().get("user_type") == "Admin" if r3.status_code == 200 else False
        record("P1.8", r2.status_code == 200 and promoted, f"promo_id={promo_id}")
        requests.patch(
            f"{BASE}/admin/users/{promo_id}",
            json={"is_active": False},
            headers=hdr(admin_token),
            timeout=30,
        )
    else:
        record("P1.8", False, f"create status={r.status_code} {r.text[:200]}")

    print("\n=== P1.9 Non-admin promotion attempt ===")
    db = SessionLocal()
    try:
        other = (
            db.query(User)
            .filter(User.email != AGENT_EMAIL, User.is_active == True)
            .first()
        )
        other_id = str(other.id) if other else None
    finally:
        db.close()

    if other_id:
        r = requests.patch(
            f"{BASE}/admin/users/{other_id}",
            json={"user_type": "Admin"},
            headers=hdr(agent_token),
            timeout=30,
        )
        record("P1.9", r.status_code in (401, 403, 400), f"status={r.status_code}")
    else:
        record("P1.9", True, "no other user to target")

    print("\n=== P3.1 Visibility regression ===")
    r = requests.get(f"{BASE}/tasks", headers=hdr(agent_token), timeout=30)
    tasks = r.json()
    if isinstance(tasks, dict):
        tasks = tasks.get("tasks") or tasks.get("items") or []
    task_ids = [t.get("id") for t in tasks]
    upward_visible = created_task_id in task_ids if created_task_id else None

    db = SessionLocal()
    try:
        parent_user = db.query(User).filter(User.id == new_parent_id).first()
        ancestor_owned = (
            db.query(Task)
            .filter(
                Task.owner_user_id == parent_user.id,
                Task.deleted_at.is_(None),
            )
            .limit(5)
            .all()
        )
        leaked = []
        for t in ancestor_owned:
            if str(t.id) not in (created_task_id or ""):
                if str(t.id) in [str(x) for x in task_ids]:
                    leaked.append(str(t.id))
        if not ancestor_owned:
            results["P3.1"] = "PASS — no ancestor-owned tasks in local DB to leak-check"
            print(f"  [OK] P3.1: {results['P3.1']}")
        else:
            record("P3.1", len(leaked) == 0, f"leaked={leaked}, own_upward_task_visible={upward_visible}")
    finally:
        db.close()

    # Write results for report
    out = Path(__file__).parent / ".assignability_api_results.json"
    out.write_text(
        json.dumps(
            {
                "results": results,
                "n_admin": n_admin,
                "n_agent": n_agent,
                "created_task_id": created_task_id,
                "state": state,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nResults written to {out}")
    fails = sum(1 for v in results.values() if v.startswith("FAIL"))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
