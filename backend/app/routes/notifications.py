from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import crud
from ..config import get_settings
from ..database import get_db
from ..models import Currency, InternalCostRecord, UserAccess
from ..security import require_roles
from ..zapp_client import ZappApiClient

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def get_notifications(
    user: UserAccess = Depends(require_roles("admin", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc).isoformat()
    items: list[dict[str, Any]] = []

    if user.role == "admin":
        pending_users = db.scalar(select(func.count(UserAccess.id)).where(UserAccess.status == "pending")) or 0
        if pending_users:
            items.append(
                _notification(
                    "pending-users",
                    "access",
                    "warning",
                    "Pending access approvals",
                    f"{pending_users} user account(s) are waiting for approval.",
                    "/access-management",
                    now,
                )
            )

    if user.role in {"admin", "manager"}:
        context = crud.build_currency_conversion_context(db)
        cost_records = db.scalars(select(InternalCostRecord)).all()
        excluded = 0
        warning_messages: set[str] = set()
        for record in cost_records:
            values = crud.cost_record_base_values(record, context)
            if not values["converted"]:
                excluded += 1
                warning_messages.update(values["warnings"])
        if excluded:
            items.append(
                _notification(
                    "finance-conversion-warnings",
                    "finance",
                    "warning",
                    "Finance totals need exchange rates",
                    f"{excluded} cost record(s) are excluded from base-currency reporting.",
                    "/reports",
                    now,
                    {"warnings": sorted(warning_messages)},
                )
            )

        inactive_currencies = db.scalar(select(func.count(Currency.id)).where(Currency.is_active.is_(False))) or 0
        if inactive_currencies:
            items.append(
                _notification(
                    "inactive-currencies",
                    "finance",
                    "info",
                    "Inactive currencies present",
                    f"{inactive_currencies} saved currency record(s) are inactive.",
                    "/currencies",
                    now,
                )
            )

    settings = get_settings()
    zapp_client = ZappApiClient(
        base_url=settings.zapp_api_base_url,
        token=settings.zapp_api_token,
        timeout_seconds=settings.zapp_api_timeout_seconds,
    )
    if user.role == "admin" and not zapp_client.is_configured:
        items.append(
            _notification(
                "zapp-api-not-configured",
                "diagnostics",
                "warning",
                "ZAPP API is not configured",
                "Live orders, requests, and email logs will remain unavailable until backend env vars are set.",
                "/diagnostics",
                now,
            )
        )

    return {
        "generatedAt": now,
        "unreadCount": len(items),
        "items": items,
    }


def _notification(
    notification_id: str,
    notification_type: str,
    severity: str,
    title: str,
    message: str,
    href: str,
    created_at: str,
    metadata: dict[str, Any] | None = None,
):
    return {
        "id": notification_id,
        "type": notification_type,
        "severity": severity,
        "title": title,
        "message": message,
        "href": href,
        "createdAt": created_at,
        "metadata": metadata or {},
    }
