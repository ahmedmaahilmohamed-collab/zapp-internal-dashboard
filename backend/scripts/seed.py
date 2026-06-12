from decimal import Decimal
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app import crud, schemas
from app.database import SessionLocal


def run() -> None:
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is not configured.")

    db = SessionLocal()
    try:
        existing = {currency.code for currency in crud.list_currencies(db)}
        if "MVR" not in existing:
            crud.create_currency(
                db,
                schemas.CurrencyCreate(
                    code="MVR",
                    name="Maldivian Rufiyaa",
                    symbol="Rf",
                    exchange_rate_to_base=Decimal("1"),
                    is_base=True,
                    is_active=True,
                ),
            )
        if "USD" not in existing:
            crud.create_currency(
                db,
                schemas.CurrencyCreate(
                    code="USD",
                    name="US Dollar",
                    symbol="$",
                    exchange_rate_to_base=Decimal("15.42"),
                    is_base=False,
                    is_active=True,
                ),
            )

        if not crud.list_shipping_rates(db):
            crud.create_shipping_rate(
                db,
                schemas.ShippingRateCreate(
                    name="Malaysia to Maldives Standard",
                    origin_country="Malaysia",
                    destination_country="Maldives",
                    carrier="ZAPP Forwarder",
                    service_level="Standard",
                    min_weight=Decimal("0"),
                    max_weight=Decimal("5"),
                    rate=Decimal("85"),
                    currency="MVR",
                    estimated_days_min=7,
                    estimated_days_max=14,
                    notes="Starter rate card for setup.",
                ),
            )
            crud.create_shipping_rate(
                db,
                schemas.ShippingRateCreate(
                    name="Malaysia to Maldives Heavy",
                    origin_country="Malaysia",
                    destination_country="Maldives",
                    carrier="ZAPP Forwarder",
                    service_level="Heavy",
                    min_weight=Decimal("5"),
                    max_weight=Decimal("30"),
                    rate=Decimal("72"),
                    currency="MVR",
                    estimated_days_min=10,
                    estimated_days_max=18,
                    notes="Starter heavy parcel tier.",
                ),
            )
    finally:
        db.close()


if __name__ == "__main__":
    run()
