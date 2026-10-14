"""Add Operations and training departments without altering existing departments.

Revision ID: 031_operations_training_depts
Revises: 030_payment_car_income
"""
from datetime import datetime, timezone
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "031_operations_training_depts"
down_revision = "030_payment_car_income"
branch_labels = None
depends_on = None


def upgrade() -> None:
    departments = sa.table(
        "departments",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String()),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    for name in ("Operations", "Εκπαίδευση"):
        op.execute(
            postgresql.insert(departments)
            .values(id=uuid.uuid4(), name=name, created_at=datetime.now(timezone.utc))
            .on_conflict_do_nothing(index_elements=["name"])
        )


def downgrade() -> None:
    # Tasks may already reference these values; matching rows may also predate
    # the migration, so rolling back must preserve all department data.
    pass
