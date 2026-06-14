from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class TimestampMixin:
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Currency(TimestampMixin, Base):
    __tablename__ = "currencies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    symbol: Mapped[str] = mapped_column(String(12), nullable=False, default="")
    exchange_rate_to_base: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    is_base: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ShippingRateCard(TimestampMixin, Base):
    __tablename__ = "shipping_rate_cards"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    origin_country: Mapped[str] = mapped_column(String(80), nullable=False)
    destination_country: Mapped[str] = mapped_column(String(80), nullable=False)
    carrier: Mapped[str] = mapped_column(String(120), nullable=False)
    service_level: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    min_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    max_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False)
    estimated_days_min: Mapped[int | None] = mapped_column(nullable=True)
    estimated_days_max: Mapped[int | None] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class InternalCostRecord(TimestampMixin, Base):
    __tablename__ = "internal_cost_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    source_type: Mapped[str] = mapped_column(String(24), nullable=False, default="manual", index=True)
    source_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    linked_order_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    linked_request_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    reference_label: Mapped[str | None] = mapped_column(String(160), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    title: Mapped[str | None] = mapped_column(String(240), nullable=True)
    supplier_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    product_purchase_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    bml_tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    import_tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    shipping_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    additional_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    item_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    international_shipping_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    local_delivery_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    customs_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    payment_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    packaging_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    other_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    sale_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="MVR")
    total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    profit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    margin_percent: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class CostTemplate(TimestampMixin, Base):
    __tablename__ = "cost_templates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_bml_tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    default_import_tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    default_shipping_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    default_additional_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    default_margin_percent: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="MVR")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class UserAccess(TimestampMixin, Base):
    __tablename__ = "user_access"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(24), nullable=False, default="viewer")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    last_login_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RefreshToken(TimestampMixin, Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_access.id", ondelete="CASCADE"), index=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    expires_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_by_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
