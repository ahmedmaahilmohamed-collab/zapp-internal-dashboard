from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text

from ..config import get_settings
from ..database import engine
from ..security import require_roles
from ..zapp_client import ZappApiClient

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    settings = get_settings()
    database = _database_health()
    status = "ok" if database["ok"] else "degraded"
    return {
        "status": status,
        "service": settings.app_name,
        "environment": settings.app_env,
        "checks": {
            "database": database,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/details")
async def health_details(_admin=Depends(require_roles("admin"))):
    settings = get_settings()
    zapp_client = ZappApiClient(
        base_url=settings.zapp_api_base_url,
        token=settings.zapp_api_token,
        timeout_seconds=settings.zapp_api_timeout_seconds,
    )
    database = _database_health()
    return {
        "status": "ok" if database["ok"] else "degraded",
        "service": settings.app_name,
        "environment": settings.app_env,
        "checks": {
            "database": database,
            "auth": {
                "jwtConfigured": bool(settings.jwt_secret_key),
                "accessTokenMinutes": settings.jwt_access_token_expire_minutes,
                "refreshTokenDays": settings.refresh_token_expire_days,
            },
            "zappApi": {
                "configured": zapp_client.is_configured,
                "timeoutSeconds": settings.zapp_api_timeout_seconds,
            },
            "cors": {
                "originCount": len(settings.cors_origins),
            },
            "rateLimits": {
                "authRequests": settings.auth_rate_limit_requests,
                "authWindowSeconds": settings.auth_rate_limit_window_seconds,
                "diagnosticsRequests": settings.diagnostics_rate_limit_requests,
                "diagnosticsWindowSeconds": settings.diagnostics_rate_limit_window_seconds,
            },
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _database_health() -> dict:
    if engine is None:
        return {"ok": False, "configured": False}

    try:
        started = datetime.now(timezone.utc)
        with engine.connect() as connection:
            connection.execute(text("select 1"))
        elapsed_ms = round((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        return {"ok": True, "configured": True, "elapsedMs": elapsed_ms}
    except Exception:
        return {"ok": False, "configured": True}
