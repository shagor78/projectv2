# Admin Usage Guide

Sign in at `/login` using an Administrator account (default seed: `admin@velostream.tv` / `VeloAdmin!2026`), then navigate to `/admin`.

---

## 1. Live TV, Channels & Unlimited HLS Streams

1. **Channel Categories:** Create or order IPTV categories (e.g., `Global News`, `Sports Live`, `Cinema 24/7`). Channels can belong to multiple categories and appear in multiple placements (`homepage_live`, `sports_hub`, `featured_live`).
2. **Live TV Management:** Add channels, upload custom channel logos (`/api/admin/upload`), assign channel numbers, and drag/reorder channel sort order.
3. **Stream URL Management (Unlimited Sources):**
   - Attach any number of HLS `.m3u8` URLs per channel with integer priorities (`1` = primary, `2+` = failover backups).
   - Click **Test Stream** or **Test All Streams** to validate beyond HTTP `200`: the backend verifies `#EXTM3U` syntax, inspects master variants, and verifies a media segment response before recording response latency and status (`healthy`, `degraded`, `offline`) to `stream_health_logs`.
   - Hourly background sweeps run automatically via `node-cron` (`0 * * * *`), logging failed and recovered stream transitions.

---

## 2. VOD Catalog (Movies, Drama, Web Series, Sports)

- Manage catalog titles across `movie`, `drama`, `series`, and `sports`.
- Upload posters (`3:4`) and hero backdrops (`16:9`), assign categories/placements, toggle `Featured` / `Published`, and set release years.
- For **Drama** and **Web Series**, open the **Seasons & Episodes** panel on any title to add numbered seasons and episode HLS sources, durations, and thumbnails.

---

## 3. Merchandising (Hero Slider & Homepage Layout)

- **Hero Slider:** Upload wide banners, configure CTA routes, and **drag-and-drop** slides to reorder the Homepage carousel immediately.
- **Homepage Layout:** Create, toggle, limit (`maxItems`), and **drag-and-drop** homepage content rows (`live_channels`, `movies`, `drama`, `series`, `sports`, `featured`, `recently_added`). Changes automatically invalidate cached `/api/home` feeds.

---

## 4. Packages, Wallets & Governance

- **Packages:** Edit prices, durations, device limits, and max quality for the 4 subscription tiers (`Free Access`, `Starter`, `Premium`, `Ultimate`). Price updates invalidate public caches immediately.
- **Wallets & Payments:** Credit or debit any user wallet with mandatory descriptions; every adjustment creates a ledger entry in `wallet_transactions` and an immutable record in `audit_logs`.
- **Users, Roles, Devices & Settings:** Manage user account status, configure custom Admin permission groups, revoke user devices, broadcast notifications, and inspect platform audit logs.
