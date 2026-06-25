from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..config import get_settings
from ..database import get_db
from ..security import require_roles
from ..zapp_client import ZappApiClient, ZappApiError

router = APIRouter(prefix="/api/listed-product-pricing", tags=["listed-product-pricing"])


def _configured_shop() -> str:
    settings = get_settings()
    return (settings.zapp_shop_domain or "").strip()


def _safe_product_items(payload: Any) -> tuple[list[dict[str, Any]], bool]:
    if not isinstance(payload, dict):
        return [], False
    items = payload.get("items") or payload.get("products") or []
    if not isinstance(items, list):
        items = []
    return [item for item in items if isinstance(item, dict)], bool(payload.get("truncated"))


def _normalize_search(value: str | None) -> str:
    return str(value or "").strip().lower()


def _matches_product_search(product: schemas.ListedProductRead, search: str) -> bool:
    if not search:
        return True
    haystack = " ".join(
        [
            product.title,
            product.handle or "",
            product.legacyResourceId or "",
            *[
                " ".join([variant.title, variant.sku or "", variant.legacyResourceId or ""])
                for variant in product.variants
            ],
        ]
    ).lower()
    return search in haystack


@router.get("/products", response_model=schemas.ListedProductCollectionResponse)
async def get_listed_products(
    search: str | None = Query(default=None),
    _user=Depends(require_roles("admin", "manager")),
):
    settings = get_settings()
    client = ZappApiClient(
        base_url=settings.zapp_api_base_url,
        token=settings.zapp_api_token,
        timeout_seconds=settings.zapp_api_timeout_seconds,
    )
    params = {"shop": _configured_shop() or None}

    try:
        payload, _meta = await client.fetch_json(path="/api/internal/listed-products", params=params)
    except ZappApiError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc

    raw_items, truncated = _safe_product_items(payload)
    products = [
        schemas.ListedProductRead.model_validate(item)
        for item in raw_items
    ]
    search_text = _normalize_search(search)
    if search_text:
        products = [product for product in products if _matches_product_search(product, search_text)]

    return {
        "success": True,
        "items": products,
        "total": len(products),
        "truncated": truncated,
        "fetchedAt": datetime.now(timezone.utc),
    }


@router.get("/records", response_model=list[schemas.ListedProductPricingRead])
def get_pricing_records(
    product_id: str | None = Query(default=None),
    variant_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "manager")),
):
    return crud.list_listed_product_pricing_records(
        db,
        shop=_configured_shop(),
        product_id=product_id,
        variant_id=variant_id,
    )


@router.post("/records", response_model=schemas.ListedProductPricingRead, status_code=status.HTTP_201_CREATED)
def post_pricing_record(
    payload: schemas.ListedProductPricingCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "manager")),
):
    shop = _configured_shop()
    if not shop:
        raise HTTPException(status_code=422, detail="ZAPP shop domain is not configured.")
    return crud.create_listed_product_pricing_record(db, shop=shop, payload=payload)


@router.delete("/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pricing_record(
    record_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "manager")),
):
    record = crud.delete_listed_product_pricing_record(db, record_id, shop=_configured_shop())
    if record is None:
        raise HTTPException(status_code=404, detail="Pricing record not found.")
    return None
