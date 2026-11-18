# VEXORA — OTT & Live IPTV Streaming Platform

VEXORA is a full-stack commercial OTT and IPTV platform separated cleanly into `frontend/`, `backend/`, and `database/` layers, powered by React 19, TypeScript, Tailwind CSS v4, Express, Drizzle ORM, Cloud SQL (PostgreSQL), Firebase Authentication (Google OAuth), and `hls.js`.

---

## Folder Architecture

- **`frontend/`**: Vite + React 19 SPA (`src/components/`, `src/context/`, `src/pages/`, `src/pages/admin/`, `src/services/`, `src/hooks/`, `src/types/`, `public/`).
- **`backend/`**: Express REST API (`src/config/`, `src/controllers/`, `src/middleware/`, `src/routes/`, `src/services/`, `src/validators/`, `src/utils/`, `uploads/`, `tests/`, `server.ts`).
- **`database/`**: Centralized PostgreSQL schema (`schema/`), Drizzle connection (`index.ts`), configuration (`drizzle.config.ts`), SQL migrations (`migrations/`), idempotent seeds (`seeds/`), and backup/restore documentation (`README.md`).

---

## Core Capabilities

- **Dynamic Storefront & CMS Pages:** Admin-managed Hero Sliders, Homepage Layout Sections, Header & Footer Navigation Menus (`navigation_items`), Website Branding & SEO Settings (`SiteConfigContext`), and Custom CMS Pages (`/page/:slug` backed by `site_pages`).
- **Live TV IPTV & Adaptive HLS Failover:** Unlimited HLS stream URLs per Live TV channel with priority ranking, playable HLS manifest probing (`#EXTM3U` + variant + media segment inspection), client-side failover telemetry, and hourly background health sweeps.
- **Commercial Subscriptions & Wallets:** 4 Admin-configured plans (`Free Access`, `Starter`, `Premium`, `Ultimate`), atomic PostgreSQL transactions with `referenceKey` duplicate prevention, device-fingerprint trial abuse enforcement, and audited wallet credits/debits.
- **Commercial Admin Console:** Live TV & Streams, Movies/Drama/Series/Sports (tags, previews, pagination, delete confirmation), CMS Pages, Navigation Menus, Media Library (scan/upload/replace/delete), Excel/CSV Bulk Import (`dataexcel.xlsx` + upload + template + import logs), Users/Admin creation & deletion, Packages, Subscriptions, Wallets, Payments, Notifications, Devices, Roles, Website Settings, and Audit Logs.

---

## Seeded Demo Credentials

- **Administrator:** `admin@velostream.tv` / `VeloAdmin!2026`
- **Demo Member:** `member@velostream.tv` / `VeloUser!2026`

---

## Quick Start

```bash
npm install
npm run db:push      # Push Drizzle schema to PostgreSQL
npm run db:seed      # Seed initial OTT data + idempotently import dataexcel.xlsx
npm run dev          # Unified Express + Vite server on http://0.0.0.0:3000
npm run dev:split    # Split mode: Backend API (3000) + Frontend Vite (5173)
npm run build        # Production frontend bundle
npm test             # Runs Vitest suite (backend/tests)
npm run lint         # TypeScript check (tsc --noEmit)
```

---

## Documentation Index

- [Database & Backup Guide](database/README.md)
- [Installation Guide](docs/INSTALLATION_GUIDE.md)
- [Database Migration Guide](docs/DATABASE_MIGRATION_GUIDE.md)
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Admin Usage Guide](docs/ADMIN_USAGE_GUIDE.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Platform Compatibility Guide](docs/PLATFORM_COMPATIBILITY_GUIDE.md)
