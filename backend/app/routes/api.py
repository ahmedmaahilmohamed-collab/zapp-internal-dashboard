from __future__ import annotations

from datetime import date, datetime, time, timezone
from decimal import Decimal
from math import ceil
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import crud, models
from ..config import get_settings
from ..database import get_db
from ..security import require_roles
from ..zapp_client import ZappApiClient, ZappApiError

router = APIRouter(prefix="/api", tags=["dashboard-api"])

MAX_PAGE_SIZE = 100
LOCAL_FILTER_FETCH_LIMIT = 1000


@router.get("/orders")
async def orders(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=MAX_PAGE_SIZE),
    _user=Depends(require_roles("admin", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    return await _fetch_dashboard_collection(
        path="/api/internal/orders",
        collection_keys=("items", "orders"),
        normalizer=normalize_order,
        resource_type="order",
        db=db,
        search=search,
        status=status,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


@router.get("/requests")
async def requests(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=MAX_PAGE_SIZE),
    _user=Depends(require_roles("admin", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    return await _fetch_dashboard_collection(
        path="/api/internal/purchase-requests",
        collection_keys=("items", "requests"),
        normalizer=normalize_request,
        resource_type="request",
        db=db,
        search=search,
        status=status,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


@router.get("/email-logs")
async def email_logs(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=MAX_PAGE_SIZE),
    _user=Depends(require_roles("admin")),
):
    return await _fetch_dashboard_collection(
        path="/api/internal/email-logs",
        collection_keys=("items", "logs"),
        normalizer=normalize_email_log,
        search=search,
        status=status,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


async def _fetch_dashboard_collection(
    *,
    path: str,
    collection_keys: tuple[str, ...],
    normalizer,
    resource_type: str | None = None,
    db: Session | None = None,
    search: str | None,
    status: str | None,
    date_from: date | None,
    date_to: date | None,
    page: int,
    page_size: int,
) -> dict[str, Any] | JSONResponse:
    settings = get_settings()
    client = ZappApiClient(
        base_url=settings.zapp_api_base_url,
        token=settings.zapp_api_token,
        timeout_seconds=settings.zapp_api_timeout_seconds,
    )

    needs_local_date_filter = bool(date_from or date_to)
    upstream_params = {
        "search": search,
        "status": status,
        "skip": 0 if needs_local_date_filter else (page - 1) * page_size,
        "limit": LOCAL_FILTER_FETCH_LIMIT if needs_local_date_filter else page_size,
    }

    try:
        source_items, meta = await client.fetch_collection(
            path=path,
            collection_keys=collection_keys,
            params=upstream_params,
        )
    except ZappApiError as error:
        return _safe_error_response(error)

    normalized = [
        normalizer(item)
        for item in source_items
        if isinstance(item, dict)
    ]
    normalized = _apply_local_filters(
        normalized,
        search=search,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )

    total = len(normalized) if needs_local_date_filter else int(meta.get("total") or len(normalized))
    if needs_local_date_filter:
        start = (page - 1) * page_size
        end = start + page_size
        page_items = normalized[start:end]
    else:
        page_items = normalized

    if db is not None and resource_type in {"order", "request"}:
        page_items = _attach_finance_summaries(page_items, resource_type=resource_type, db=db)

    return {
        "success": True,
        "items": page_items,
        "total": total,
        "page": page,
        "pageSize": page_size,
        "pageCount": max(1, ceil(total / page_size)) if page_size else 1,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "path": path,
            "upstreamStatus": meta.get("upstreamStatus"),
            "elapsedMs": meta.get("elapsedMs"),
            "responseKeys": meta.get("responseKeys", []),
            "localDateFilterApplied": needs_local_date_filter,
        },
    }


def normalize_order(item: dict[str, Any]) -> dict[str, Any]:
    customer = _first_dict(item, "customer", "customerInfo", "customer_info")
    tracking = _first_dict(item, "trackingSummary", "tracking_summary", "tracking")
    product_lines = _first_value(item, "productLines", "product_lines", "lineItems", "line_items")
    total = _first_value(
        item,
        "total",
        "totalPaid",
        "total_paid",
        "amount",
        "currentTotalPrice",
        "current_total_price",
        "totalPrice",
        "total_price",
    )

    return {
        "id": _safe_str(_first_value(item, "id", "sourceId", "source_id", "orderId", "order_id")),
        "orderName": _safe_str(_first_value(item, "orderName", "order_name", "name", "orderNumber", "order_number")),
        "orderNumber": _safe_str(
            _first_value(item, "orderNumber", "order_number", "number")
            or _normalize_order_number(_first_value(item, "orderName", "order_name", "name"))
        ),
        "customerName": _safe_str(_first_value(item, "customerName", "customer_name") or _customer_name(customer)),
        "customerEmail": _safe_str(_first_value(item, "customerEmail", "customer_email", "email") or customer.get("email")),
        "status": _priority_status(item, "status", "approvalStatus", "approval_status", "displayFulfillmentStatus", "cancelledAt", "cancelled_at", "canceledAt", "canceled_at"),
        "financialStatus": _priority_status(item, "financialStatus", "financial_status", "paymentStatus", "payment_status", "refundStatus", "refund_status"),
        "fulfillmentStatus": _safe_str(_first_value(item, "fulfillmentStatus", "fulfillment_status", "displayFulfillmentStatus")),
        "total": _safe_number(total),
        "currency": _safe_str(_first_value(item, "currency", "currencyCode", "currency_code", "presentmentCurrencyCode")) or "USD",
        "createdAt": _safe_date(_first_value(item, "createdAt", "created_at", "processedAt", "processed_at")),
        "updatedAt": _safe_date(_first_value(item, "updatedAt", "updated_at")),
        "linkedRequestId": _safe_str(_first_value(item, "linkedRequestId", "linked_request_id", "requestId", "request_id")),
        "sourceType": _safe_str(_first_value(item, "sourceType", "source_type")),
        "itemCount": _item_count(product_lines, item),
        "receiptStatus": _safe_str(_first_value(item, "receiptStatus", "receipt_status") or tracking.get("receiptStatus")),
        "deliveryStatus": _safe_str(_first_value(item, "deliveryStatus", "delivery_status") or tracking.get("deliveryStatus")),
        "trackingNumber": _safe_str(_first_value(item, "trackingNumber", "tracking_number") or tracking.get("trackingNumber")),
        "source": _source_reference(item),
    }


def normalize_request(item: dict[str, Any]) -> dict[str, Any]:
    customer = _first_dict(item, "customer", "requester", "requesterInfo")
    details = _first_dict(item, "requestDetails", "request_details", "details")
    items = (
        _first_value(item, "items", "lineItems", "line_items", "productLines", "product_lines", "extraItems", "extra_items")
        or details.get("extraItems")
    )
    quote = _first_dict(item, "quote", "paymentQuote", "payment_quote")
    quoted_total = _first_value(
        item,
        "quotedTotal",
        "quoted_total",
        "amountPaid",
        "amount_paid",
        "quoteMvr",
        "quote_mvr",
        "quoteUsd",
        "quote_usd",
    )

    if quoted_total is None:
        quoted_total = _first_value(quote, "total", "amount", "mvr", "usd")

    return {
        "id": _safe_str(_first_value(item, "id", "sourceId", "source_id", "requestId", "request_id")),
        "requestNumber": _safe_str(_first_value(item, "requestNumber", "request_number", "requestName", "request_name", "requestOrderName", "request_order_name", "orderReference", "order_reference")),
        "reference": _safe_str(_first_value(item, "reference", "requestReference", "request_reference", "publicToken", "public_token")),
        "customerName": _safe_str(_first_value(item, "customerName", "customer_name") or _customer_name(customer)),
        "customerEmail": _safe_str(_first_value(item, "customerEmail", "customer_email", "email") or customer.get("email")),
        "status": _priority_status(item, "status", "approvalStatus", "approval_status", "cancelledAt", "cancelled_at", "canceledAt", "canceled_at"),
        "quoteStatus": _safe_str(_first_value(item, "quoteStatus", "quote_status", "shopifyDraftOrderStatus", "shopify_draft_order_status")),
        "paymentStatus": _priority_status(item, "paymentStatus", "payment_status", "receiptStatus", "receipt_status", "refundStatus", "refund_status") or _safe_str(quote.get("status")),
        "quotedTotal": _safe_number(quoted_total),
        "currency": _safe_str(_first_value(item, "currency", "currencyCode", "currency_code") or quote.get("currency")) or "MVR",
        "itemCount": _item_count(items, item) or _safe_int(details.get("quantity")),
        "createdAt": _safe_date(_first_value(item, "createdAt", "created_at", "requestedAt", "requested_at")),
        "updatedAt": _safe_date(_first_value(item, "updatedAt", "updated_at", "lastMessageAt", "last_message_at")),
        "linkedOrderId": _safe_str(_first_value(item, "linkedOrderId", "linked_order_id", "shopifyOrderId", "shopify_order_id")),
        "latestMessageStatus": _safe_str(_first_value(item, "latestMessageStatus", "latest_message_status", "lastMessageStatus", "last_message_status")),
        "emailStatus": _safe_str(_first_value(item, "emailStatus", "email_status", "quoteEmailLastError", "quote_email_last_error")),
        "sourceType": _safe_str(_first_value(item, "sourceType", "source_type")),
        "publicToken": _safe_str(_first_value(item, "publicToken", "public_token")),
        "productTitle": _safe_str(_first_value(item, "productTitle", "product_title") or details.get("productTitle")),
        "productUrl": _safe_str(_first_value(item, "productUrl", "product_url") or details.get("productUrl")),
        "receiptStatus": _safe_str(_first_value(item, "receiptStatus", "receipt_status")),
        "quoteMvr": _safe_str(_first_value(item, "quoteMvr", "quote_mvr")),
        "quoteUsd": _safe_str(_first_value(item, "quoteUsd", "quote_usd")),
        "source": _source_reference(item),
    }


def normalize_email_log(item: dict[str, Any]) -> dict[str, Any]:
    request = _first_dict(item, "request", "purchaseRequest", "purchase_request")
    metadata = _first_dict(item, "metadata", "meta")
    linked_request_id = _first_value(item, "requestId", "request_id") or request.get("id")
    linked_order_id = _first_value(item, "orderId", "order_id", "shopifyOrderId", "shopify_order_id") or request.get("linkedOrderId") or request.get("shopifyOrderId")

    return {
        "id": _safe_str(_first_value(item, "id", "sourceId", "source_id", "emailLogId", "email_log_id")),
        "shop": _safe_str(_first_value(item, "shop", "shopDomain", "shop_domain")),
        "provider": _safe_str(_first_value(item, "provider")),
        "direction": _safe_str(_first_value(item, "direction")),
        "messageType": _safe_str(_first_value(item, "messageType", "message_type", "type")),
        "eventType": _safe_str(_first_value(item, "eventType", "event_type", "event")),
        "status": _safe_str(_first_value(item, "status", "deliveryStatus", "delivery_status")),
        "fromEmail": _safe_str(_first_value(item, "fromEmail", "from_email", "from")),
        "toEmail": _safe_str(_first_value(item, "toEmail", "to_email", "to")),
        "subject": _safe_str(_first_value(item, "subject")),
        "resendEmailId": _safe_str(_first_value(item, "resendEmailId", "resend_email_id")),
        "webhookDeliveryId": _safe_str(_first_value(item, "webhookDeliveryId", "webhook_delivery_id")),
        "linkedRequestId": _safe_str(linked_request_id),
        "linkedOrderId": _safe_str(linked_order_id),
        "requestPublicToken": _safe_str(_first_value(item, "requestPublicToken", "request_public_token") or request.get("publicToken")),
        "orderReference": _safe_str(_first_value(item, "orderReference", "order_reference")),
        "requestCustomerName": _safe_str(request.get("customerName")),
        "requestCustomerEmail": _safe_str(request.get("customerEmail")),
        "requestProductTitle": _safe_str(request.get("productTitle")),
        "requestStatus": _safe_str(request.get("status")),
        "errorMessage": _safe_str(_first_value(item, "errorMessage", "error_message", "error")),
        "bodyPreview": _safe_str(_first_value(item, "bodyPreview", "body_preview", "preview", "snippet", "textPreview", "text_preview")),
        "metadataSummary": _metadata_summary(metadata),
        "createdAt": _safe_date(_first_value(item, "createdAt", "created_at", "sentAt", "sent_at")),
        "updatedAt": _safe_date(_first_value(item, "updatedAt", "updated_at")),
        "source": _source_reference(item),
    }


def _apply_local_filters(
    items: list[dict[str, Any]],
    *,
    search: str | None,
    status: str | None,
    date_from: date | None,
    date_to: date | None,
) -> list[dict[str, Any]]:
    search_text = (search or "").strip().lower()
    status_text = (status or "").strip().lower()

    def matches(item: dict[str, Any]) -> bool:
        status_haystack = " ".join(
            str(item.get(key) or "")
            for key in ("status", "quoteStatus", "paymentStatus", "financialStatus", "fulfillmentStatus")
        )
        if status_text and _filter_text(status_text) not in _filter_text(status_haystack):
            return False

        if search_text:
            haystack = " ".join(
                str(item.get(key) or "")
                for key in (
                    "id",
                    "orderName",
                    "orderNumber",
                    "requestNumber",
                    "reference",
                    "customerName",
                    "customerEmail",
                    "status",
                    "messageType",
                    "eventType",
                    "provider",
                    "subject",
                    "fromEmail",
                    "toEmail",
                    "orderReference",
                    "linkedRequestId",
                    "linkedOrderId",
                    "requestCustomerName",
                    "requestCustomerEmail",
                    "requestProductTitle",
                    "requestPublicToken",
                    "bodyPreview",
                    "metadataSummary",
                    "productTitle",
                    "productUrl",
                    "publicToken",
                    "paymentStatus",
                    "quoteStatus",
                )
            )
            if _filter_text(search_text) not in _filter_text(haystack):
                return False

        created_at = _parse_datetime(item.get("createdAt"))
        if date_from and created_at and created_at.date() < date_from:
            return False
        if date_to and created_at and created_at.date() > date_to:
            return False

        return True

    return [item for item in items if matches(item)]


def _filter_text(value: Any) -> str:
    return str(value or "").strip().lower().replace("_", " ").replace("-", " ")


def _attach_finance_summaries(
    items: list[dict[str, Any]],
    *,
    resource_type: str,
    db: Session,
) -> list[dict[str, Any]]:
    cost_records = db.scalars(select(models.InternalCostRecord)).all()
    context = crud.build_currency_conversion_context(db)
    enriched: list[dict[str, Any]] = []

    for item in items:
        candidates = _finance_match_candidates(item, resource_type)
        matched_records = [
            record
            for record in cost_records
            if _cost_record_matches(record, candidates)
        ]
        next_item = dict(item)
        next_item["financeSummary"] = _finance_summary_for_item(
            item,
            matched_records,
            context,
            resource_type=resource_type,
        )
        enriched.append(next_item)

    return enriched


def _finance_match_candidates(item: dict[str, Any], resource_type: str) -> set[str]:
    keys = (
        ("id", "orderName", "orderNumber", "linkedRequestId")
        if resource_type == "order"
        else ("id", "requestNumber", "reference", "publicToken", "linkedOrderId")
    )
    candidates = {
        _normalize_match_value(item.get(key))
        for key in keys
        if _normalize_match_value(item.get(key))
    }
    source = item.get("source")
    if isinstance(source, dict):
        candidates.add(_normalize_match_value(source.get("sourceId")))
    return {candidate for candidate in candidates if candidate}


def _cost_record_matches(record: models.InternalCostRecord, candidates: set[str]) -> bool:
    if not candidates:
        return False
    values = {
        _normalize_match_value(record.source_id),
        _normalize_match_value(record.linked_order_id),
        _normalize_match_value(record.linked_request_id),
        _normalize_match_value(record.reference_label),
    }
    return bool(candidates.intersection({value for value in values if value}))


def _finance_summary_for_item(
    item: dict[str, Any],
    records: list[models.InternalCostRecord],
    context: dict,
    *,
    resource_type: str,
) -> dict[str, Any]:
    total_sale = Decimal("0")
    total_cost = Decimal("0")
    total_profit = Decimal("0")
    converted_count = 0
    warnings: set[str] = set()
    safe_records = []

    for record in records:
        values = crud.cost_record_base_values(record, context)
        warnings.update(values["warnings"])
        if values["converted"]:
            converted_count += 1
            total_sale += Decimal(values["saleTotalBase"] or 0)
            total_cost += Decimal(values["totalCostBase"] or 0)
            total_profit += Decimal(values["profitBase"] or 0)
        safe_records.append(
            {
                "id": record.id,
                "sourceType": record.source_type,
                "sourceId": record.source_id,
                "linkedOrderId": record.linked_order_id,
                "linkedRequestId": record.linked_request_id,
                "referenceLabel": record.reference_label,
                "customerName": record.customer_name,
                "title": record.title,
                "saleTotal": _safe_decimal(record.sale_total),
                "totalCost": _safe_decimal(record.total_cost),
                "profit": _safe_decimal(record.profit),
                "marginPercent": _safe_optional_decimal(record.margin_percent),
                "currency": record.currency,
                "saleTotalBase": _safe_optional_decimal(values["saleTotalBase"]),
                "totalCostBase": _safe_optional_decimal(values["totalCostBase"]),
                "profitBase": _safe_optional_decimal(values["profitBase"]),
                "updatedAt": record.updated_at.isoformat(),
            }
        )

    margin = None if total_sale <= 0 else (total_profit / total_sale * Decimal("100")).quantize(Decimal("0.01"))
    has_cost_record = bool(records)
    return {
        "hasCostRecord": has_cost_record,
        "costRecordCount": len(records),
        "convertedRecordCount": converted_count,
        "excludedRecordCount": len(records) - converted_count,
        "totalSaleValueBase": _safe_decimal(total_sale),
        "totalCostValueBase": _safe_decimal(total_cost),
        "totalProfitBase": _safe_decimal(total_profit),
        "marginPercent": _safe_optional_decimal(margin),
        "missingCostRecord": (not has_cost_record) and _requires_cost_record(item, resource_type),
        "baseCurrency": context["baseCurrency"],
        "conversionWarnings": sorted(warnings),
        "costRecords": safe_records,
    }


def _requires_cost_record(item: dict[str, Any], resource_type: str) -> bool:
    status_text = _status_text_for_finance(item)
    if any(word in status_text for word in ("cancel", "refund", "reject", "declin", "void")):
        return False
    if resource_type == "order":
        return any(word in status_text for word in ("paid", "fulfilled", "complete", "approved", "success"))
    return any(word in status_text for word in ("paid", "approved", "complete", "success"))


def _status_text_for_finance(item: dict[str, Any]) -> str:
    return " ".join(
        str(value or "").lower()
        for value in (
            item.get("status"),
            item.get("financialStatus"),
            item.get("fulfillmentStatus"),
            item.get("quoteStatus"),
            item.get("paymentStatus"),
            item.get("receiptStatus"),
        )
    )


def _normalize_match_value(value: Any) -> str:
    return str(value or "").strip().lower()


def _safe_decimal(value: Decimal | int | float | None) -> float:
    return float(Decimal(value or 0).quantize(Decimal("0.01")))


def _safe_optional_decimal(value: Decimal | int | float | None) -> float | None:
    if value is None:
        return None
    return _safe_decimal(value)


def _safe_error_response(error: ZappApiError) -> JSONResponse:
    status_code = {
        "unauthorized": 502,
        "forbidden": 502,
        "not_found": 502,
        "timeout": 504,
        "server_error": 502,
        "invalid_response": 502,
        "unknown_error": 503,
        "success": 200,
    }[error.status]

    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "items": [],
            "total": 0,
            "errorType": error.status,
            "message": error.message,
            "upstreamStatus": error.upstream_status,
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
        },
    )


def _first_value(source: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = source.get(key)
        if value is not None and value != "":
            return value
    return None


def _first_dict(source: dict[str, Any], *keys: str) -> dict[str, Any]:
    for key in keys:
        value = source.get(key)
        if isinstance(value, dict):
            return value
    return {}


def _priority_status(source: dict[str, Any], *keys: str) -> str:
    values = [
        str(source.get(key) or "").strip()
        for key in keys
        if source.get(key) is not None and source.get(key) != ""
    ]
    joined = " ".join(values).lower()
    if "refund" in joined:
        return "refunded"
    if "cancel" in joined:
        return "cancelled"
    return _safe_str(values[0] if values else None)


def _customer_name(customer: dict[str, Any]) -> str:
    full_name = _first_value(customer, "name", "fullName", "full_name")
    if full_name:
        return str(full_name)

    first = str(_first_value(customer, "firstName", "first_name") or "").strip()
    last = str(_first_value(customer, "lastName", "last_name") or "").strip()
    return f"{first} {last}".strip()


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _safe_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, dict):
        value = _first_value(value, "amount", "value", "total")
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_date(value: Any) -> str:
    parsed = _parse_datetime(value)
    return parsed.isoformat() if parsed else ""


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, time.min)

    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _item_count(items: Any, source: dict[str, Any]) -> int | None:
    explicit = _first_value(source, "itemCount", "item_count", "quantity")
    if isinstance(explicit, int):
        return explicit
    if isinstance(explicit, str) and explicit.isdigit():
        return int(explicit)
    if isinstance(items, list):
        return len(items)
    return None


def _normalize_order_number(value: Any) -> str:
    return str(value or "").strip().replace("#", "", 1)


def _metadata_summary(metadata: dict[str, Any]) -> str:
    if not metadata:
        return ""
    keys = sorted(str(key) for key in metadata.keys())
    return ", ".join(keys[:8])


def _source_reference(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "sourceId": _safe_str(_first_value(item, "id", "sourceId", "source_id")),
        "availableFields": sorted(str(key) for key in item.keys()),
    }
