# ZAPP Internal Dashboard

Standalone full-stack foundation for the ZAPP internal operations dashboard.

This project is separate from the ZAPP Shopify app. The dashboard reads ZAPP
data through backend-only API calls and keeps its own dashboard data in
PostgreSQL as future phases are added.

## Project Structure

```text
zapp-internal-dashboard/
  backend/   FastAPI, httpx, PostgreSQL-ready config
  frontend/  React 18, TypeScript, Vite, Tailwind CSS, shadcn-style UI
```

## Backend Setup

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

Set real secrets in `backend/.env` or deployment secrets:

```text
ZAPP_API_BASE_URL=https://receipt-verification-app.onrender.com
ZAPP_API_TOKEN=your-secure-token
ZAPP_SHOP_DOMAIN=your-store.myshopify.com
DATABASE_URL=<local-or-supabase-postgres-url>
JWT_SECRET=replace-with-a-long-random-local-secret
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
FRONTEND_ORIGIN=http://127.0.0.1:5173
```

Never put real ZAPP, database, or JWT secrets in frontend env files or committed source.

## Frontend Setup

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

The frontend expects:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Current Functional Scope

- `GET /health`
- `GET /diagnostics/zapp-api`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/access/users`
- `PUT /api/access/users/{id}`
- `GET /api/overview/stats`
- `GET /api/orders`
- `GET /api/requests`
- `GET /api/email-logs`
- `GET/POST/PUT/DELETE /api/costs`
- `GET/POST/PUT/DELETE /api/currencies`
- `GET/POST/PUT/DELETE /api/shipping-rates`
- `POST /api/pricing/calculate`
- Dashboard shell with sidebar/top bar.
- Diagnostics page with live backend call.
- Functional Orders, Requests, and Email Logs pages with filters, pagination, responsive
  layouts, loading/empty/error states, and detail modals.
- Functional Costs, Currencies, and Shipping Rates pages with CRUD forms,
  active currency dropdowns, CSV exports, and toast notifications.
- Internal cost records use the practical finance fields:
  product purchase cost, BML/payment tax, import tax, shipping cost,
  additional cost, sale total, currency, optional linked ZAPP order/request
  IDs, snapshots, and notes.
- Shipping rates are base-currency-first. Existing rate currency values are
  preserved for compatibility, active overlapping weight tiers are rejected,
  and the calculator converts shipping costs through configured exchange rates.
- Functional Pricing Calculator using database currencies and shipping rates,
  with optional save to internal cost records.
- Login, request access, pending approval, role-based route gates, and admin
  access management.
- Functional Overview dashboard with database-backed finance/configuration
  stats, role-aware access summary, recent cost records, and safe ZAPP API
  availability states.
- Placeholder pages for the remaining sections.

Deployment targets are documented for Vercel, Render, and Supabase in
`docs/DEPLOYMENT.md`.

## First Admin

After migrations are applied and the backend is running, open the frontend and
go to `/register`. The first registered dashboard user becomes an approved
admin automatically. Every later registration starts as a pending viewer until
an admin approves it from Access Management.

Roles:

- `admin`: full dashboard access, including diagnostics and access management.
- `manager`: orders, requests, finance tables, shipping rates, currencies, and
  calculator.
- `viewer`: orders, requests, and calculator. Finance writes are blocked.

## Database

Run migrations from `backend/`:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Optional starter data:

```powershell
.\.venv\Scripts\python.exe scripts\seed.py
```

The local `backend/.env` file is ignored and should hold the private
`DATABASE_URL`. Do not put database credentials in frontend env files.

## Production

Production URLs:

- Frontend: `https://dashboard.zappmv.com`
- Backend API: `https://api-dashboard.zappmv.com`
- Health check: `https://api-dashboard.zappmv.com/health`
- ZAPP live API source: `https://receipt-verification-app.onrender.com`
- Database: Supabase PostgreSQL via backend-only `DATABASE_URL`

Production frontend environment:

```text
VITE_API_BASE_URL=https://api-dashboard.zappmv.com
```

Production backend environment:

```text
APP_ENV=production
FRONTEND_ORIGIN=https://dashboard.zappmv.com
CORS_ORIGINS=https://dashboard.zappmv.com
```

- Deployment guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Backup guide: [docs/BACKUPS.md](docs/BACKUPS.md)
- Production checklist: [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md)
