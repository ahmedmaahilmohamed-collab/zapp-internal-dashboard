"""add local email log deletion markers

Revision ID: 20260617_0006
Revises: 20260614_0005
Create Date: 2026-06-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260617_0006"
down_revision = "20260614_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_log_deletions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email_log_id", sa.String(length=255), nullable=False),
        sa.Column("deleted_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["deleted_by_user_id"], ["user_access.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email_log_id"),
    )
    op.create_index(op.f("ix_email_log_deletions_email_log_id"), "email_log_deletions", ["email_log_id"], unique=True)
    op.create_index(op.f("ix_email_log_deletions_id"), "email_log_deletions", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_email_log_deletions_id"), table_name="email_log_deletions")
    op.drop_index(op.f("ix_email_log_deletions_email_log_id"), table_name="email_log_deletions")
    op.drop_table("email_log_deletions")
