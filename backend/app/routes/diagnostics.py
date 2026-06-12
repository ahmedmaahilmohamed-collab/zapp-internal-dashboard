from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ..config import get_settings
from ..rate_limit import rate_limit
from ..security import require_roles
from ..zapp_client import ZappApiClient

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])
settings = get_settings()
diagnostics_rate_limit = rate_limit(
    name="diagnostics",
    max_requests=settings.diagnostics_rate_limit_requests,
    window_seconds=settings.diagnostics_rate_limit_window_seconds,
)


@router.get("/zapp-api", dependencies=[Depends(diagnostics_rate_limit)])
async def zapp_api_diagnostics(_admin=Depends(require_roles("admin"))):
    client = ZappApiClient(
        base_url=settings.zapp_api_base_url,
        token=settings.zapp_api_token,
        timeout_seconds=settings.zapp_api_timeout_seconds,
    )
    results = await client.run_diagnostics()

    return {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "configured": client.is_configured,
        "results": results,
    }
