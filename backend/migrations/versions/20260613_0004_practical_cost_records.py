"""add practical cost record fields

Revision ID: 20260613_0004
Revises: 20260612_0003
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa


revision = "20260613_0004"
down_revision = "20260612_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "internal_cost_records",
        sa.Column("source_type", sa.String(length=24), nullable=False, server_default="manual"),
    )
    op.add_column("internal_cost_records", sa.Column("source_id", sa.String(length=120), nullable=True))
    op.add_column("internal_cost_records", sa.Column("customer_name", sa.String(length=160), nullable=True))
    op.add_column("internal_cost_records", sa.Column("title", sa.String(length=240), nullable=True))
    op.add_column("internal_cost_records", sa.Column("supplier_name", sa.String(length=160), nullable=True))
    op.add_column(
        "internal_cost_records",
        sa.Column("product_purchase_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "internal_cost_records",
        sa.Column("bml_tax", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "internal_cost_records",
        sa.Column("import_tax", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "internal_cost_records",
        sa.Column("shipping_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "internal_cost_records",
        sa.Column("additional_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "internal_cost_records",
        sa.Column("total_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )

    op.create_index(op.f("ix_internal_cost_records_source_id"), "internal_cost_records", ["source_id"], unique=False)
    op.create_index(op.f("ix_internal_cost_records_source_type"), "internal_cost_records", ["source_type"], unique=False)

    op.execute(
        """
        UPDATE internal_cost_records
        SET
            source_type = CASE
                WHEN linked_order_id IS NOT NULL AND linked_order_id <> '' THEN 'order'
                WHEN linked_request_id IS NOT NULL AND linked_request_id <> '' THEN 'request'
                ELSE 'manual'
            END,
            source_id = COALESCE(NULLIF(linked_order_id, ''), NULLIF(linked_request_id, ''), source_id),
            product_purchase_cost = COALESCE(item_cost, 0),
            bml_tax = COALESCE(payment_fee, 0),
            import_tax = COALESCE(customs_cost, 0),
            shipping_cost = COALESCE(international_shipping_cost, 0) + COALESCE(local_delivery_cost, 0),
            additional_cost = COALESCE(packaging_cost, 0) + COALESCE(other_cost, 0),
            total_cost =
                COALESCE(item_cost, 0)
                + COALESCE(payment_fee, 0)
                + COALESCE(customs_cost, 0)
                + COALESCE(international_shipping_cost, 0)
                + COALESCE(local_delivery_cost, 0)
                + COALESCE(packaging_cost, 0)
                + COALESCE(other_cost, 0)
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_internal_cost_records_source_type"), table_name="internal_cost_records")
    op.drop_index(op.f("ix_internal_cost_records_source_id"), table_name="internal_cost_records")
    op.drop_column("internal_cost_records", "total_cost")
    op.drop_column("internal_cost_records", "additional_cost")
    op.drop_column("internal_cost_records", "shipping_cost")
    op.drop_column("internal_cost_records", "import_tax")
    op.drop_column("internal_cost_records", "bml_tax")
    op.drop_column("internal_cost_records", "product_purchase_cost")
    op.drop_column("internal_cost_records", "supplier_name")
    op.drop_column("internal_cost_records", "title")
    op.drop_column("internal_cost_records", "customer_name")
    op.drop_column("internal_cost_records", "source_id")
    op.drop_column("internal_cost_records", "source_type")
