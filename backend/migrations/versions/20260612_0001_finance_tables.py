"""create finance tables

Revision ID: 20260612_0001
Revises:
Create Date: 2026-06-12
"""

from alembic import op
import sqlalchemy as sa

revision = "20260612_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "currencies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=8), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("symbol", sa.String(length=12), nullable=False),
        sa.Column("exchange_rate_to_base", sa.Numeric(18, 6), nullable=False),
        sa.Column("is_base", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_currencies_code"), "currencies", ["code"], unique=False)
    op.create_index(op.f("ix_currencies_id"), "currencies", ["id"], unique=False)

    op.create_table(
        "shipping_rate_cards",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("origin_country", sa.String(length=80), nullable=False),
        sa.Column("destination_country", sa.String(length=80), nullable=False),
        sa.Column("carrier", sa.String(length=120), nullable=False),
        sa.Column("service_level", sa.String(length=120), nullable=False),
        sa.Column("min_weight", sa.Numeric(12, 3), nullable=False),
        sa.Column("max_weight", sa.Numeric(12, 3), nullable=False),
        sa.Column("rate", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("estimated_days_min", sa.Integer(), nullable=True),
        sa.Column("estimated_days_max", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_shipping_rate_cards_id"), "shipping_rate_cards", ["id"], unique=False)

    op.create_table(
        "internal_cost_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("linked_order_id", sa.String(length=120), nullable=True),
        sa.Column("linked_request_id", sa.String(length=120), nullable=True),
        sa.Column("reference_label", sa.String(length=160), nullable=True),
        sa.Column("item_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("international_shipping_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("local_delivery_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("customs_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_fee", sa.Numeric(12, 2), nullable=False),
        sa.Column("packaging_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("other_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("sale_total", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("profit", sa.Numeric(12, 2), nullable=False),
        sa.Column("margin_percent", sa.Numeric(8, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_internal_cost_records_id"), "internal_cost_records", ["id"], unique=False)
    op.create_index(op.f("ix_internal_cost_records_linked_order_id"), "internal_cost_records", ["linked_order_id"], unique=False)
    op.create_index(op.f("ix_internal_cost_records_linked_request_id"), "internal_cost_records", ["linked_request_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_internal_cost_records_linked_request_id"), table_name="internal_cost_records")
    op.drop_index(op.f("ix_internal_cost_records_linked_order_id"), table_name="internal_cost_records")
    op.drop_index(op.f("ix_internal_cost_records_id"), table_name="internal_cost_records")
    op.drop_table("internal_cost_records")
    op.drop_index(op.f("ix_shipping_rate_cards_id"), table_name="shipping_rate_cards")
    op.drop_table("shipping_rate_cards")
    op.drop_index(op.f("ix_currencies_id"), table_name="currencies")
    op.drop_index(op.f("ix_currencies_code"), table_name="currencies")
    op.drop_table("currencies")
