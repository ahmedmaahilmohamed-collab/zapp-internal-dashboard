from decimal import Decimal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models, schemas


class DuplicateRecordError(Exception):
    pass


def list_currencies(db: Session, search: str | None = None, include_inactive: bool = True):
    statement = select(models.Currency).order_by(models.Currency.is_base.desc(), models.Currency.code.asc())
    if search:
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(models.Currency.code.ilike(pattern), models.Currency.name.ilike(pattern))
        )
    if not include_inactive:
        statement = statement.where(models.Currency.is_active.is_(True))
    return db.scalars(statement).all()


def create_currency(db: Session, payload: schemas.CurrencyCreate):
    if payload.is_base:
        db.query(models.Currency).update({models.Currency.is_base: False})
    currency = models.Currency(**payload.model_dump())
    db.add(currency)
    return _commit_refresh(db, currency)


def update_currency(db: Session, currency_id: int, payload: schemas.CurrencyUpdate):
    currency = db.get(models.Currency, currency_id)
    if currency is None:
        return None
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("is_base"):
        db.query(models.Currency).filter(models.Currency.id != currency_id).update({models.Currency.is_base: False})
    for key, value in updates.items():
        setattr(currency, key, value)
    return _commit_refresh(db, currency)


def deactivate_currency(db: Session, currency_id: int):
    currency = db.get(models.Currency, currency_id)
    if currency is None:
        return None
    currency.is_active = False
    if currency.is_base:
        currency.is_base = False
    return _commit_refresh(db, currency)


def list_shipping_rates(
    db: Session,
    search: str | None = None,
    destination_country: str | None = None,
    carrier: str | None = None,
    currency: str | None = None,
    include_inactive: bool = True,
):
    statement: Select = select(models.ShippingRateCard).order_by(
        models.ShippingRateCard.destination_country.asc(),
        models.ShippingRateCard.carrier.asc(),
        models.ShippingRateCard.min_weight.asc(),
    )
    if search:
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                models.ShippingRateCard.name.ilike(pattern),
                models.ShippingRateCard.carrier.ilike(pattern),
                models.ShippingRateCard.destination_country.ilike(pattern),
                models.ShippingRateCard.origin_country.ilike(pattern),
            )
        )
    if destination_country:
        statement = statement.where(models.ShippingRateCard.destination_country.ilike(f"%{destination_country.strip()}%"))
    if carrier:
        statement = statement.where(models.ShippingRateCard.carrier.ilike(f"%{carrier.strip()}%"))
    if currency:
        statement = statement.where(models.ShippingRateCard.currency == currency.strip().upper())
    if not include_inactive:
        statement = statement.where(models.ShippingRateCard.is_active.is_(True))
    return db.scalars(statement).all()


def create_shipping_rate(db: Session, payload: schemas.ShippingRateCreate):
    rate = models.ShippingRateCard(**payload.model_dump())
    db.add(rate)
    return _commit_refresh(db, rate)


def update_shipping_rate(db: Session, rate_id: int, payload: schemas.ShippingRateUpdate):
    rate = db.get(models.ShippingRateCard, rate_id)
    if rate is None:
        return None
    updates = payload.model_dump(exclude_unset=True)
    next_min = updates.get("min_weight", rate.min_weight)
    next_max = updates.get("max_weight", rate.max_weight)
    if next_min >= next_max:
        raise ValueError("min_weight must be lower than max_weight")
    for key, value in updates.items():
        setattr(rate, key, value)
    return _commit_refresh(db, rate)


def deactivate_shipping_rate(db: Session, rate_id: int):
    rate = db.get(models.ShippingRateCard, rate_id)
    if rate is None:
        return None
    rate.is_active = False
    return _commit_refresh(db, rate)


def list_costs(db: Session, search: str | None = None, currency: str | None = None):
    statement: Select = select(models.InternalCostRecord).order_by(models.InternalCostRecord.updated_at.desc())
    if search:
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                models.InternalCostRecord.reference_label.ilike(pattern),
                models.InternalCostRecord.linked_order_id.ilike(pattern),
                models.InternalCostRecord.linked_request_id.ilike(pattern),
                models.InternalCostRecord.notes.ilike(pattern),
            )
        )
    if currency:
        statement = statement.where(models.InternalCostRecord.currency == currency.strip().upper())
    return db.scalars(statement).all()


def create_cost(db: Session, payload: schemas.CostCreate):
    data = payload.model_dump()
    data.update(_calculate_cost_math(data))
    cost = models.InternalCostRecord(**data)
    db.add(cost)
    return _commit_refresh(db, cost)


def update_cost(db: Session, cost_id: int, payload: schemas.CostUpdate):
    cost = db.get(models.InternalCostRecord, cost_id)
    if cost is None:
        return None
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(cost, key, value)
    data = {
        "item_cost": cost.item_cost,
        "international_shipping_cost": cost.international_shipping_cost,
        "local_delivery_cost": cost.local_delivery_cost,
        "customs_cost": cost.customs_cost,
        "payment_fee": cost.payment_fee,
        "packaging_cost": cost.packaging_cost,
        "other_cost": cost.other_cost,
        "sale_total": cost.sale_total,
    }
    math = _calculate_cost_math(data)
    cost.profit = math["profit"]
    cost.margin_percent = math["margin_percent"]
    return _commit_refresh(db, cost)


def delete_cost(db: Session, cost_id: int):
    cost = db.get(models.InternalCostRecord, cost_id)
    if cost is None:
        return None
    db.delete(cost)
    db.commit()
    return cost


