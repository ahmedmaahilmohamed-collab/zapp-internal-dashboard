from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

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
        "zappApiConfigured": client.is_configured,
        "zappApi": await _zapp_api_stats(client, checked_at, include_email_log_recent=user.role == "admin"),
    }


def _finance_stats(db: Session) -> dict[str, Any]:
    total_records = db.scalar(select(func.count(InternalCostRecord.id))) or 0
    total_sale_value = db.scalar(select(func.coalesce(func.sum(InternalCostRecord.sale_total), 0))) or Decimal("0")
    total_cost_value = db.scalar(select(func.coalesce(func.sum(InternalCostRecord.total_cost), 0))) or Decimal("0")
    total_profit = db.scalar(select(func.coalesce(func.sum(InternalCostRecord.profit), 0))) or Decimal("0")
    average_margin_percent = db.scalar(select(func.avg(InternalCostRecord.margin_percent)))
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
    currencies = [
        value
        for value in db.scalars(select(distinct(InternalCostRecord.currency))).all()
        if value
    ]

    return {
        "currency": _summary_currency(currencies),
        "totalCostRecords": int(total_records),
        "totalSaleValue": _money(total_sale_value),
        "totalCostValue": _money(total_cost_value),
        "totalProfit": _money(total_profit),
        "averageMarginPercent": _optional_number(average_margin_percent),
        "profitableRecordsCount": int(profitable_records_count),
        "lossRecordsCount": int(loss_records_count),
        "linkedOrdersCount": int(linked_orders_count),
        "linkedRequestsCount": int(linked_requests_count),
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


async def _zapp_api_stats(
    client: ZappApiClient,
    checked_at: str,
    *,
    include_email_log_recent: bool,
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
        include_recent=include_email_log_recent,
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
    return {
        "available": True,
        "status": "success",
        "total": int(meta.get("total") or len(normalized)),
        "recentCount": len(recent) if include_recent else 0,
        "recent": recent,
        "statusCounts": status_counts,
        "cancelledCount": status_counts.get("cancelled", 0) + status_counts.get("refunded", 0),
        "countsMayBePartial": int(meta.get("total") or len(normalized)) > len(normalized),
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
        "upstreamStatus": None,
        "elapsedMs": None,
        "responseKeys": [],
        "message": None,
    }


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


def _money(value: Decimal | int | float | None) -> float:
    return float(Decimal(value or 0).quantize(Decimal("0.01")))


def _optional_number(value: Decimal | int | float | None) -> float | None:
    if value is None:
        return None
    return float(Decimal(value).quantize(Decimal("0.01")))
