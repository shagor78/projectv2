# Database Migration Guide

VeloStream uses **Drizzle ORM** with **PostgreSQL (`pg`)** defined in `src/db/schema.ts` and configured in `src/db/drizzle.config.ts`.

---

## 1. Schema Overview (27 Tables)

| Domain | Tables |
| :--- | :--- |
| **Users & Auth** | `users`, `admin_roles`, `email_verifications`, `password_resets`, `user_devices` |
| **Live TV & HLS Health** | `channel_categories`, `channels`, `channel_category_assignments`, `channel_streams`, `stream_health_logs` |
| **VOD & Episodic Catalog** | `content_categories`, `contents`, `content_category_assignments`, `seasons`, `episodes` |
| **Merchandising** | `hero_slides`, `homepage_sections` |
| **Billing & Wallets** | `packages`, `subscriptions`, `wallets`, `wallet_transactions`, `payments` |
| **Engagement & Governance** | `watch_history`, `favorites`, `notifications`, `system_settings`, `audit_logs` |

---

## 2. Applying Schema Changes

### Development / Cloud SQL Direct Push

```bash
npx drizzle-kit push --config=src/db/drizzle.config.ts
```

### Generate Versioned SQL Migrations

```bash
npx drizzle-kit generate --config=src/db/drizzle.config.ts
npx drizzle-kit migrate --config=src/db/drizzle.config.ts
```

---

## 3. Data Integrity & Constraints

- **Duplicate Transaction Guard:** `wallet_transactions.reference_key` and `payments.reference_key` enforce unique constraints, paired with PostgreSQL ACID `db.transaction()` blocks in `src/server/services/walletAndSub.ts`.
- **Category Join Uniqueness:** `channel_category_assignments` and `content_category_assignments` enforce composite unique indexes `(channel_id, category_id)` and `(content_id, category_id)`.
- **Trial Abuse Enforcement:** `users.trial_used` and `users.trial_device_fingerprint` prevent claiming multiple 15-day trials from the same account or device fingerprint.
- **Lazy Idempotent Seeding:** `ensureSeeded()` in `src/server/seed.ts` checks table counts once on the first API call (`seeded` promise memoized) so startup stays fast without eager database polling loops.
