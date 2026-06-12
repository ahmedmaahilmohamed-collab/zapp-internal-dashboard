"""create user access table

Revision ID: 20260612_0002
Revises: 20260612_0001
Create Date: 2026-06-12
"""

from alembic import op
import sqlalchemy as sa

revision = "20260612_0002"
down_revision = "20260612_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_access",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=24), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_user_access_email"), "user_access", ["email"], unique=False)
    op.create_index(op.f("ix_user_access_id"), "user_access", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_access_id"), table_name="user_access")
    op.drop_index(op.f("ix_user_access_email"), table_name="user_access")
    op.drop_table("user_access")
