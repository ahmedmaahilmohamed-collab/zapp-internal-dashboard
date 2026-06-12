from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import schemas
from ..config import get_settings
from ..database import get_db
from ..models import RefreshToken, UserAccess
from ..rate_limit import client_ip, rate_limit
from ..security import (
    create_access_token,
    create_refresh_token_value,
    get_current_user,
    hash_refresh_token,
    hash_password,
    refresh_token_expires_at,
    require_roles,
    verify_password,
)

router = APIRouter(prefix="/api", tags=["auth"])
settings = get_settings()

auth_rate_limit = rate_limit(
    name="auth",
    max_requests=settings.auth_rate_limit_requests,
    window_seconds=settings.auth_rate_limit_window_seconds,
)


@router.post(
    "/auth/register",
    response_model=schemas.AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(auth_rate_limit)],
)
def register(payload: schemas.UserRegister, request: Request, db: Session = Depends(get_db)):
    existing = db.scalar(select(UserAccess).where(UserAccess.email == payload.email))
    if existing is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user_count = db.scalar(select(func.count(UserAccess.id))) or 0
    is_first_user = user_count == 0
    user = UserAccess(
        email=payload.email,
        name=payload.name.strip() or payload.email,
        password_hash=hash_password(payload.password),
        role="admin" if is_first_user else "viewer",
        status="approved" if is_first_user else "pending",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    refresh_token = _issue_refresh_token(db, user=user, request=request)
    return {"access_token": create_access_token(user=user), "refresh_token": refresh_token, "user": user}


@router.post("/auth/login", response_model=schemas.AuthTokenResponse, dependencies=[Depends(auth_rate_limit)])
def login(payload: schemas.UserLogin, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(UserAccess).where(UserAccess.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if user.status in {"rejected", "disabled"}:
        raise HTTPException(status_code=403, detail=f"Access is {user.status}.")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    refresh_token = _issue_refresh_token(db, user=user, request=request)
    return {"access_token": create_access_token(user=user), "refresh_token": refresh_token, "user": user}


@router.post("/auth/refresh", response_model=schemas.AuthTokenResponse, dependencies=[Depends(auth_rate_limit)])
def refresh(payload: schemas.RefreshTokenRequest, request: Request, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    token_hash = hash_refresh_token(payload.refresh_token)
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if token is None or token.revoked_at is not None or token.expires_at <= now:
        raise HTTPException(status_code=401, detail="Invalid refresh session.")

    user = db.get(UserAccess, token.user_id)
    if user is None or user.status in {"rejected", "disabled"}:
        token.revoked_at = now
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid refresh session.")

    token.revoked_at = now
    db.commit()
    db.refresh(user)
    refresh_token = _issue_refresh_token(db, user=user, request=request)
    return {"access_token": create_access_token(user=user), "refresh_token": refresh_token, "user": user}


@router.get("/auth/me", response_model=schemas.UserRead)
def me(user: UserAccess = Depends(get_current_user)):
    return user


@router.post("/auth/logout")
def logout(payload: schemas.RefreshTokenRequest | None = None, db: Session = Depends(get_db)):
    if payload is not None:
        token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(payload.refresh_token)))
        if token is not None and token.revoked_at is None:
            token.revoked_at = datetime.now(timezone.utc)
            db.commit()
    return {"success": True}


@router.get("/access/users", response_model=list[schemas.UserRead])
def list_users(
    _admin: UserAccess = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    return db.scalars(select(UserAccess).order_by(UserAccess.created_at.desc())).all()


@router.put("/access/users/{user_id}", response_model=schemas.UserRead)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    admin: UserAccess = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    user = db.get(UserAccess, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    updates = payload.model_dump(exclude_unset=True)
    if user.id == admin.id and updates.get("status") in {"disabled", "rejected"}:
        raise HTTPException(status_code=422, detail="Admins cannot disable or reject their own account.")
    if user.id == admin.id and updates.get("role") and updates.get("role") != "admin":
        raise HTTPException(status_code=422, detail="Admins cannot remove their own admin role.")

    for key, value in updates.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


def _issue_refresh_token(db: Session, *, user: UserAccess, request: Request) -> str:
    raw_token = create_refresh_token_value()
    token = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=refresh_token_expires_at(),
        created_by_ip=client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:255] or None,
    )
    db.add(token)
    db.commit()
    return raw_token
