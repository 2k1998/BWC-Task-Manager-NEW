"""Application migrations must not remove separately managed OAuth sessions."""
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Column, MetaData, String, Table, create_engine

from app.core.migration_filters import include_migration_name


def test_autogeneration_preserves_oauth_table_and_still_detects_app_drift():
    engine = create_engine('sqlite://')
    existing = MetaData()
    Table('bwc_mcp_oauth_records', existing, Column('key', String, primary_key=True))
    Table('obsolete_app_table', existing, Column('id', String, primary_key=True))
    existing.create_all(engine)
    with engine.connect() as connection:
        context = MigrationContext.configure(connection, opts={'include_name': include_migration_name})
        differences = compare_metadata(context, MetaData())
    removed = {change[1].name for change in differences if change[0] == 'remove_table'}
    assert 'bwc_mcp_oauth_records' not in removed
    assert 'obsolete_app_table' in removed
