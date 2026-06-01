"""drop force_password_change column from users

Revision ID: 026_drop_force_password_change
Revises: 025_fix_user_permissions_schema
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = '026_drop_force_password_change'
down_revision = '025_fix_user_permissions_schema'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column('users', 'force_password_change')


def downgrade():
    op.add_column(
        'users',
        sa.Column('force_password_change', sa.Boolean(), nullable=False, server_default='false')
    )
