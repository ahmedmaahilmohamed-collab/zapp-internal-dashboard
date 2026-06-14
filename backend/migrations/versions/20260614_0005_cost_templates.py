"""add cost templates

Revision ID: 20260614_0005
Revises: 20260613_0004
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa


revision = "20260614_0005"
down_revision = "20260613_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cost_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("default_bml_tax", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("default_import_tax", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("default_shipping_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("default_additional_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("default_margin_percent", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="MVR"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_cost_templates_id"), "cost_templates", ["id"], unique=False)
    op.create_index(op.f("ix_cost_templates_name"), "cost_templates", ["name"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_cost_templates_name"), table_name="cost_templates")
    op.drop_index(op.f("ix_cost_templates_id"), table_name="cost_templates")
    op.drop_table("cost_templates")
