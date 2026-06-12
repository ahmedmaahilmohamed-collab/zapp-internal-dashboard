from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

NonNegativeMoney = Annotated[Decimal, Field(ge=0)]

Role = Annotated[str, Field(pattern="^(admin|manager|viewer)$")]
UserStatus = Annotated[str, Field(pattern="^(pending|approved|rejected|disabled)$")]


class CurrencyBase(BaseModel):
    code: str
    name: str
    symbol: str = ""
    exchange_rate_to_base: Annotated[Decimal, Field(gt=0)]
    is_base: bool = False
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def uppercase_code(cls, value: str) -> str:
        return value.strip().upper()


class CurrencyCreate(CurrencyBase):
    pass


class CurrencyUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    symbol: str | None = None
    exchange_rate_to_base: Annotated[Decimal, Field(gt=0)] | None = None
    is_base: bool | None = None
    is_active: bool | None = None

    @field_validator("code")
    @classmethod
    def uppercase_code(cls, value: str | None) -> str | None:
        return value.strip().upper() if value is not None else value


class CurrencyRead(CurrencyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class ShippingRateBase(BaseModel):
    name: str
    origin_country: str
    destination_country: str
    carrier: str
    service_level: str = ""
    min_weight: Annotated[Decimal, Field(ge=0)]
    max_weight: Annotated[Decimal, Field(gt=0)]
    rate: NonNegativeMoney
    currency: str
    estimated_days_min: Annotated[int, Field(ge=0)] | None = None
    estimated_days_max: Annotated[int, Field(ge=0)] | None = None
    is_active: bool = True
    notes: str | None = None

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, value: str) -> str:
        return value.strip().upper()

    @model_validator(mode="after")
    def validate_ranges(self):
        if self.min_weight >= self.max_weight:
            raise ValueError("min_weight must be lower than max_weight")
        if (
            self.estimated_days_min is not None
            and self.estimated_days_max is not None
            and self.estimated_days_min > self.estimated_days_max
        ):
            raise ValueError("estimated_days_min must be lower than or equal to estimated_days_max")
        return self


class ShippingRateCreate(ShippingRateBase):
    pass


class ShippingRateUpdate(BaseModel):
    name: str | None = None
    origin_country: str | None = None
    destination_country: str | None = None
    carrier: str | None = None
    service_level: str | None = None
    min_weight: Annotated[Decimal, Field(ge=0)] | None = None
    max_weight: Annotated[Decimal, Field(gt=0)] | None = None
    rate: NonNegativeMoney | None = None
    currency: str | None = None
    estimated_days_min: Annotated[int, Field(ge=0)] | None = None
    estimated_days_max: Annotated[int, Field(ge=0)] | None = None
    is_active: bool | None = None
    notes: str | None = None

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, value: str | None) -> str | None:
        return value.strip().upper() if value is not None else value


class ShippingRateRead(ShippingRateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class CostBase(BaseModel):
    linked_order_id: str | None = None
    linked_request_id: str | None = None
    reference_label: str | None = None
    item_cost: NonNegativeMoney = Decimal("0")
    international_shipping_cost: NonNegativeMoney = Decimal("0")
    local_delivery_cost: NonNegativeMoney = Decimal("0")
    customs_cost: NonNegativeMoney = Decimal("0")
    payment_fee: NonNegativeMoney = Decimal("0")
    packaging_cost: NonNegativeMoney = Decimal("0")
    other_cost: NonNegativeMoney = Decimal("0")
    sale_total: NonNegativeMoney = Decimal("0")
    currency: str = "MVR"
    notes: str | None = None

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, value: str) -> str:
        return value.strip().upper()


class CostCreate(CostBase):
    pass


class CostUpdate(BaseModel):
    linked_order_id: str | None = None
    linked_request_id: str | None = None
    reference_label: str | None = None
    item_cost: NonNegativeMoney | None = None
    international_shipping_cost: NonNegativeMoney | None = None
    local_delivery_cost: NonNegativeMoney | None = None
    customs_cost: NonNegativeMoney | None = None
    payment_fee: NonNegativeMoney | None = None
    packaging_cost: NonNegativeMoney | None = None
    other_cost: NonNegativeMoney | None = None
    sale_total: NonNegativeMoney | None = None
    currency: str | None = None
    notes: str | None = None

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, value: str | None) -> str | None:
        return value.strip().upper() if value is not None else value


class CostRead(CostBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profit: Decimal
    margin_percent: Decimal | None
    created_at: datetime
    updated_at: datetime


class PricingCalculateRequest(BaseModel):
    item_cost: NonNegativeMoney
    source_currency: str
    target_currency: str
    product_weight: Annotated[Decimal, Field(gt=0)]
    origin_country: str
    destination_country: str
    desired_margin_percent: Annotated[Decimal, Field(ge=0, lt=100)]
    payment_fee_percent: Annotated[Decimal, Field(ge=0, lt=100)] = Decimal("0")
    customs_cost: NonNegativeMoney = Decimal("0")
    local_delivery_cost: NonNegativeMoney = Decimal("0")
    packaging_cost: NonNegativeMoney = Decimal("0")
    other_cost: NonNegativeMoney = Decimal("0")

    @field_validator("source_currency", "target_currency")
    @classmethod
    def uppercase_currency(cls, value: str) -> str:
        return value.strip().upper()


class PricingShippingRateUsed(BaseModel):
    id: int
    name: str
    carrier: str
    service_level: str
    origin_country: str
    destination_country: str
    min_weight: Decimal
    max_weight: Decimal
    rate: Decimal
    currency: str
    estimated_days_min: int | None
    estimated_days_max: int | None


class PricingCalculateResponse(BaseModel):
    source_currency: str
    target_currency: str
    converted_item_cost: Decimal
    international_shipping_cost: Decimal
    customs_cost: Decimal
    local_delivery_cost: Decimal
    packaging_cost: Decimal
    other_cost: Decimal
    total_landed_cost: Decimal
    payment_fee: Decimal
    recommended_sale_price: Decimal
    expected_profit: Decimal
    margin_percent: Decimal | None
    shipping_rate_used: PricingShippingRateUsed
    breakdown: dict[str, Decimal]


class UserRegister(BaseModel):
    email: str
    name: str
    password: Annotated[str, Field(min_length=8, max_length=128)]

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must be at least 2 characters.")
        return value


class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class RefreshTokenRequest(BaseModel):
    refresh_token: Annotated[str, Field(min_length=32, max_length=512)]


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    role: str
    status: str
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None


class UserUpdate(BaseModel):
    name: str | None = None
    role: Role | None = None
    status: UserStatus | None = None


class AuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserRead
