"""Link rental and sale income payments to cars.

Revision ID: 030_payment_car_income
Revises: 029_group_chat
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "030_payment_car_income"
down_revision = "029_group_chat"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("income_source", sa.Text(), nullable=True))
    op.add_column("payments", sa.Column("car_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_payments_car_id_cars", "payments", "cars", ["car_id"], ["id"], ondelete="RESTRICT"
    )
    op.create_index("ix_payments_car_id", "payments", ["car_id"])
    op.create_check_constraint(
        "check_payment_car_income", "payments",
        "(income_source IS NULL AND car_id IS NULL) OR "
        "(is_income = true AND income_source IS NOT NULL AND "
        "income_source IN ('car_rental', 'car_sale') AND car_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("check_payment_car_income", "payments", type_="check")
    op.drop_index("ix_payments_car_id", table_name="payments")
    op.drop_constraint("fk_payments_car_id_cars", "payments", type_="foreignkey")
    op.drop_column("payments", "car_id")
    op.drop_column("payments", "income_source")
