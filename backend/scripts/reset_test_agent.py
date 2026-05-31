"""
Reset the password of the first Agent user to 'TestAgent123' and print their stats.
Run from the backend/ directory:
    .venv\Scripts\python scripts\reset_test_agent.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure 'app' package is importable when running from backend/
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.contact import Contact
from app.models.task import Task
from app.models.user import User
from app.utils.hierarchy import get_descendant_ids

TEST_PASSWORD = "TestAgent123"


def main() -> None:
    db = SessionLocal()
    try:
        agent = (
            db.query(User)
            .filter(User.user_type == "Agent", User.is_active == True)
            .order_by(User.created_at.asc())
            .first()
        )

        if agent is None:
            print("NO_AGENT_FOUND")
            sys.exit(1)

        # Reset password using the project's own hashing function
        agent.hashed_password = hash_password(TEST_PASSWORD)
        db.commit()

        # Counts
        tasks_assigned = (
            db.query(Task)
            .filter(Task.assigned_user_id == agent.id, Task.deleted_at.is_(None))
            .count()
        )
        tasks_owned = (
            db.query(Task)
            .filter(Task.owner_user_id == agent.id, Task.deleted_at.is_(None))
            .count()
        )
        descendants = get_descendant_ids(agent.id, db)
        contacts_owned = (
            db.query(Contact)
            .filter(Contact.user_id == agent.id)
            .count()
        )

        print("=" * 60)
        print("TEST AGENT PROVISIONED")
        print("=" * 60)
        print(f"email        : {agent.email}")
        print(f"user_type    : {agent.user_type}")
        print(f"parent_id    : {agent.parent_id}")
        print(f"id           : {agent.id}")
        print(f"tasks assigned (assigned_user_id == agent, not deleted): {tasks_assigned}")
        print(f"tasks owned   (owner_user_id == agent, not deleted):     {tasks_owned}")
        print(f"descendants   : {len(descendants)}")
        print(f"contacts owned (user_id == agent):                       {contacts_owned}")
        print("=" * 60)
        print(f"Password reset to: {TEST_PASSWORD}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