def calculate_pricing(db: Session, payload: schemas.PricingCalculateRequest):
    source_currency = _find_active_currency(db, payload.source_currency)
    target_currency = _find_active_currency(db, payload.target_currency)
    shipping_rate = _find_shipping_rate(
        db,
        origin_country=payload.origin_country,
        destination_country=payload.destination_country,
        product_weight=payload.product_weight,
    )

    if source_currency is None:
        raise ValueError("Source currency was not found or is inactive.")
    if target_currency is None:
        raise ValueError("Target currency was not found or is inactive.")
    if shipping_rate is None:
        raise ValueError("No active shipping rate card matches this route and weight.")

    converted_item_cost = _convert_currency(
        payload.item_cost,
        source_currency.exchange_rate_to_base,
        target_currency.exchange_rate_to_base,
    )
    shipping_cost_source = Decimal(shipping_rate.rate) * Decimal(payload.product_weight)
    rate_currency = _find_active_currency(db, shipping_rate.currency)
    if rate_currency is None:
        raise ValueError("Shipping rate currency was not found or is inactive.")
    international_shipping_cost = _convert_currency(
        shipping_cost_source,
        rate_currency.exchange_rate_to_base,
        target_currency.exchange_rate_to_base,
    )

    customs_cost = _money(payload.customs_cost)
    local_delivery_cost = _money(payload.local_delivery_cost)
    packaging_cost = _money(payload.packaging_cost)
    other_cost = _money(payload.other_cost)

    total_landed_cost = _money(
        converted_item_cost
        + international_shipping_cost
        + customs_cost
        + local_delivery_cost
        + packaging_cost
        + other_cost
    )
    margin_rate = Decimal(payload.desired_margin_percent) / Decimal("100")
    payment_fee_rate = Decimal(payload.payment_fee_percent) / Decimal("100")
    denominator = Decimal("1") - margin_rate - payment_fee_rate
    if denominator <= 0:
        raise ValueError("Desired margin and payment fee leave no room for a sale price.")

    recommended_sale_price = _money(total_landed_cost / denominator)
    payment_fee = _money(recommended_sale_price * payment_fee_rate)
    expected_profit = _money(recommended_sale_price - total_landed_cost - payment_fee)
    margin_percent = (
        None
        if recommended_sale_price <= 0
        else (expected_profit / recommended_sale_price * Decimal("100")).quantize(Decimal("0.01"))
    )

    return schemas.PricingCalculateResponse(
        source_currency=payload.source_currency,
        target_currency=payload.target_currency,
        converted_item_cost=converted_item_cost,
        international_shipping_cost=international_shipping_cost,
        customs_cost=customs_cost,
        local_delivery_cost=local_delivery_cost,
        packaging_cost=packaging_cost,
        other_cost=other_cost,
        total_landed_cost=total_landed_cost,
        payment_fee=payment_fee,
        recommended_sale_price=recommended_sale_price,
        expected_profit=expected_profit,
        margin_percent=margin_percent,
        shipping_rate_used=schemas.PricingShippingRateUsed.model_validate(
            shipping_rate,
            from_attributes=True,
        ),
        breakdown={
            "item_cost": converted_item_cost,
            "international_shipping_cost": international_shipping_cost,
            "customs_cost": customs_cost,
            "local_delivery_cost": local_delivery_cost,
            "packaging_cost": packaging_cost,
            "other_cost": other_cost,
            "total_landed_cost": total_landed_cost,
            "payment_fee": payment_fee,
            "expected_profit": expected_profit,
        },
    )


def _calculate_cost_math(data: dict):
    total_cost = sum(
        Decimal(data.get(field) or 0)
        for field in (
            "item_cost",
            "international_shipping_cost",
            "local_delivery_cost",
            "customs_cost",
            "payment_fee",
            "packaging_cost",
            "other_cost",
        )
    )
    sale_total = Decimal(data.get("sale_total") or 0)
    profit = sale_total - total_cost
    margin = None if sale_total <= 0 else (profit / sale_total * Decimal("100")).quantize(Decimal("0.01"))
    return {"profit": profit.quantize(Decimal("0.01")), "margin_percent": margin}


def _find_active_currency(db: Session, code: str):
    return db.scalar(
        select(models.Currency).where(
            models.Currency.code == code.strip().upper(),
            models.Currency.is_active.is_(True),
        )
    )


def _find_shipping_rate(
    db: Session,
    *,
    origin_country: str,
    destination_country: str,
    product_weight: Decimal,
):
    return db.scalar(
        select(models.ShippingRateCard)
        .where(
            func.lower(models.ShippingRateCard.origin_country) == origin_country.strip().lower(),
            func.lower(models.ShippingRateCard.destination_country) == destination_country.strip().lower(),
            models.ShippingRateCard.is_active.is_(True),
            models.ShippingRateCard.min_weight <= product_weight,
            models.ShippingRateCard.max_weight >= product_weight,
        )
        .order_by(models.ShippingRateCard.max_weight.asc(), models.ShippingRateCard.rate.asc())
    )


def _convert_currency(amount: Decimal, source_rate_to_base: Decimal, target_rate_to_base: Decimal):
    amount_in_base = Decimal(amount) * Decimal(source_rate_to_base)
    return _money(amount_in_base / Decimal(target_rate_to_base))


def _money(value: Decimal):
    return Decimal(value or 0).quantize(Decimal("0.01"))


def _commit_refresh(db: Session, record):
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateRecordError("A record with this unique value already exists.") from exc
    db.refresh(record)
    return record
