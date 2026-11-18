# Installation Guide

This guide covers setting up VeloStream locally or inside a managed Node.js + PostgreSQL environment.

---

## 1. Prerequisites

- **Node.js:** `v22.x` or later (tested on `v22.23.2`).
- **PostgreSQL:** PostgreSQL 15+ (or Google Cloud SQL PostgreSQL).
- **Firebase Project:** Used for Google OAuth sign-in (`firebase-applet-config.json`).

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Environment Configuration

Copy `.env.example` to `.env` and set your PostgreSQL and optional service credentials:

```env
# PostgreSQL Connection (Cloud SQL / PG Pool)
SQL_HOST="127.0.0.1"
SQL_USER="postgres"
SQL_PASSWORD="your_db_password"
SQL_DB_NAME="velostream"

# Session Signing Secret
SESSION_SECRET="replace_with_a_long_random_64_char_secret"

# Optional Integrations
# STRIPE_SECRET_KEY="sk_live_..."      # Enables live card gateway checkout
# SMTP_HOST="smtp.example.com"         # Enables live transactional emails
# SMTP_USER="mailer@velostream.tv"
# SMTP_PASS="smtp_password"
```

Place your Firebase Web SDK configuration in `/firebase-applet-config.json`:

```json
{
  "projectId": "your-firebase-project-id",
  "appId": "your-firebase-app-id",
  "apiKey": "your-firebase-api-key",
  "authDomain": "your-firebase-project-id.firebaseapp.com"
}
```

---

## 4. Push Schema & Start Server

```bash
npx drizzle-kit push --config=src/db/drizzle.config.ts
npm run dev
```

On the first request to `/api/health` or `/api/home`, VeloStream automatically seeds the initial 4 subscription packages, Live TV channels, VOD catalog, Hero Slides, Homepage Sections, Roles, System Settings, and Admin/Member demo accounts idempotently.

---

## 5. Verification Commands

```bash
npm run lint    # Verify TypeScript types (tsc --noEmit)
npm run build   # Build production client bundle into dist/
npm test        # Execute Vitest integration tests against PostgreSQL
```
