# Backend

FastAPI backend for the standalone ZAPP internal dashboard.

## Setup

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` with real `ZAPP_API_BASE_URL`, `ZAPP_API_TOKEN`, `DATABASE_URL`,
`JWT_SECRET`, `CORS_ORIGINS`, and `FRONTEND_ORIGIN` values.

## Run

```powershell
uvicorn app.main:app --reload --port 8000
```

## Endpoints

- `GET /health`
- `GET /diagnostics/zapp-api`
- `GET /api/orders`
- `GET /api/requests`
- `GET /api/email-logs`
- `GET/POST/PUT/DELETE /api/costs`
- `GET/POST/PUT/DELETE /api/currencies`
- `GET/POST/PUT/DELETE /api/shipping-rates`
- `POST /api/pricing/calculate`

The ZAPP bearer token is only read server-side and is never returned in API responses.

Internal cost records store practical finance fields while preserving legacy
columns during the `20260613_0004` migration. Shipping rate writes validate
active currency codes and reject overlapping active tiers for the same route,
carrier, service, and weight band.

## Database

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe scripts\seed.py
```

`DATABASE_URL` is loaded from local `.env` only.
