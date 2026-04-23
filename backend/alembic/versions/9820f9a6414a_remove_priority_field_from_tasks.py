"""remove_priority_field_from_tasks

Revision ID: 9820f9a6414a
Revises: 022_user_profiles_language
Create Date: 2026-04-23 14:10:46.558260

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9820f9a6414a'
down_revision = '022_user_profiles_language'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('tasks', 'priority')


def downgrade() -> None:
    op.add_column('tasks', sa.Column('priority', sa.TEXT(), autoincrement=False, nullable=False))
