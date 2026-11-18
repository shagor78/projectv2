-- Migration 0001: CMS Pages, Navigation Menus, Content Tags, and Excel Import Audit Logs
-- Matches /database/schema/index.ts applied via Drizzle ORM

ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS navigation_items (
  id serial PRIMARY KEY,
  label text NOT NULL,
  url text NOT NULL,
  location text NOT NULL DEFAULT 'header',
  parent_id integer,
  badge_text text DEFAULT '',
  open_in_new_tab boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS navigation_items_loc_sort_idx
  ON navigation_items (location, sort_order);

CREATE TABLE IF NOT EXISTS site_pages (
  id serial PRIMARY KEY,
  page_key text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text DEFAULT '',
  meta_title text DEFAULT '',
  meta_description text DEFAULT '',
  hero_heading text DEFAULT '',
  hero_body text DEFAULT '',
  hero_image_url text DEFAULT '',
  sections_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_pages_slug_idx
  ON site_pages (slug);

CREATE TABLE IF NOT EXISTS excel_import_logs (
  id serial PRIMARY KEY,
  filename text NOT NULL,
  mode text NOT NULL DEFAULT 'upload',
  overwrite_existing boolean NOT NULL DEFAULT false,
  sheets_processed jsonb NOT NULL DEFAULT '[]'::jsonb,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  report_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS excel_import_logs_created_idx
  ON excel_import_logs (created_at);
