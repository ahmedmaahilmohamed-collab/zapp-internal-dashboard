from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from .. import crud
from ..config import get_settings
from ..database import get_db
from ..models import Currency, InternalCostRecord, ShippingRateCard, UserAccess
from ..security import require_roles
from ..zapp_client import ZappApiClient, ZappApiError
from .api import normalize_email_log, normalize_order, normalize_request

router = APIRouter(prefix="/api/overview", tags=["overview"])


@router.get("/stats")
async def get_overview_stats(
    user: UserAccess = Depends(require_roles("admin", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    client = ZappApiClient(
        base_url=settings.zapp_api_base_url,
        token=settings.zapp_api_token,
        timeout_seconds=settings.zapp_api_timeout_seconds,
    )

    checked_at = datetime.now(timezone.utc).isoformat()
    zapp_api = await _zapp_api_stats(client, checked_at)

    return {
        "generatedAt": checked_at,
        "role": user.role,
        "permissions": {
            "canManageFinance": user.role in {"admin", "manager"},
            "canManageAccess": user.role == "admin",
            "canViewDiagnostics": user.role == "admin",
        },
        "finance": _finance_stats(db),
        "configuration": _configuration_stats(db),
        "access": _access_stats(db, user),
        "recentCostRecords": _recent_cost_records(db),
        "financeTrend": _finance_trend(db),
        "dashboardWidgets": _dashboard_widgets(db, zapp_api),
        "zappApiConfigured": client.is_configured,
        "zappApi": zapp_api,
    }


def _finance_stats(db: Session) -> dict[str, Any]:
    records = db.scalars(select(InternalCostRecord)).all()
    total_records = len(records)
    context = crud.build_currency_conversion_context(db)
    total_sale_value = Decimal("0")
    total_cost_value = Decimal("0")
    total_profit = Decimal("0")
    converted_count = 0
    warnings: set[str] = set()

    for record in records:
        values = crud.cost_record_base_values(record, context)
        warnings.update(values["warnings"])
        if not values["converted"]:
            continue
        converted_count += 1
        total_sale_value += Decimal(values["saleTotalBase"] or 0)
        total_cost_value += Decimal(values["totalCostBase"] or 0)
        total_profit += Decimal(values["profitBase"] or 0)

    average_margin_percent = None if total_sale_value <= 0 else total_profit / total_sale_value * Decimal("100")
    profitable_records_count = (
        db.scalar(select(func.count(InternalCostRecord.id)).where(InternalCostRecord.profit > 0)) or 0
    )
    loss_records_count = (
        db.scalar(select(func.count(InternalCostRecord.id)).where(InternalCostRecord.profit < 0)) or 0
    )
    linked_orders_count = (
        db.scalar(select(func.count(InternalCostRecord.id)).where(InternalCostRecord.linked_order_id.is_not(None))) or 0
    )
    linked_requests_count = (
        db.scalar(select(func.count(InternalCostRecord.id)).where(InternalCostRecord.linked_request_id.is_not(None))) or 0
    )

    return {
        "currency": context["baseCurrency"],
        "totalCostRecords": int(total_records),
        "totalSaleValue": _money(total_sale_value),
        "totalCostValue": _money(total_cost_value),
        "totalProfit": _money(total_profit),
        "averageMarginPercent": _optional_number(average_margin_percent),
        "profitableRecordsCount": int(profitable_records_count),
        "lossRecordsCount": int(loss_records_count),
        "linkedOrdersCount": int(linked_orders_count),
        "linkedRequestsCount": int(linked_requests_count),
        "convertedRecordCount": int(converted_count),
        "excludedRecordCount": int(total_records - converted_count),
        "conversionWarnings": sorted(warnings),
        "scope": "local_finance",
    }


def _configuration_stats(db: Session) -> dict[str, Any]:
    active_currencies_count = (
        db.scalar(select(func.count(Currency.id)).where(Currency.is_active.is_(True))) or 0
    )
    active_shipping_rate_cards_count = (
        db.scalar(select(func.count(ShippingRateCard.id)).where(ShippingRateCard.is_active.is_(True))) or 0
    )

    return {
        "activeCurrenciesCount": int(active_currencies_count),
        "activeShippingRateCardsCount": int(active_shipping_rate_cards_count),
    }


def _access_stats(db: Session, user: UserAccess) -> dict[str, Any]:
    if user.role != "admin":
        return {"pendingUsersCount": None}

    pending_users_count = (
        db.scalar(select(func.count(UserAccess.id)).where(UserAccess.status == "pending")) or 0
    )
    return {"pendingUsersCount": int(pending_users_count)}


def _recent_cost_records(db: Session) -> list[dict[str, Any]]:
    records = db.scalars(
        select(InternalCostRecord)
        .order_by(InternalCostRecord.updated_at.desc(), InternalCostRecord.id.desc())
        .limit(6)
    ).all()

    return [
        {
            "id": record.id,
            "referenceLabel": record.reference_label,
            "linkedOrderId": record.linked_order_id,
            "linkedRequestId": record.linked_request_id,
            "saleTotal": _money(record.sale_total),
            "totalCost": _money(record.total_cost),
            "profit": _money(record.profit),
            "marginPercent": _optional_number(record.margin_percent),
            "currency": record.currency,
            "createdAt": record.created_at.isoformat(),
            "updatedAt": record.updated_at.isoformat(),
        }
        for record in records
    ]


def _finance_trend(db: Session) -> list[dict[str, Any]]:
    records = db.scalars(
        select(InternalCostRecord)
        .order_by(InternalCostRecord.updated_at.desc(), InternalCostRecord.id.desc())
        .limit(365)
    ).all()
    context = crud.build_currency_conversion_context(db)
    buckets: dict[str, dict[str, Decimal | int]] = {}

    for record in sorted(records, key=lambda item: (item.updated_at, item.id)):
        values = crud.cost_record_base_values(record, context)
        if not values["converted"]:
            continue
        date_key = record.updated_at.date().isoformat()
        bucket = buckets.setdefault(
            date_key,
            {
                "revenue": Decimal("0"),
                "costs": Decimal("0"),
                "profit": Decimal("0"),
                "records": 0,
            },
        )
        bucket["revenue"] = Decimal(bucket["revenue"]) + Decimal(values["saleTotalBase"] or 0)
        bucket["costs"] = Decimal(bucket["costs"]) + Decimal(values["totalCostBase"] or 0)
        bucket["profit"] = Decimal(bucket["profit"]) + Decimal(values["profitBase"] or 0)
        bucket["records"] = int(bucket["records"]) + 1

    points = []
    for date_key, bucket in sorted(buckets.items())[-30:]:
        revenue = Decimal(bucket["revenue"])
        profit = Decimal(bucket["profit"])
        points.append(
            {
                "date": date_key,
                "revenue": _money(revenue),
                "costs": _money(Decimal(bucket["costs"])),
                "profit": _money(profit),
                "marginPercent": _optional_number(None if revenue <= 0 else profit / revenue * Decimal("100")),
                "records": int(bucket["records"]),
            }
        )
    return points


def _dashboard_widgets(db: Session, zapp_api: dict[str, Any]) -> dict[str, Any]:
    records = db.scalars(select(InternalCostRecord)).all()
    context = crud.build_currency_conversion_context(db)
    customer_totals: dict[str, Decimal] = {}
    revenue_last_30 = Decimal("0")
    profit_last_30 = Decimal("0")
    latest_dates = sorted((record.updated_at.date() for record in records), reverse=True)
    cutoff = latest_dates[0] if latest_dates else None

    for record in records:
        values = crud.cost_record_base_values(record, context)
        if not values["converted"]:
            continue
        customer = (record.customer_name or "Unknown customer").strip() or "Unknown customer"
        customer_totals[customer] = customer_totals.get(customer, Decimal("0")) + Decimal(values["saleTotalBase"] or 0)
        if cutoff and (cutoff - record.updated_at.date()).days <= 30:
            revenue_last_30 += Decimal(values["saleTotalBase"] or 0)
            profit_last_30 += Decimal(values["profitBase"] or 0)

    return {
        "baseCurrency": context["baseCurrency"],
        "revenueLast30Days": _money(revenue_last_30),
        "profitLast30Days": _money(profit_last_30),
        "requestsThisMonth": _requests_this_month(zapp_api),
        "averageOrderValue": _average_live_value(zapp_api.get("orders"), "total", context),
        "averageRequestValue": _average_live_value(zapp_api.get("requests"), "quotedTotal", context),
        "topCustomers": [
            {"customerName": name, "revenueBase": _money(value)}
            for name, value in sorted(customer_totals.items(), key=lambda item: item[1], reverse=True)[:5]
        ],
        "topCategories": [],
        "topCategoriesAvailable": False,
    }


async def _zapp_api_stats(
    client: ZappApiClient,
    checked_at: str,
) -> dict[str, Any]:
    if not client.is_configured:
        return {
            "configured": False,
            "checkedAt": checked_at,
            "status": "not_configured",
            "message": "ZAPP API base URL or token is not configured.",
            "orders": _unavailable_zapp_section("not_configured"),
            "requests": _unavailable_zapp_section("not_configured"),
            "emailLogs": _unavailable_zapp_section("not_configured"),
            "requestConversion": _empty_request_conversion(False),
        }

    orders = await _fetch_zapp_section(
        client,
        path="/api/internal/orders",
        collection_keys=("items", "orders"),
        normalizer=normalize_order,
    )
    requests = await _fetch_zapp_section(
        client,
        path="/api/internal/purchase-requests",
        collection_keys=("items", "requests"),
        normalizer=normalize_request,
    )
    email_logs = await _fetch_zapp_section(
        client,
        path="/api/internal/email-logs",
        collection_keys=("items", "logs"),
        normalizer=normalize_email_log,
        include_recent=False,
    )

    status = "success" if orders["available"] and requests["available"] and email_logs["available"] else "degraded"
    return {
        "configured": True,
        "checkedAt": checked_at,
        "status": status,
        "message": "ZAPP API is reachable." if status == "success" else "One or more ZAPP API resources are unavailable.",
        "orders": orders,
        "requests": requests,
        "emailLogs": email_logs,
        "requestConversion": requests.get("requestConversion") or _empty_request_conversion(False),
    }


async def _fetch_zapp_section(
    client: ZappApiClient,
    *,
    path: str,
    collection_keys: tuple[str, ...],
    normalizer,
    include_recent: bool = True,
) -> dict[str, Any]:
    try:
        fetch_limit = 100 if include_recent else 1
        items, meta = await client.fetch_collection(
            path=path,
            collection_keys=collection_keys,
            params={"limit": fetch_limit, "skip": 0},
        )
    except ZappApiError as exc:
        return {
            **_unavailable_zapp_section(exc.status),
            "message": exc.message,
            "upstreamStatus": exc.upstream_status,
        }

    normalized = [
        normalizer(item)
        for item in items
        if isinstance(item, dict)
    ]

    recent = normalized[:6] if include_recent else []
    status_counts = _status_counts(normalized)
    total = int(meta.get("total") or len(normalized))
    counts_may_be_partial = total > len(normalized)
    return {
        "available": True,
        "status": "success",
        "total": total,
        "recentCount": len(recent) if include_recent else 0,
        "recent": recent,
        "statusCounts": status_counts,
        "cancelledCount": status_counts.get("cancelled", 0) + status_counts.get("refunded", 0),
        "countsMayBePartial": counts_may_be_partial,
        "sampleSize": len(normalized),
        "requestConversion": _request_conversion_from_items(
            normalized,
            total=total,
            counts_may_be_partial=counts_may_be_partial,
        ) if "purchase-requests" in path else None,
        "upstreamStatus": meta.get("upstreamStatus"),
        "elapsedMs": meta.get("elapsedMs"),
        "responseKeys": meta.get("responseKeys", []),
        "message": None,
    }


def _unavailable_zapp_section(status: str) -> dict[str, Any]:
    return {
        "available": False,
        "status": status,
        "total": None,
        "recentCount": 0,
        "recent": [],
        "statusCounts": {},
        "cancelledCount": 0,
        "countsMayBePartial": False,
        "sampleSize": 0,
        "upstreamStatus": None,
        "elapsedMs": None,
        "responseKeys": [],
        "message": None,
    }


def _empty_request_conversion(available: bool) -> dict[str, Any]:
    return {
        "available": available,
        "total": 0,
        "quoted": 0,
        "approvedPaid": 0,
        "cancelled": 0,
        "pending": 0,
        "conversionRate": None,
        "cancellationRate": None,
        "countsMayBePartial": False,
        "sampleSize": 0,
    }


def _request_conversion_from_items(
    items: list[dict[str, Any]],
    *,
    total: int,
    counts_may_be_partial: bool,
) -> dict[str, Any]:
    quoted = approved_paid = cancelled = pending = 0

    for item in items:
        status_text = _status_text(item)
        quoted_total = Decimal(str(item.get("quotedTotal") or 0))
        if quoted_total > 0 or item.get("quoteStatus"):
            quoted += 1
        if any(word in status_text for word in ("approved", "paid", "success", "complete")):
            approved_paid += 1
        if any(word in status_text for word in ("cancel", "refund", "reject")):
            cancelled += 1
        elif any(word in status_text for word in ("pending", "awaiting", "open", "draft", "new")) or not status_text:
            pending += 1

    denominator = total if total > 0 else 0
    return {
        "available": True,
        "total": total,
        "quoted": quoted,
        "approvedPaid": approved_paid,
        "cancelled": cancelled,
        "pending": pending,
        "conversionRate": _rate(approved_paid, denominator),
        "cancellationRate": _rate(cancelled, denominator),
        "countsMayBePartial": counts_may_be_partial,
        "sampleSize": len(items),
    }


def _requests_this_month(zapp_api: dict[str, Any]) -> int | None:
    requests = zapp_api.get("requests") or {}
    if not requests.get("available"):
        return None
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    recent = requests.get("recent") or []
    return sum(1 for item in recent if str(item.get("createdAt") or "").startswith(current_month))


def _average_live_value(section: dict[str, Any] | None, amount_key: str, context: dict) -> float | None:
    if not section or not section.get("available"):
        return None
    recent = section.get("recent") or []
    values = []
    for item in recent:
        if item.get(amount_key) is None:
            continue
        converted, warning = crud.convert_amount_to_base(item.get(amount_key), item.get("currency"), context)
        if warning:
            continue
        values.append(Decimal(converted or 0))
    if not values:
        return None
    return _money(sum(values) / Decimal(len(values)))


def _status_text(item: dict[str, Any]) -> str:
    return " ".join(
        str(value or "").lower()
        for value in (
            item.get("status"),
            item.get("quoteStatus"),
            item.get("paymentStatus"),
            item.get("financialStatus"),
        )
    )


def _summary_currency(currencies: list[str]) -> str:
    unique = sorted(set(currencies))
    if len(unique) == 1:
        return unique[0]
    if len(unique) > 1:
        return "MIXED"
    return "MVR"


def _status_counts(items: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        status = str(
            item.get("status")
            or item.get("paymentStatus")
            or item.get("financialStatus")
            or "unknown"
        ).strip().lower()
        if not status:
            status = "unknown"
        counts[status] = counts.get(status, 0) + 1
    return counts


def _rate(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return float((Decimal(numerator) / Decimal(denominator) * Decimal("100")).quantize(Decimal("0.01")))


def _money(value: Decimal | int | float | None) -> float:
    return float(Decimal(value or 0).quantize(Decimal("0.01")))


def _optional_number(value: Decimal | int | float | None) -> float | None:
    if value is None:
        return None
    return float(Decimal(value).quantize(Decimal("0.01")))
