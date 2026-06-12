# Production Checklist

## Platform

- [ ] Frontend is deployed on Vercel.
- [ ] Backend is deployed on Render.
- [ ] Database is Supabase PostgreSQL.
- [ ] Frontend custom domain is `dashboard.zappmv.com`.
- [ ] Backend custom domain is `api-dashboard.zappmv.com`.

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
- [ ] `FRONTEND_ORIGIN=https://dashboard.zappmv.com`.
- [ ] `CORS_ORIGINS` includes the Vercel production URL and `https://dashboard.zappmv.com`.

## Vercel Frontend

- [ ] Root directory is `frontend`.
- [ ] Build command is `npm run build`.
- [ ] Output directory is `dist`.
- [ ] `VITE_API_BASE_URL` points to `https://api-dashboard.zappmv.com` or the temporary Render API URL.
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
- [ ] First admin can register.
- [ ] Login/logout works.
- [ ] Pending user registration works.
- [ ] Admin can approve/reject/disable users.
- [ ] Overview loads database and live ZAPP API stats.
- [ ] Live Orders load from ZAPP API.
- [ ] Live Requests load from ZAPP API.
- [ ] Live Email Logs load from ZAPP API.
- [ ] Diagnostics pass for orders, purchase requests, and email logs.
- [ ] Currencies CRUD works.
- [ ] Shipping rate CRUD works.
- [ ] Cost record CRUD works.
- [ ] Pricing calculator works.
- [ ] Calculator result can be saved as a cost record.
