# Database Management (`database/`)

VEXORA uses **PostgreSQL** managed via **Drizzle ORM** (`drizzle-orm/node-postgres` + `drizzle-kit`).

## Directory Structure

- `database/index.ts`: PostgreSQL `pg.Pool` singleton using object-based credentials (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`) and Drizzle ORM client.
- `database/schema/index.ts`: Canonical schema definition (35 tables covering auth/RBAC, wallets/subscriptions, Live TV channels & unlimited HLS streams, VOD catalog, Hero sliders, Homepage sections, CMS pages, Navigation menus, System settings, and Excel import audit logs).
- `database/drizzle.config.ts`: Drizzle Kit CLI configuration targeting `./database/schema/index.ts` and `./database/migrations`.
- `database/migrations/`: Versioned SQL migrations generated or applied against PostgreSQL.
- `database/seeds/seed.ts`: Idempotent database initialization and seed script (also imports workspace `dataexcel.xlsx` when present).
- `database/backups/`: Directory for local `pg_dump` snapshots and restore verification.

## Common Commands

```bash
# Push schema changes directly to PostgreSQL
npm run db:push

# Generate SQL migration files from schema changes
npm run db:generate

# Run idempotent seed + dataexcel.xlsx initialization
npm run db:seed
```

## Backup & Restore

### Creating a Backup

```bash
pg_dump -h "$SQL_HOST" -U "$SQL_ADMIN_USER" -d "$SQL_DB_NAME" -F c -f database/backups/vexora_$(date +%Y%m%d_%H%M%S).dump
```

### Restoring from Backup

```bash
pg_restore -h "$SQL_HOST" -U "$SQL_ADMIN_USER" -d "$SQL_DB_NAME" --clean --if-exists database/backups/<backup_file>.dump
```

## Schema Compatibility Bridge

`src/db/schema.ts`, `src/db/index.ts`, and `src/db/drizzle.config.ts` re-export from `database/` so automated schema sync tools continue working seamlessly while keeping all database definitions centralized inside `database/`.
