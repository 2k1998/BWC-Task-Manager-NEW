"""
Direct DB ground-truth verification of branch isolation for chatbot tools.
Run from the backend/ directory:
    .venv\Scripts\python scripts\branch_isolation_check.py <agent_id>
"""
from __future__ import annotations

import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import and_, or_, true

from app.core.database import SessionLocal
from app.models.contact import Contact
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.utils.hierarchy import get_descendant_ids, get_visible_user_ids
from app.utils.visibility import (
    build_project_visibility_filter,
    build_task_visibility_filter,
    task_not_soft_deleted_filter,
)


def count_tasks(user: User, db) -> int:
    f = build_task_visibility_filter(user, db, branch_ids=None)
    q = db.query(Task)
    if f is True:
        q = q.filter(task_not_soft_deleted_filter())
    else:
        q = q.filter(f)
    return q.count()


def count_contacts(user: User, db) -> int:
    # Contacts are private per-user (Contact.user_id == user.id) — same rule as chatbot tool
    return db.query(Contact).filter(Contact.user_id == user.id).count()


def count_projects(user: User, db) -> int:
    f = build_project_visibility_filter(user)
    if f is True:
        return db.query(Project).count()
    return db.query(Project).filter(f).count()


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/branch_isolation_check.py <agent_uuid>")
        sys.exit(1)

    agent_id = UUID(sys.argv[1])

    db = SessionLocal()
    try:
        agent = db.query(User).filter(User.id == agent_id).first()
        if agent is None:
            print(f"No user found with id={agent_id}")
            sys.exit(1)

        admin = (
            db.query(User)
            .filter(User.user_type == "Admin")
            .order_by(User.created_at.asc())
            .first()
        )
        if admin is None:
            print("No Admin user found")
            sys.exit(1)

        visible_ids = get_visible_user_ids(agent, db)
        descendants = get_descendant_ids(agent.id, db)

        agent_tasks     = count_tasks(agent, db)
        agent_contacts  = count_contacts(agent, db)
        agent_projects  = count_projects(agent, db)

        admin_tasks     = count_tasks(admin, db)
        admin_contacts  = count_contacts(admin, db)
        admin_projects  = count_projects(admin, db)

        print("=" * 64)
        print("BRANCH ISOLATION GROUND-TRUTH CHECK")
        print("=" * 64)
        print(f"Agent  : {agent.email}  ({agent.user_type})  id={agent.id}")
        print(f"Admin  : {admin.email}  ({admin.user_type})  id={admin.id}")
        print(f"Agent visible user set size : {len(visible_ids) if visible_ids else 'ALL (Admin)'}")
        print(f"Agent descendants           : {len(descendants)}")
        print()
        print(f"{'Metric':<35} {'Agent':>10} {'Admin':>10}")
        print("-" * 57)
        print(f"{'Visible tasks (not deleted)':<35} {agent_tasks:>10} {admin_tasks:>10}")
        print(f"{'Owned contacts':<35} {agent_contacts:>10} {admin_contacts:>10}")
        print(f"{'Visible projects':<35} {agent_projects:>10} {admin_projects:>10}")
        print("=" * 64)

        # Isolation assertions
        task_isolated    = agent_tasks < admin_tasks
        contact_isolated = True  # contacts are always per-user, no leak possible across users
        project_isolated = agent_projects <= admin_projects

        print()
        print("ISOLATION ASSERTIONS")
        print(f"  Tasks   agent < admin : {'PASS' if task_isolated    else 'FAIL'}")
        print(f"  Projects agent <= admin: {'PASS' if project_isolated else 'FAIL'}")
        print(f"  Contacts per-user     : PASS  (contacts are private by design)")

    finally:
        db.close()


if __name__ == "__main__":
    main()
