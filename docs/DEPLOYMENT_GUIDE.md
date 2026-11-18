# Deployment Guide

---

## 1. Production Build & Start

VeloStream bundles the React frontend into `dist/` and serves both the SPA and `/api/*` endpoints from a single Node.js server (`server.ts`) on port `3000` (or `process.env.PORT`).

```bash
npm install
npm run build
NODE_ENV=production npm start
```

Because `package.json` configures `"start": "node server.ts"` and all server TypeScript modules use Node 22 native type-stripping conventions (`import type`, `.ts` extensions, JSON `with { type: 'json' }`), `node server.ts` executes directly on Node `v22.18+` without an extra server transpilation step.

---

## 2. Cloud SQL / PostgreSQL Configuration

Ensure the runtime environment provides:

- `SQL_HOST` (Cloud SQL private/public IP or Unix socket path)
- `SQL_USER`
- `SQL_PASSWORD`
- `SQL_DB_NAME`
- `SESSION_SECRET` (strong random secret for signing `velostream_session` JWT cookies)

On startup, `server.ts` avoids eager `pool.connect()` health-check loops and runs `ensureSeeded()` lazily on the first incoming `/api` call.

---

## 3. Uploaded Media & Scaling Notes

- **Local Persistence:** By default, Admin image uploads save to `/uploads` and generated cinema assets reside in `/src/assets/images`. Mount `/uploads` to a persistent volume in single-instance container deployments, or extend `POST /api/admin/upload` to stream to S3/GCS when scaling horizontally across multiple replicas.
- **In-Memory Cache:** `src/server/cache.ts` caches `/api/home`, `/api/channels`, `/api/contents`, `/api/packages`, and `/api/settings/public` with automatic invalidation on Admin mutations. For multi-replica clusters, swap the cache store adapter for Redis via `REDIS_URL`.
- **Hourly Stream Cron:** `startStreamMonitorCron()` schedules `0 * * * *` inside the API process. In multi-replica deployments, run the sweep from a dedicated scheduler/worker to avoid duplicate checks.
