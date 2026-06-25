# Production Checklist

## Platform

- [ ] Frontend is deployed on Vercel.
- [ ] Backend is deployed on Render.
- [ ] Database is Supabase PostgreSQL.
- [ ] Frontend custom domain is `dashboard.zappmv.com`.
- [ ] Backend custom domain is `api-dashboard.zappmv.com`.
- [ ] Open `https://dashboard.zappmv.com`.
- [ ] Open `https://api-dashboard.zappmv.com/health`.

## Render Backend

- [ ] Root directory is `backend`.
- [ ] Build command is `pip install -r requirements.txt`.
- [ ] Start command is `python -m alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- [ ] Health check path is `/health`.
- [ ] `APP_ENV=production`.
- [ ] `DATABASE_URL` points to Supabase PostgreSQL.
- [ ] `JWT_SECRET` is long, random, and stored only in Render.
- [ ] `ZAPP_API_BASE_URL` points to the live ZAPP backend.
- [ ] `ZAPP_API_TOKEN` is stored only in Render.
- [ ] `ZAPP_SHOP_DOMAIN` is set to the Shopify `.myshopify.com` shop used by ZAPP.
- [ ] `FRONTEND_ORIGIN=https://dashboard.zappmv.com`.
- [ ] `CORS_ORIGINS=https://dashboard.zappmv.com`.

## Vercel Frontend

- [ ] Root directory is `frontend`.
- [ ] Build command is `npm run build`.
- [ ] Output directory is `dist`.
- [ ] `VITE_API_BASE_URL=https://api-dashboard.zappmv.com`.
- [ ] No backend secrets are present in Vercel environment variables.
- [ ] Deep links refresh correctly.

## Supabase

- [ ] Supabase project is created for dashboard data.
- [ ] Render can connect to Supabase.
- [ ] Alembic migrations run successfully.
- [ ] Automated backups are enabled.
- [ ] Manual backup is created before launch.
- [ ] Restore procedure is documented or tested outside production.

## Security

- [ ] No `.env` files are committed.
- [ ] No production tokens are present in repository files.
- [ ] Register/login rate limits are enabled.
- [ ] Diagnostics rate limit is enabled.
- [ ] Access Management is admin-only.
- [ ] Diagnostics is admin-only.
- [ ] `/health/details` is admin-only.
- [ ] First admin account is created by the intended owner.
- [ ] Pending users are reviewed before approval.
- [ ] Viewer and manager roles are tested.

## Functional Smoke Test

- [ ] `/health` returns `ok` with database check metadata.
- [ ] `https://api-dashboard.zappmv.com/health` returns `ok`.
- [ ] First admin can register.
- [ ] Login/logout works.
- [ ] Pending user registration works.
- [ ] Admin can approve/reject/disable users.
- [ ] Overview loads database and live ZAPP API stats.
- [ ] Live Orders load from ZAPP API.
- [ ] Live Requests load from ZAPP API.
- [ ] Live Email Logs load from ZAPP API.
- [ ] Diagnostics pass for orders, purchase requests, and email logs.
- [ ] Calculator loads and calculates.
- [ ] Live ZAPP API status shows connected.
- [ ] No secrets are present in repository files.
- [ ] Currencies CRUD works.
- [ ] Shipping rate CRUD works.
- [ ] Cost record CRUD works.
- [ ] Cost records use product purchase, BML/payment tax, import tax, shipping, additional cost, sale total, currency, and optional ZAPP links.
- [ ] Shipping rates default to active base currency and reject overlapping active tiers for the same route/carrier/service.
- [ ] Pricing calculator works.
- [ ] Calculator result can be saved as a cost record.
- [ ] CSV exports download for Orders, Requests, Email Logs, Costs, Currencies, and Shipping Rates.
