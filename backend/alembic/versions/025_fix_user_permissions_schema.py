"""025_fix_user_permissions_schema

LOCAL-ONLY FIX — safe to run on production (no-op if schema is already correct).

Context: the local dev DB had a legacy user_permissions table with columns
  (permission_name, granted_at) from a pre-migration era. Production already
  has the correct schema (module, access_level) because migration
  20260430_add_user_permissions ran as part of the 023 ancestry chain.

This upgrade is therefore conditional:
  - If the table has the legacy 'permission_name' column → drop and recreate
    (local dev only; the 1 legacy row maps to no valid module/access_level pair)
  - If the table already has 'module' → skip entirely (production path)

Revision ID: 025_fix_user_permissions_schema
Revises: 024_add_chatbot
Create Date: 2026-05-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "025_fix_user_permissions_schema"
down_revision = "024_add_chatbot"
branch_labels = None
depends_on = None


def _has_legacy_schema(conn) -> bool:
    """Return True only when the table has the old 'permission_name' column."""
    insp = sa_inspect(conn)
    col_names = {c["name"] for c in insp.get_columns("user_permissions")}
    return "permission_name" in col_names and "module" not in col_names


def upgrade() -> None:
    conn = op.get_bind()

    if not _has_legacy_schema(conn):
        # Production path: new schema already present — nothing to do.
        return

    # Local-dev path: replace the legacy table.
    op.drop_index("ix_user_permissions_user_id", table_name="user_permissions", if_exists=True)
    op.drop_table("user_permissions")

    # Recreate with the schema defined in app.models.permission.UserPermission
    op.create_table(
        "user_permissions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("module", sa.String(), nullable=False),
        sa.Column("access_level", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "module IN ('tasks','contacts','companies','projects','cars','analytics','payments','documents')",
            name="ck_user_permissions_module",
        ),
        sa.CheckConstraint(
            "access_level IN ('none','view','edit','delete')",
            name="ck_user_permissions_access_level",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "module", name="uq_user_permissions_user_module"),
    )
    op.create_index("ix_user_permissions_user_id", "user_permissions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_permissions_user_id", table_name="user_permissions")
    op.drop_table("user_permissions")
    # Restore legacy schema
    op.create_table(
        "user_permissions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("permission_name", sa.String(), nullable=False),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_permissions_user_id", "user_permissions", ["user_id"], unique=False)
