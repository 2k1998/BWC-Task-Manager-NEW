"""Expand payment_type CHECK constraint to include fuel/car_washing/coffee_meals/parking

Revision ID: 028_expand_payment_type_constraint
Revises: 027_add_document_source
Create Date: 2026-06-19

"""
from alembic import op

OLD_VALUES = ('salary', 'commission', 'bonus', 'rent', 'bill', 'purchase', 'service')
NEW_VALUES = ('salary', 'commission', 'bonus', 'rent', 'bill', 'purchase', 'service',
              'fuel', 'car_washing', 'coffee_meals', 'parking')

revision = '028_payment_type_expand'
down_revision = '027_add_document_source'
branch_labels = None
depends_on = None


def _values_sql(values):
    return ', '.join(f"'{v}'" for v in values)


def upgrade():
    op.drop_constraint('check_payment_type', 'payments', type_='check')
    op.create_check_constraint(
        'check_payment_type',
        'payments',
        f"payment_type IN ({_values_sql(NEW_VALUES)})",
    )


def downgrade():
    op.drop_constraint('check_payment_type', 'payments', type_='check')
    op.create_check_constraint(
        'check_payment_type',
        'payments',
        f"payment_type IN ({_values_sql(OLD_VALUES)})",
    )
