from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .database import engine
from .observability import RequestContextMiddleware, log_event, setup_logging
from .routes import api, auth, diagnostics, finance, health, listed_product_pricing, notifications, overview, reports
from .zapp_client import ZappApiClient

setup_logging()
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
)

app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(diagnostics.router)
app.include_router(api.router)
app.include_router(finance.router)
app.include_router(listed_product_pricing.router)
app.include_router(overview.router)
app.include_router(reports.router)
app.include_router(notifications.router)


@app.on_event("startup")
async def startup_diagnostics():
    zapp_client = ZappApiClient(
        base_url=settings.zapp_api_base_url,
        token=settings.zapp_api_token,
        timeout_seconds=settings.zapp_api_timeout_seconds,
    )
    log_event(
        "startup",
        app_name=settings.app_name,
        app_env=settings.app_env,
        database_configured=engine is not None,
        jwt_configured=bool(settings.jwt_secret_key),
        zapp_api_configured=zapp_client.is_configured,
        cors_origin_count=len(settings.cors_origins),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    sanitized_errors = [
        {
            "loc": error.get("loc"),
            "msg": error.get("msg"),
            "type": error.get("type"),
        }
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "detail": sanitized_errors,
            "requestId": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "requestId": getattr(request.state, "request_id", None),
        },
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    log_event(
        "unhandled_exception",
        request_id=getattr(request.state, "request_id", None),
        path=request.url.path,
        error_type=type(exc).__name__,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error.",
            "requestId": getattr(request.state, "request_id", None),
        },
    )
