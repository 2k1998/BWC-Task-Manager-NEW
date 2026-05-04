"""add_user_permissions_table

Revision ID: 20260430_add_user_permissions
Revises: 9820f9a6414a
Create Date: 2026-04-30 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260430_add_user_permissions"
down_revision = "9820f9a6414a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_permissions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("module", sa.String(), nullable=False),
        sa.Column("access_level", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "module IN ('tasks', 'contacts', 'companies', 'projects', 'cars', 'analytics', 'payments', 'documents')",
            name="ck_user_permissions_module",
        ),
        sa.CheckConstraint(
            "access_level IN ('none', 'view', 'edit', 'delete')",
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
