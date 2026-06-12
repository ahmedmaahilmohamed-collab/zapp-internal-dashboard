# Database Backups

Use Supabase managed backups as the primary backup path. Keep manual exports for release milestones and before migrations.

## Supabase Strategy

- Enable Point-in-Time Recovery if the production plan supports it.
- Confirm automated backups are enabled.
- Before each schema migration, create a manual backup in Supabase.
- Record the migration revision and backup timestamp in release notes.
- Test restore into a non-production database before relying on a backup process.

## Manual Export

Run from a trusted machine with `pg_dump` installed. Do not paste credentials into docs or shell history where possible.

```powershell
$env:DATABASE_URL="<supabase-database-url>"
pg_dump $env:DATABASE_URL --format=custom --file zapp_internal_dashboard.dump
```

## Manual Import

Restore into an empty target database:

```powershell
$env:DATABASE_URL="<target-database-url>"
pg_restore --clean --if-exists --no-owner --dbname $env:DATABASE_URL zapp_internal_dashboard.dump
```

## Verification

After restore:

```powershell
cd backend
python -m alembic current
python -m alembic upgrade head
```

Then sign in as an admin and verify:

- `/health/details`
- Overview stats
- Currencies
- Shipping rates
- Cost records
- Access Management
