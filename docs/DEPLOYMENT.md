# ZAPP Internal Dashboard Deployment

This dashboard is standalone. It is not part of the ZAPP Shopify app and must
not share frontend secrets with it.

Phase 9 target:

- Frontend: Vercel
- Backend: Render
- Database: Supabase PostgreSQL

Production URLs:

```text
Frontend: https://dashboard.zappmv.com
Backend API: https://api-dashboard.zappmv.com
Health check: https://api-dashboard.zappmv.com/health
Vercel project: zapp-internal-dashboard
ZAPP live API source: https://receipt-verification-app.onrender.com
```

Do not deploy automatically from a local machine unless the owner explicitly
asks for it. Do not commit `.env` files or paste production secrets into docs,
issues, chat, screenshots, or frontend environment variables.

## Backend: Render

Create a Render Web Service for the dashboard API.

Settings:

```text
Root directory: backend
Build command: pip install -r requirements.txt
Start command: python -m alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health check path: /health
```

The root `render.yaml` is already aligned with these values.

Required backend environment variables:

```text
APP_ENV=production
DATABASE_URL=<Supabase pooled or direct PostgreSQL connection string>
JWT_SECRET=<long random secret generated for this dashboard only>
ZAPP_API_BASE_URL=https://receipt-verification-app.onrender.com
ZAPP_API_TOKEN=<same internal token expected by the live ZAPP backend>
FRONTEND_ORIGIN=https://dashboard.zappmv.com
CORS_ORIGINS=https://dashboard.zappmv.com
```

Optional backend environment variables:

```text
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=30
ZAPP_API_TIMEOUT_SECONDS=10
AUTH_RATE_LIMIT_REQUESTS=8
AUTH_RATE_LIMIT_WINDOW_SECONDS=300
DIAGNOSTICS_RATE_LIMIT_REQUESTS=20
DIAGNOSTICS_RATE_LIMIT_WINDOW_SECONDS=300
```

Backend custom domain:

```text
api-dashboard.zappmv.com
```

After the custom domain is active, set frontend `VITE_API_BASE_URL` to:

```text
https://api-dashboard.zappmv.com
```

## Frontend: Vercel

Create a Vercel project for the dashboard frontend.

Settings:

```text
Root directory: frontend
Framework preset: Vite
Build command: npm run build
Output directory: dist
```

The `frontend/vercel.json` file keeps SPA refresh/deep-link rewrites and
declares the production build/output settings.

Required frontend environment variable:

```text
VITE_API_BASE_URL=https://api-dashboard.zappmv.com
```

Do not keep a temporary Render API URL in Vercel production settings. Use only:

```text
VITE_API_BASE_URL=https://api-dashboard.zappmv.com
```

Frontend custom domain:

```text
dashboard.zappmv.com
```

## Supabase PostgreSQL

1. Create a Supabase project for the dashboard.
2. Copy the PostgreSQL connection string into Render as `DATABASE_URL`.
3. Prefer Supabase pooler for runtime connections if available.
4. Confirm Render can connect by checking `/health`.
5. Let the Render start command run Alembic migrations on deploy.

Do not put `DATABASE_URL` in Vercel or any frontend environment.

The `20260613_0004` migration adds practical internal cost record columns and
backfills them from the preserved legacy finance columns. It does not drop the
old columns in this release.

## Deploy Hook

Render deploy hooks are secret URLs. Keep the hook in a password manager,
terminal session, or CI secret such as `RENDER_DEPLOY_HOOK_URL`; do not commit
it to this repository.

When the owner explicitly asks for a backend deploy, trigger the hook without
printing its value:

```powershell
Invoke-WebRequest -Method POST -Uri $env:RENDER_DEPLOY_HOOK_URL
```

## Go-Live Checklist

- [ ] Open `https://api-dashboard.zappmv.com/health`.
- [ ] Open `https://dashboard.zappmv.com`.
- [ ] Supabase database is created and reachable from Render.
- [ ] `DATABASE_URL` is set only in Render backend environment variables.
- [ ] Alembic migrations pass on Render deploy.
- [ ] Render `/health` returns database `ok: true`.
- [ ] First admin account is created by the intended owner.
- [ ] Live ZAPP diagnostics pass for orders, purchase requests, and email logs.
- [ ] `CORS_ORIGINS` is `https://dashboard.zappmv.com`.
- [ ] `FRONTEND_ORIGIN` is `https://dashboard.zappmv.com`.
- [ ] Vercel `VITE_API_BASE_URL` is `https://api-dashboard.zappmv.com`.
- [ ] No secrets are committed to source control.
- [ ] Production frontend build passes.
- [ ] Browser refresh works on `/orders`, `/requests`, `/email-logs`, `/diagnostics`, and `/calculator`.
- [ ] Overview loads.
- [ ] Orders load.
- [ ] Requests load.
- [ ] Email Logs load.
- [ ] Diagnostics loads.
- [ ] Calculator loads.
- [ ] Live ZAPP API status shows connected.
- [ ] Access Management is admin-only.
- [ ] Diagnostics and health details are admin-only where applicable.

## Smoke Test

1. Open `https://dashboard.zappmv.com/register`.
2. Register the first admin account.
3. Log out and log back in.
4. Open `/`, `/orders`, `/requests`, `/email-logs`, `/diagnostics`, `/calculator`, `/costs`, `/currencies`, `/shipping-rates`, and `/access-management`.
5. Confirm live Orders, Requests, and Email Logs show `Live API connected`.
6. Create, update, and delete a test cost record.
7. Run a pricing calculation and save it as a cost record.
8. Register a second user and confirm they remain pending until approved.

## Rollback

- Frontend: promote or redeploy the previous Vercel deployment.
- Backend: roll back to the previous Render deploy.
- Database: restore from Supabase point-in-time recovery or latest verified export.
