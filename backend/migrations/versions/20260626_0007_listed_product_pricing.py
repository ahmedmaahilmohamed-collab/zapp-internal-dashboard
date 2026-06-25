"""add listed product pricing records

Revision ID: 20260626_0007
Revises: 20260617_0006
Create Date: 2026-06-26
"""

from alembic import op
import sqlalchemy as sa


revision = "20260626_0007"
down_revision = "20260617_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "listed_product_pricing_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("shop", sa.String(length=255), nullable=False),
        sa.Column("product_id", sa.String(length=255), nullable=False),
        sa.Column("product_legacy_id", sa.String(length=80), nullable=True),
        sa.Column("product_title", sa.String(length=255), nullable=False),
        sa.Column("product_handle", sa.String(length=255), nullable=True),
        sa.Column("product_image_url", sa.Text(), nullable=True),
        sa.Column("variant_id", sa.String(length=255), nullable=True),
        sa.Column("variant_legacy_id", sa.String(length=80), nullable=True),
        sa.Column("variant_title", sa.String(length=255), nullable=True),
        sa.Column("variant_sku", sa.String(length=120), nullable=True),
        sa.Column("pricing_scope", sa.String(length=32), nullable=False, server_default="all_variants"),
        sa.Column("source_currency", sa.String(length=8), nullable=False),
        sa.Column("target_currency", sa.String(length=8), nullable=False),
        sa.Column("item_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("product_weight", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("desired_margin_percent", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("payment_fee_percent", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("total_landed_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("payment_fee_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("expected_profit", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("recommended_sale_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("final_rounded_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("input_snapshot", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("result_snapshot", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_listed_product_pricing_records_id"), "listed_product_pricing_records", ["id"], unique=False)
    op.create_index(op.f("ix_listed_product_pricing_records_shop"), "listed_product_pricing_records", ["shop"], unique=False)
    op.create_index(op.f("ix_listed_product_pricing_records_product_id"), "listed_product_pricing_records", ["product_id"], unique=False)
    op.create_index(op.f("ix_listed_product_pricing_records_product_legacy_id"), "listed_product_pricing_records", ["product_legacy_id"], unique=False)
    op.create_index(op.f("ix_listed_product_pricing_records_variant_id"), "listed_product_pricing_records", ["variant_id"], unique=False)
    op.create_index(op.f("ix_listed_product_pricing_records_variant_legacy_id"), "listed_product_pricing_records", ["variant_legacy_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_listed_product_pricing_records_variant_legacy_id"), table_name="listed_product_pricing_records")
    op.drop_index(op.f("ix_listed_product_pricing_records_variant_id"), table_name="listed_product_pricing_records")
    op.drop_index(op.f("ix_listed_product_pricing_records_product_legacy_id"), table_name="listed_product_pricing_records")
    op.drop_index(op.f("ix_listed_product_pricing_records_product_id"), table_name="listed_product_pricing_records")
    op.drop_index(op.f("ix_listed_product_pricing_records_shop"), table_name="listed_product_pricing_records")
    op.drop_index(op.f("ix_listed_product_pricing_records_id"), table_name="listed_product_pricing_records")
    op.drop_table("listed_product_pricing_records")
