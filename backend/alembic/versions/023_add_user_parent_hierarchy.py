"""add_user_parent_hierarchy

Revision ID: 023_add_user_parent_hierarchy
Revises: 20260430_add_user_permissions
Create Date: 2026-05-22

Adds parent_id self-FK for hierarchical user tree and enforces user_type values.
Requires at least one Admin user for non-Admin parent_id backfill.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "023_add_user_parent_hierarchy"
down_revision = "20260430_add_user_permissions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Normalize legacy user_type values before adding CHECK constraint
    op.execute(
        """
        UPDATE users SET user_type = 'Agent'
        WHERE user_type NOT IN ('Admin', 'Pillar', 'Manager', 'Head', 'Agent')
        """
    )

    op.add_column(
        "users",
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_foreign_key(
        "fk_users_parent_id_users",
        "users",
        "users",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index("ix_users_parent_id", "users", ["parent_id"], unique=False)

    # Backfill: attach all non-Admin users under the first Admin (if one exists)
    op.execute(
        """
        UPDATE users
        SET parent_id = (SELECT id FROM users WHERE user_type = 'Admin' LIMIT 1)
        WHERE user_type != 'Admin'
        """
    )

    op.create_check_constraint(
        "ck_users_user_type",
        "users",
        "user_type IN ('Admin', 'Pillar', 'Manager', 'Head', 'Agent')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_user_type", "users", type_="check")
    op.drop_index("ix_users_parent_id", table_name="users")
    op.drop_constraint("fk_users_parent_id_users", "users", type_="foreignkey")
    op.drop_column("users", "parent_id")
