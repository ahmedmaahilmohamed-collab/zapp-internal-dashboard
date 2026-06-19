from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import crud
from ..config import get_settings
from ..database import get_db
from ..models import InternalCostRecord
from ..security import require_roles
from ..zapp_client import ZappApiClient
from .overview import _active_cost_records, _cancelled_source_keys, _zapp_api_stats

router = APIRouter(prefix="/api/reports", tags=["reports"])

CATEGORY_FIELDS = (
    ("product_purchase_cost", "Product Purchase"),
    ("bml_tax", "BML / Payment Tax"),
    ("import_tax", "Import Tax"),
    ("shipping_cost", "Shipping"),
    ("additional_cost", "Additional"),
)


@router.get("/finance")
async def get_finance_report(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    group_by: str = Query(default="month", pattern="^month$"),
    _user=Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    statement = select(InternalCostRecord).order_by(InternalCostRecord.created_at.asc(), InternalCostRecord.id.asc())
    if date_from:
        statement = statement.where(InternalCostRecord.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        statement = statement.where(InternalCostRecord.created_at <= datetime.combine(date_to, time.max))

    all_records = db.scalars(statement).all()
    settings = get_settings()
    client = ZappApiClient(
        base_url=settings.zapp_api_base_url,
        token=settings.zapp_api_token,
        timeout_seconds=settings.zapp_api_timeout_seconds,
    )
    zapp_api = await _zapp_api_stats(client, datetime.utcnow().isoformat() + "Z")
    records = _active_cost_records(all_records, _cancelled_source_keys(zapp_api))
    context = crud.build_currency_conversion_context(db)
    report = _build_report(records, context, cancelled_excluded_count=len(all_records) - len(records))
    return {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "dateFrom": date_from.isoformat() if date_from else None,
        "dateTo": date_to.isoformat() if date_to else None,
        "groupBy": group_by,
        **report,
    }


def _build_report(records: list[InternalCostRecord], context: dict, *, cancelled_excluded_count: int = 0) -> dict[str, Any]:
    monthly: dict[str, dict[str, Decimal | int]] = {}
    category_totals: dict[str, Decimal] = {field: Decimal("0") for field, _label in CATEGORY_FIELDS}
    leaderboards: list[dict[str, Any]] = []
    warnings: dict[str, set[int]] = {}
    converted_count = 0
    excluded_count = 0
    total_revenue = Decimal("0")
    total_costs = Decimal("0")
    total_profit = Decimal("0")

    for record in records:
        values = crud.cost_record_base_values(record, context)
        if not values["converted"]:
            excluded_count += 1
            for warning in values["warnings"]:
                warnings.setdefault(warning, set()).add(record.id)
            continue

        converted_count += 1
        revenue = Decimal(values["saleTotalBase"] or 0)
        costs = Decimal(values["totalCostBase"] or 0)
        profit = Decimal(values["profitBase"] or 0)
        total_revenue += revenue
        total_costs += costs
        total_profit += profit

        month_key = record.created_at.strftime("%Y-%m")
        bucket = monthly.setdefault(
            month_key,
            {"revenue": Decimal("0"), "costs": Decimal("0"), "profit": Decimal("0"), "record_count": 0},
        )
        bucket["revenue"] = Decimal(bucket["revenue"]) + revenue
        bucket["costs"] = Decimal(bucket["costs"]) + costs
        bucket["profit"] = Decimal(bucket["profit"]) + profit
        bucket["record_count"] = int(bucket["record_count"]) + 1

        for field, _label in CATEGORY_FIELDS:
            converted, warning = crud.convert_amount_to_base(getattr(record, field), record.currency, context)
            if warning:
                warnings.setdefault(warning, set()).add(record.id)
                continue
            category_totals[field] += Decimal(converted or 0)

        leaderboards.append(
            {
                "id": record.id,
                "sourceType": record.source_type,
                "sourceId": record.source_id,
                "linkedOrderId": record.linked_order_id,
                "linkedRequestId": record.linked_request_id,
                "referenceLabel": record.reference_label,
                "customerName": record.customer_name,
                "title": record.title,
                "revenueBase": _money(revenue),
                "costsBase": _money(costs),
                "profitBase": _money(profit),
                "marginPercent": _optional_number(values["marginPercent"]),
                "currency": context["baseCurrency"],
                "updatedAt": record.updated_at.isoformat(),
            }
        )

    monthly_rows = []
    for month_key, bucket in sorted(monthly.items()):
        revenue = Decimal(bucket["revenue"])
        profit = Decimal(bucket["profit"])
        monthly_rows.append(
            {
                "month": month_key,
                "revenue": _money(revenue),
                "costs": _money(Decimal(bucket["costs"])),
                "profit": _money(profit),
                "marginPercent": _optional_number(None if revenue <= 0 else profit / revenue * Decimal("100")),
                "recordCount": int(bucket["record_count"]),
            }
        )

    category_rows = []
    for field, label in CATEGORY_FIELDS:
        amount = category_totals[field]
        category_rows.append(
            {
                "key": field,
                "label": label,
                "amount": _money(amount),
                "percentOfTotalCost": _optional_number(None if total_costs <= 0 else amount / total_costs * Decimal("100")),
            }
        )

    warning_rows = [
        {"message": message, "recordIds": sorted(record_ids)[:20], "recordCount": len(record_ids)}
        for message, record_ids in sorted(warnings.items())
    ]
    if cancelled_excluded_count:
        warning_rows.append(
            {
                "message": "Cancelled or voided linked cost records are excluded from report totals.",
                "recordIds": [],
                "recordCount": cancelled_excluded_count,
            }
        )

    return {
        "baseCurrency": context["baseCurrency"],
        "convertedRecordCount": converted_count,
        "excludedRecordCount": excluded_count + cancelled_excluded_count,
        "conversionWarnings": warning_rows,
        "summary": {
            "recordCount": len(records),
            "revenue": _money(total_revenue),
            "costs": _money(total_costs),
            "profit": _money(total_profit),
            "marginPercent": _optional_number(None if total_revenue <= 0 else total_profit / total_revenue * Decimal("100")),
        },
        "monthlyPnL": monthly_rows,
        "categoryBreakdown": category_rows,
        "leaderboards": {
            "bestProfit": sorted(leaderboards, key=lambda item: item["profitBase"], reverse=True)[:5],
            "worstProfit": sorted(leaderboards, key=lambda item: item["profitBase"])[:5],
            "bestMargin": sorted(
                [item for item in leaderboards if item["marginPercent"] is not None],
                key=lambda item: item["marginPercent"],
                reverse=True,
            )[:5],
            "worstMargin": sorted(
                [item for item in leaderboards if item["marginPercent"] is not None],
                key=lambda item: item["marginPercent"],
            )[:5],
        },
        "expectedVsActual": {
            "available": False,
            "message": "Expected-vs-actual profit needs live quote estimates attached to linked requests.",
        },
    }


def _money(value: Decimal | int | float | None) -> float:
    return float(Decimal(value or 0).quantize(Decimal("0.01")))


def _optional_number(value: Decimal | int | float | None) -> float | None:
    if value is None:
        return None
    return float(Decimal(value).quantize(Decimal("0.01")))
