"""Add source column to documents table

Revision ID: 027_add_document_source
Revises: 026_drop_force_password_change
Create Date: 2026-06-08

"""
from alembic import op
import sqlalchemy as sa

revision = "027_add_document_source"
down_revision = "026_drop_force_password_change"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("source", sa.String(length=32), nullable=True),
    )

    # Backfill from junction / reference tables (task wins over chat if both exist).
    op.execute(
        """
        UPDATE documents d
        SET source = 'task'
        WHERE EXISTS (
            SELECT 1 FROM task_documents td WHERE td.document_id = d.id
        )
        """
    )
    op.execute(
        """
        UPDATE documents d
        SET source = 'call_note'
        WHERE source IS NULL
          AND EXISTS (
            SELECT 1 FROM call_notes_files cnf WHERE cnf.file_id = d.id
        )
        """
    )
    op.execute(
        """
        UPDATE documents d
        SET source = 'chat'
        WHERE source IS NULL
          AND EXISTS (
            SELECT 1 FROM chat_messages cm WHERE cm.file_id = d.id
        )
        """
    )
    op.execute("UPDATE documents SET source = 'document' WHERE source IS NULL")

    op.alter_column("documents", "source", nullable=False, server_default="document")


def downgrade() -> None:
    op.drop_column("documents", "source")
