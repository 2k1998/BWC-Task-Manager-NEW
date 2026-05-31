"""024_add_chatbot

Revision ID: 024_add_chatbot
Revises: 023_add_user_parent_hierarchy
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '024_add_chatbot'
down_revision = '023_add_user_parent_hierarchy'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'chatbot_conversations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_chatbot_conversations_user_id', 'chatbot_conversations', ['user_id'])

    op.create_table(
        'chatbot_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('chatbot_conversations.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text, nullable=True),
        sa.Column('tool_calls', postgresql.JSONB, nullable=True),
        sa.Column('tool_call_id', sa.String(255), nullable=True),
        sa.Column('tool_name', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_chatbot_messages_conversation_id', 'chatbot_messages', ['conversation_id'])
    op.create_index('ix_chatbot_messages_created_at', 'chatbot_messages', ['created_at'])

    op.create_table(
        'chatbot_knowledge',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('topic', sa.String(255), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('tags', postgresql.ARRAY(sa.String), nullable=False, server_default='{}'),
        sa.Column('language', sa.String(5), nullable=False, server_default='en'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_chatbot_knowledge_language', 'chatbot_knowledge', ['language'])
    op.create_index('ix_chatbot_knowledge_tags', 'chatbot_knowledge', ['tags'], postgresql_using='gin')

    op.create_table(
        'user_onboarding_progress',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('tour_id', sa.String(100), nullable=False),
        sa.Column('step_index', sa.Integer, nullable=False, server_default='0'),
        sa.Column('completed', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('skipped', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'tour_id', name='uq_user_tour'),
    )
    op.create_index('ix_user_onboarding_progress_user_id', 'user_onboarding_progress', ['user_id'])


def downgrade():
    op.drop_index('ix_user_onboarding_progress_user_id', 'user_onboarding_progress')
    op.drop_table('user_onboarding_progress')
    op.drop_index('ix_chatbot_knowledge_tags', 'chatbot_knowledge')
    op.drop_index('ix_chatbot_knowledge_language', 'chatbot_knowledge')
    op.drop_table('chatbot_knowledge')
    op.drop_index('ix_chatbot_messages_created_at', 'chatbot_messages')
    op.drop_index('ix_chatbot_messages_conversation_id', 'chatbot_messages')
    op.drop_table('chatbot_messages')
    op.drop_index('ix_chatbot_conversations_user_id', 'chatbot_conversations')
    op.drop_table('chatbot_conversations')
