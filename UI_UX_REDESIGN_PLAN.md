# VeloStream — UI/UX Redesign Plan

## 1. Visual Direction & Brand Identity

- **Brand Name:** **VeloStream** — A modern commercial OTT & Live IPTV streaming platform.
- **Visual Benchmark:** High-craft streaming presentation inspired by the content discovery polish and frictionless live/VOD ergonomics of top commercial OTT services, with an original visual identity.
- **Language Policy:** Strict English-only UI across all customer and admin views (zero Bangla text anywhere).

## 2. Color & Contrast System (60-30-10 Discipline)

- **60% Dominant Neutral Canvas:** Deep obsidian cinema slate `#080A0F` (main background) and `#0D1017` (elevated viewport bands).
- **30% Structural Surfaces:** `#131722` (cards, drawers, admin panels), `#1A202E` (hover/active surfaces), `rgba(255,255,255,0.08)` hairline borders.
- **10% Focused Accent:** Warm cinema amber `#F59E0B` / `#FBBF24` for primary play/subscribe CTAs, active tabs, and focus rings, paired with `#DC2626` strictly for live broadcast stream indicators and error states, and `#10B981` strictly for verified healthy stream telemetry.

## 3. Typography Hierarchy

- **Display & Headings:** `Plus Jakarta Sans` (Weights 600, 700, 800, tight tracking `-0.02em`, `text-wrap: balance` on hero headlines).
- **Body & Controls:** `DM Sans` (Weights 400, 500, 700, `15px–16px` body copy, crisp `12px–13px` unboxed metadata with `·` separators).
- **Metrics, Timestamps & Stream Telemetry:** `JetBrains Mono` with `tabular-nums` for response times (`ms`), wallet balances, durations, and table columns.

## 4. Customer-Facing Layout Architecture

### Top Navigation Bar (Strict 3-Zone Contract)
- **Left:** `VeloStream` wordmark.
- **Center:** Concise single-line navigation links (`Home`, `Live TV`, `Movies`, `Drama`, `Series`, `Sports`).
- **Right:** Expandable search trigger + single primary Account/Sign In action (with slide-over menu for Plans, Dashboard, Watch History, Favorites, Devices, and Admin Portal for authorized roles).

### Page-Specific Layouts (Distinct Structures, No Identical Clones)
1. **Homepage:** Full-bleed `16:9` widescreen Hero Slider with measured gradient scrim, followed by an Admin-ordered mix of Live Channel strip (horizontal channel tiles), Continue Watching progress rail, and 5-column poster carousels (`grid-cols-2 md:grid-cols-3 lg:grid-cols-5`).
2. **Live TV (Dedicated IPTV Experience):** Theater-first split workspace — Left/Top high-contrast `16:9` HLS Live Player with channel overlay, quality/audio/subtitle switcher, and real-time failover telemetry; Right/Bottom categorized EPG-style Channel Guide with crisp square channel logos, category filter bar, and quick one-click channel zapping.
3. **Movies / Drama / Web Series:** Genre & category filter bar, spotlight banner, and crisp **exact 5-cards-per-row desktop grid** (`lg:grid-cols-5`) with `3:4` poster aspect ratio, smooth hover zoom, and quick play/details overlay.
4. **Sports:** Match-day `16:9` broadcast cards, live tournament hero, and upcoming/replay schedule rail.
5. **Content Details:** Cinematic backdrop header, poster lockup, cast/director metadata, Watchlist/Favorite toggle, Season selector + Episode list for Drama & Web Series, and Related Content 5-card rail.
6. **Search:** Instant live filtering across Live Channels, Movies, Drama, Web Series, and Sports with segmented result tabs.
7. **Account & Billing Suite (Plans, Checkout, Dashboard, Profile, History, Favorites, Devices):** Clean dark tabbed account workspace with transparent 4-tier subscription matrix, transactional wallet ledger, device revocation list, and continue-watching management.

## 5. Admin SaaS Console Architecture

- **Workspace Canvas:** Persistent `256px` left sidebar grouped by domain (Overview, IPTV & Streams, VOD Catalog, Merchandising & Layout, Users & Billing, Security & Settings), top breadcrumb header, and crisp high-density data tables (`tabular-nums`).
- **Drag-and-Drop Content Management:** Interactive drag-and-drop ordering for Live TV channels, Hero Slider slides, and Homepage Layout sections persisted directly to PostgreSQL.
- **Zero Placeholder Controls:** Every modal, form, upload control, filter, pagination control, stream tester, and wallet adjustment executes real API requests against PostgreSQL.
