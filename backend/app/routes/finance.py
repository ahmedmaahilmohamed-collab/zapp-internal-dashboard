from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from ..security import require_roles

router = APIRouter(prefix="/api", tags=["finance"])


@router.get("/currencies", response_model=list[schemas.CurrencyRead])
def get_currencies(
    search: str | None = Query(default=None),
    include_inactive: bool = Query(default=True),
    _user=Depends(require_roles("admin", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    return crud.list_currencies(db, search=search, include_inactive=include_inactive)


@router.post("/currencies", response_model=schemas.CurrencyRead, status_code=status.HTTP_201_CREATED)
def post_currency(
    payload: schemas.CurrencyCreate,
    _user=Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    try:
        return crud.create_currency(db, payload)
    except crud.DuplicateRecordError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.put("/currencies/{currency_id}", response_model=schemas.CurrencyRead)
def put_currency(
    currency_id: int,
    payload: schemas.CurrencyUpdate,
    _user=Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    try:
        currency = crud.update_currency(db, currency_id, payload)
    except crud.DuplicateRecordError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if currency is None:
        raise HTTPException(status_code=404, detail="Currency not found.")
    return currency


@router.delete("/currencies/{currency_id}", response_model=schemas.CurrencyRead)
def delete_currency(
    currency_id: int,
    _user=Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    currency = crud.deactivate_currency(db, currency_id)
    if currency is None:
        raise HTTPException(status_code=404, detail="Currency not found.")
    return currency


@router.get("/shipping-rates", response_model=list[schemas.ShippingRateRead])
def get_shipping_rates(
    search: str | None = Query(default=None),
    destination_country: str | None = Query(default=None),
    carrier: str | None = Query(default=None),
    currency: str | None = Query(default=None),
    include_inactive: bool = Query(default=True),
    _user=Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    return crud.list_shipping_rates(
        db,
        search=search,
        destination_country=destination_country,
        carrier=carrier,
        currency=currency,
        include_inactive=include_inactive,
    )


@router.post("/shipping-rates", response_model=schemas.ShippingRateRead, status_code=status.HTTP_201_CREATED)
def post_shipping_rate(
    payload: schemas.ShippingRateCreate,
    _user=Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    return crud.create_shipping_rate(db, payload)


@router.put("/shipping-rates/{rate_id}", response_model=schemas.ShippingRateRead)
def put_shipping_rate(
    rate_id: int,
    payload: schemas.ShippingRateUpdate,
    _user=Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    try:
        rate = crud.update_shipping_rate(db, rate_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if rate is None:
        raise HTTPException(status_code=404, detail="Shipping rate not found.")
    return rate


@router.delete("/shipping-rates/{rate_id}", response_model=schemas.ShippingRateRead)
def delete_shipping_rate(
    rate_id: int,
    _user=Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    rate = crud.deactivate_shipping_rate(db, rate_id)
    if rate is None:
        raise HTTPException(status_code=404, detail="Shipping rate not found.")
    return rate


@router.get("/costs", response_model=list[schemas.CostRead])
def get_costs(
    search: str | None = Query(default=None),
    currency: str | None = Query(default=None),
    _user=Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    return crud.list_costs(db, search=search, currency=currency)


@router.post("/costs", response_model=schemas.CostRead, status_code=status.HTTP_201_CREATED)
def post_cost(
    payload: schemas.CostCreate,
    _user=Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    return crud.create_cost(db, payload)


@router.put("/costs/{cost_id}", response_model=schemas.CostRead)
def put_cost(
    cost_id: int,
    payload: schemas.CostUpdate,
    _user=Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    cost = crud.update_cost(db, cost_id, payload)
    if cost is None:
        raise HTTPException(status_code=404, detail="Cost record not found.")
    return cost


@router.delete("/costs/{cost_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cost(
    cost_id: int,
    _user=Depends(require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    cost = crud.delete_cost(db, cost_id)
    if cost is None:
        raise HTTPException(status_code=404, detail="Cost record not found.")
    return None


@router.post("/pricing/calculate", response_model=schemas.PricingCalculateResponse)
def calculate_pricing(
    payload: schemas.PricingCalculateRequest,
    _user=Depends(require_roles("admin", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    try:
        return crud.calculate_pricing(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
