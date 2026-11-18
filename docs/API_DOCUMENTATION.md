# API Documentation

All API routes are served under `/api/*` by `backend/server.ts` (`backend/src/app.ts`). Authenticated routes accept either the HTTP-only `velostream_session` cookie or an `Authorization: Bearer <jwt>` header.

---

## 1. Public Discovery, Navigation, Pages & Catalog Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Database connectivity & lazy seed readiness check |
| `GET` | `/api/home` | Cached Hero Slides and Admin-ordered Homepage Sections (30s TTL) |
| `GET` | `/api/hero-sliders/:pageKey` | Page-specific hero slider config & active slides |
| `GET` | `/api/navigation` | Visible Header, Footer, and Footer Membership navigation menus |
| `GET` | `/api/pages` | List published CMS pages (`site_pages`) |
| `GET` | `/api/pages/:slug` | Single published CMS page with structured sections & SEO metadata |
| `GET` | `/api/settings/public` | Public platform name, logo, favicon, tagline, contact info, social links, SEO metadata |
| `GET` | `/api/channels` | Live TV categories & published channels with prioritized HLS streams |
| `GET` | `/api/channels/:slug` | Single channel detail with prioritized HLS streams |
| `POST` | `/api/channels/:id/streams/:streamId/failover-report` | Records client-side HLS player failover telemetry |
| `GET` | `/api/contents` | VOD catalog (`?type=movie\|drama\|series\|sports&category=&featured=&placement=&search=`) |
| `GET` | `/api/contents/:slug` | Content details with Seasons, Episodes, and related titles |
| `GET` | `/api/search?q=` | Global cross-catalog search across Channels, Movies, Drama, Web Series, and Sports |
| `GET` | `/api/packages` | Active Admin-configured subscription plans |

---

## 2. Authentication & Device Session Endpoints (`/api/auth/*`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Create user with optional 15-day free trial & device abuse check |
| `POST` | `/api/auth/login` | Authenticate via email or phone + password; registers active device |
| `POST` | `/api/auth/google` | Verify Firebase Google OAuth ID token & issue session |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET` | `/api/auth/me` | Current user profile, active subscription, and wallet balance |
| `PATCH` | `/api/auth/profile` | Update full name, phone, avatar URL, or password |
| `POST` | `/api/auth/verify-email/request` | Generate email verification token |
| `POST` | `/api/auth/verify-email/confirm` | Verify email with token |
| `POST` | `/api/auth/password-reset/request` | Generate password reset token |
| `POST` | `/api/auth/password-reset/confirm` | Reset password using valid token |
| `GET` | `/api/auth/devices` | List active and revoked user devices |
| `DELETE` | `/api/auth/devices/:id` | Revoke device session access |

---

## 3. Member Account, Wallet & Subscriptions (`/api/*`, Auth Required)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/user/dashboard` | User summary: subscription, wallet, transactions, watch history, favorites, notifications |
| `POST` | `/api/subscriptions/subscribe` | Activate trial, wallet purchase, or card checkout (`503` if Stripe unconfigured) |
| `POST` | `/api/subscriptions/:id/cancel` | Cancel active subscription |
| `GET` | `/api/wallet/transactions` | Wallet balance and ledger history |
| `POST` | `/api/wallet/topup` | Credit wallet with unique `referenceKey` idempotency guard (`409` on duplicate) |
| `GET` | `/api/watch-history` | Resume playback positions for VOD & Live TV |
| `POST` | `/api/watch-history` | Upsert playback progress |
| `DELETE` | `/api/watch-history` | Clear watch history |
| `GET` | `/api/favorites` | List saved channels & VOD titles |
| `POST` | `/api/favorites/toggle` | Add or remove favorite channel/content |
| `GET` | `/api/notifications` | Fetch member + broadcast notifications |
| `POST` | `/api/notifications/:id/read` | Mark notification read |

---

## 4. Admin Control Plane (`/api/admin/*`, Admin RBAC Required)

| Area | Endpoints |
| :--- | :--- |
| **Overview & Analytics** | `GET /api/admin/overview`, `GET /api/admin/analytics` |
| **Media Library** | `POST /api/admin/upload`, `GET /api/admin/media`, `POST /api/admin/media/replace`, `DELETE /api/admin/media/:filename` |
| **Live TV & Categories** | `GET/POST/PATCH/DELETE /api/admin/channel-categories`, `PUT /api/admin/channel-categories/reorder`, `GET/POST/PATCH/DELETE /api/admin/channels`, `PUT /api/admin/channels/reorder` |
| **Unlimited Streams & Health** | `POST /api/admin/channels/:id/streams`, `PATCH/DELETE /api/admin/streams/:id`, `POST /api/admin/streams/:id/test`, `POST /api/admin/channels/:id/test-streams`, `POST /api/admin/streams/check-all`, `GET /api/admin/stream-health-logs` |
| **VOD, Seasons & Episodes** | `GET/POST /api/admin/content-categories`, `GET/POST/PATCH/DELETE /api/admin/contents`, `POST/DELETE /api/admin/contents/:id/seasons`, `POST/DELETE /api/admin/seasons/:id/episodes` |
| **CMS Pages & Navigation** | `GET/POST/PATCH/DELETE /api/admin/pages`, `GET/POST/PATCH/DELETE /api/admin/navigation`, `PUT /api/admin/navigation/reorder` |
| **Excel & CSV Import** | `GET /api/admin/excel/status`, `GET /api/admin/excel/logs`, `GET /api/admin/excel/template`, `POST /api/admin/excel/import-workspace`, `POST /api/admin/excel/upload` |
| **Hero & Homepage Layout** | `GET/PATCH /api/admin/hero-sliders`, `GET/POST/PATCH/DELETE /api/admin/hero-slides`, `PUT /api/admin/hero-slides/reorder`, `GET/POST/PATCH/DELETE /api/admin/homepage-sections`, `PUT /api/admin/homepage-sections/reorder`, `PUT /api/admin/homepage-sections/:id/items`, `GET/PUT /api/admin/placements` |
| **Users, Billing & Wallets** | `GET/POST/PATCH/DELETE /api/admin/users`, `GET/PATCH /api/admin/packages`, `GET /api/admin/subscriptions`, `POST /api/admin/subscriptions/grant`, `POST /api/admin/subscriptions/:id/expire`, `GET /api/admin/wallets`, `POST /api/admin/wallets/:userId/adjust`, `GET /api/admin/transactions`, `GET /api/admin/payments` |
| **Governance & Settings** | `GET/POST /api/admin/notifications`, `GET/DELETE /api/admin/devices`, `GET/POST/PATCH /api/admin/roles`, `GET/PUT /api/admin/settings`, `GET /api/admin/audit-logs` |
