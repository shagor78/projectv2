import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// 1. Admin Roles & Permissions
// ---------------------------------------------------------------------------
export const adminRoles = pgTable('admin_roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description').default(''),
  permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// 2. Users, Email Verifications, Password Resets, Devices
// ---------------------------------------------------------------------------
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').unique(),
    phone: text('phone').unique(),
    passwordHash: text('password_hash'),
    fullName: text('full_name').notNull().default(''),
    avatarUrl: text('avatar_url').default(''),
    role: text('role').notNull().default('user'), // 'user' | 'admin' | 'super_admin' | 'editor' | 'operator'
    roleId: integer('role_id').references(() => adminRoles.id, { onDelete: 'set null' }),
    emailVerified: boolean('email_verified').notNull().default(false),
    trialUsed: boolean('trial_used').notNull().default(false),
    trialDeviceFingerprint: text('trial_device_fingerprint'),
    status: text('status').notNull().default('active'), // 'active' | 'suspended'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_phone_idx').on(table.phone),
    index('users_trial_fp_idx').on(table.trialDeviceFingerprint),
  ]
);

export const emailVerifications = pgTable('email_verifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const passwordResets = pgTable('password_resets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userDevices = pgTable(
  'user_devices',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    deviceIdentifier: text('device_identifier').notNull(),
    deviceName: text('device_name').notNull(),
    platform: text('platform').notNull().default('Web'),
    userAgent: text('user_agent').default(''),
    ipAddress: text('ip_address').default(''),
    lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
    isRevoked: boolean('is_revoked').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_devices_user_device_uidx').on(table.userId, table.deviceIdentifier),
  ]
);

// ---------------------------------------------------------------------------
// 3. Packages, Subscriptions, Wallets, Wallet Transactions & Payments
// ---------------------------------------------------------------------------
export const packages = pgTable('packages', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  durationDays: integer('duration_days').notNull(),
  priceCents: integer('price_cents').notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  maxDevices: integer('max_devices').notNull().default(2),
  maxQuality: text('max_quality').notNull().default('HD'),
  description: text('description').notNull().default(''),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  isTrial: boolean('is_trial').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    packageId: integer('package_id')
      .references(() => packages.id, { onDelete: 'restrict' })
      .notNull(),
    status: text('status').notNull().default('active'),
    startsAt: timestamp('starts_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    autoRenew: boolean('auto_renew').notNull().default(false),
    paymentMethod: text('payment_method').notNull().default('wallet'),
    amountPaidCents: integer('amount_paid_cents').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('subscriptions_user_status_idx').on(table.userId, table.status),
  ]
);

export const wallets = pgTable('wallets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  balanceCents: integer('balance_cents').notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: serial('id').primaryKey(),
    walletId: integer('wallet_id')
      .references(() => wallets.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(),
    amountCents: integer('amount_cents').notNull(),
    balanceAfterCents: integer('balance_after_cents').notNull(),
    referenceKey: text('reference_key').notNull().unique(),
    description: text('description').notNull(),
    performedByUserId: integer('performed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('wallet_tx_user_idx').on(table.userId, table.createdAt),
  ]
);

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  subscriptionId: integer('subscription_id').references(() => subscriptions.id, {
    onDelete: 'set null',
  }),
  packageId: integer('package_id').references(() => packages.id, {
    onDelete: 'set null',
  }),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('USD'),
  provider: text('provider').notNull().default('wallet'),
  status: text('status').notNull().default('completed'),
  referenceKey: text('reference_key').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// 4. Live TV Channels, Categories, Unlimited HLS Streams, Health Logs
// ---------------------------------------------------------------------------
export const channelCategories = pgTable('channel_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').default(''),
  iconUrl: text('icon_url').default(''),
  language: text('language').notNull().default('All'),
  categoryType: text('category_type').notNull().default('general'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const channels = pgTable(
  'channels',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    channelNumber: integer('channel_number').notNull().default(100),
    logoUrl: text('logo_url').notNull().default(''),
    description: text('description').default(''),
    country: text('country').default('Global'),
    language: text('language').default('English'),
    isFeatured: boolean('is_featured').notNull().default(false),
    isPublished: boolean('is_published').notNull().default(true),
    showOnHomepage: boolean('show_on_homepage').notNull().default(true),
    showOnLiveTv: boolean('show_on_live_tv').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    placements: jsonb('placements').$type<string[]>().notNull().default([]),
    currentHealthStatus: text('current_health_status').notNull().default('unknown'),
    lastCheckedAt: timestamp('last_checked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('channels_sort_idx').on(table.sortOrder),
    index('channels_published_idx').on(table.isPublished),
  ]
);

export const channelCategoryAssignments = pgTable(
  'channel_category_assignments',
  {
    id: serial('id').primaryKey(),
    channelId: integer('channel_id')
      .references(() => channels.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: integer('category_id')
      .references(() => channelCategories.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    uniqueIndex('channel_cat_assign_uidx').on(table.channelId, table.categoryId),
  ]
);

export const channelPlacements = pgTable(
  'channel_placements',
  {
    id: serial('id').primaryKey(),
    channelId: integer('channel_id')
      .references(() => channels.id, { onDelete: 'cascade' })
      .notNull(),
    placementKey: text('placement_key').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('channel_placement_uidx').on(table.channelId, table.placementKey),
    index('channel_placement_key_idx').on(table.placementKey, table.sortOrder),
  ]
);

export const channelStreams = pgTable(
  'channel_streams',
  {
    id: serial('id').primaryKey(),
    channelId: integer('channel_id')
      .references(() => channels.id, { onDelete: 'cascade' })
      .notNull(),
    label: text('label').notNull().default('Primary Stream'),
    streamUrl: text('stream_url').notNull(),
    priority: integer('priority').notNull().default(1),
    isActive: boolean('is_active').notNull().default(true),
    healthStatus: text('health_status').notNull().default('unknown'),
    responseTimeMs: integer('response_time_ms'),
    lastHttpStatus: integer('last_http_status'),
    lastError: text('last_error'),
    lastCheckedAt: timestamp('last_checked_at'),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    playlistDetails: jsonb('playlist_details').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('channel_streams_channel_prio_idx').on(table.channelId, table.priority),
  ]
);

export const streamHealthLogs = pgTable(
  'stream_health_logs',
  {
    id: serial('id').primaryKey(),
    channelId: integer('channel_id')
      .references(() => channels.id, { onDelete: 'cascade' })
      .notNull(),
    streamId: integer('stream_id')
      .references(() => channelStreams.id, { onDelete: 'cascade' })
      .notNull(),
    eventType: text('event_type').notNull(),
    previousStatus: text('previous_status').notNull().default('unknown'),
    newStatus: text('new_status').notNull(),
    responseTimeMs: integer('response_time_ms'),
    httpStatus: integer('http_status'),
    isPlayableHls: boolean('is_playable_hls').notNull().default(false),
    details: text('details').default(''),
    checkedAt: timestamp('checked_at').defaultNow().notNull(),
  },
  (table) => [
    index('stream_health_logs_checked_idx').on(table.checkedAt),
    index('stream_health_logs_stream_idx').on(table.streamId),
  ]
);

// ---------------------------------------------------------------------------
// 5. VOD Content (Movies, Drama, Web Series, Sports), Seasons & Episodes
// ---------------------------------------------------------------------------
export const contentCategories = pgTable('content_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').default(''),
  contentType: text('content_type').notNull().default('all'),
  language: text('language').notNull().default('All'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contents = pgTable(
  'contents',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    contentType: text('content_type').notNull(), // 'movie' | 'drama' | 'series' | 'sports'
    synopsis: text('synopsis').notNull().default(''),
    posterUrl: text('poster_url').notNull().default(''),
    backdropUrl: text('backdrop_url').notNull().default(''),
    hlsUrl: text('hls_url').default(''),
    trailerUrl: text('trailer_url').default(''),
    releaseDate: text('release_date').default('2026-01-01'),
    releaseYear: integer('release_year').notNull().default(2026),
    durationMinutes: integer('duration_minutes').notNull().default(90),
    rating: text('rating').notNull().default('PG-13'),
    maturityScore: text('maturity_score').default('8.4'),
    language: text('language').notNull().default('English'),
    country: text('country').notNull().default('International'),
    castList: jsonb('cast_list').$type<string[]>().notNull().default([]),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    director: text('director').default(''),
    isFeatured: boolean('is_featured').notNull().default(false),
    isRecentlyAdded: boolean('is_recently_added').notNull().default(true),
    isPublished: boolean('is_published').notNull().default(true),
    requiresSubscription: boolean('requires_subscription').notNull().default(false),
    placements: jsonb('placements').$type<string[]>().notNull().default([]),
    sortOrder: integer('sort_order').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('contents_type_pub_idx').on(table.contentType, table.isPublished),
  ]
);

export const contentCategoryAssignments = pgTable(
  'content_category_assignments',
  {
    id: serial('id').primaryKey(),
    contentId: integer('content_id')
      .references(() => contents.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: integer('category_id')
      .references(() => contentCategories.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    uniqueIndex('content_cat_assign_uidx').on(table.contentId, table.categoryId),
  ]
);

export const contentPlacements = pgTable(
  'content_placements',
  {
    id: serial('id').primaryKey(),
    contentId: integer('content_id')
      .references(() => contents.id, { onDelete: 'cascade' })
      .notNull(),
    placementKey: text('placement_key').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('content_placement_uidx').on(table.contentId, table.placementKey),
    index('content_placement_key_idx').on(table.placementKey, table.sortOrder),
  ]
);

export const seasons = pgTable(
  'seasons',
  {
    id: serial('id').primaryKey(),
    contentId: integer('content_id')
      .references(() => contents.id, { onDelete: 'cascade' })
      .notNull(),
    seasonNumber: integer('season_number').notNull(),
    title: text('title').notNull(),
    synopsis: text('synopsis').default(''),
    posterUrl: text('poster_url').default(''),
    releaseYear: integer('release_year').notNull().default(2026),
    isPublished: boolean('is_published').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('seasons_content_num_uidx').on(table.contentId, table.seasonNumber),
  ]
);

export const episodes = pgTable(
  'episodes',
  {
    id: serial('id').primaryKey(),
    seasonId: integer('season_id')
      .references(() => seasons.id, { onDelete: 'cascade' })
      .notNull(),
    contentId: integer('content_id')
      .references(() => contents.id, { onDelete: 'cascade' })
      .notNull(),
    episodeNumber: integer('episode_number').notNull(),
    title: text('title').notNull(),
    synopsis: text('synopsis').default(''),
    thumbnailUrl: text('thumbnail_url').default(''),
    hlsUrl: text('hls_url').notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(45),
    releaseDate: text('release_date').default('2026-01-01'),
    isPublished: boolean('is_published').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('episodes_season_num_uidx').on(table.seasonId, table.episodeNumber),
  ]
);

// ---------------------------------------------------------------------------
// 6. Merchandising, Navigation, CMS Pages & Excel Import Audit Logs
// ---------------------------------------------------------------------------
export const heroSlides = pgTable('hero_slides', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull().default(''),
  badgeText: text('badge_text').default('Featured'),
  imageUrl: text('image_url').notNull(),
  ctaLabel: text('cta_label').notNull().default('Watch Now'),
  ctaLink: text('cta_link').notNull().default('/movies'),
  contentId: integer('content_id').references(() => contents.id, { onDelete: 'set null' }),
  channelId: integer('channel_id').references(() => channels.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const pageHeroSliders = pgTable('page_hero_sliders', {
  id: serial('id').primaryKey(),
  pageKey: text('page_key').notNull().unique(),
  name: text('name').notNull(),
  autoplay: boolean('autoplay').notNull().default(true),
  slideDurationMs: integer('slide_duration_ms').notNull().default(6500),
  isActive: boolean('is_active').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const heroSliderItems = pgTable(
  'hero_slider_items',
  {
    id: serial('id').primaryKey(),
    sliderId: integer('slider_id').references(() => pageHeroSliders.id, { onDelete: 'cascade' }),
    pageKey: text('page_key').notNull().default('home'),
    title: text('title').notNull(),
    subtitle: text('subtitle').notNull().default(''),
    badgeText: text('badge_text').default('Featured'),
    categoryLabel: text('category_label').default(''),
    languageLabel: text('language_label').default(''),
    imageUrl: text('image_url').notNull(),
    tabletImageUrl: text('tablet_image_url').default(''),
    mobileImageUrl: text('mobile_image_url').default(''),
    ctaLabel: text('cta_label').notNull().default('Watch Now'),
    ctaLink: text('cta_link').notNull().default('/movies'),
    secondaryCtaLabel: text('secondary_cta_label').default(''),
    secondaryCtaLink: text('secondary_cta_link').default(''),
    contentId: integer('content_id').references(() => contents.id, { onDelete: 'set null' }),
    channelId: integer('channel_id').references(() => channels.id, { onDelete: 'set null' }),
    startsAt: timestamp('starts_at'),
    endsAt: timestamp('ends_at'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('hero_slider_items_page_sort_idx').on(table.pageKey, table.sortOrder),
  ]
);

export const homepageSections = pgTable('homepage_sections', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle').default(''),
  slug: text('slug').notNull().unique(),
  sectionType: text('section_type').notNull(),
  layoutStyle: text('layout_style').notNull().default('rail'),
  selectionMode: text('selection_mode').notNull().default('auto'),
  placementKey: text('placement_key').default(''),
  categoryFilter: text('category_filter').default(''),
  languageFilter: text('language_filter').default(''),
  contentTypeFilter: text('content_type_filter').default(''),
  requiredPackageSlug: text('required_package_slug').default(''),
  viewAllLink: text('view_all_link').default(''),
  showRecentlyAddedRibbon: boolean('show_recently_added_ribbon').notNull().default(false),
  maxItems: integer('max_items').notNull().default(10),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const homepageSectionItems = pgTable(
  'homepage_section_items',
  {
    id: serial('id').primaryKey(),
    sectionId: integer('section_id')
      .references(() => homepageSections.id, { onDelete: 'cascade' })
      .notNull(),
    contentId: integer('content_id').references(() => contents.id, { onDelete: 'cascade' }),
    channelId: integer('channel_id').references(() => channels.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('homepage_sec_items_sec_sort_idx').on(table.sectionId, table.sortOrder),
  ]
);

export const navigationItems = pgTable(
  'navigation_items',
  {
    id: serial('id').primaryKey(),
    label: text('label').notNull(),
    url: text('url').notNull(),
    location: text('location').notNull().default('header'), // 'header' | 'footer' | 'footer_membership'
    parentId: integer('parent_id'),
    badgeText: text('badge_text').default(''),
    openInNewTab: boolean('open_in_new_tab').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    isVisible: boolean('is_visible').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('navigation_items_loc_sort_idx').on(table.location, table.sortOrder),
  ]
);

export interface SitePageSection {
  id: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  imageUrl?: string;
  sortOrder: number;
  isVisible: boolean;
}

export const sitePages = pgTable(
  'site_pages',
  {
    id: serial('id').primaryKey(),
    pageKey: text('page_key').notNull().unique(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    subtitle: text('subtitle').default(''),
    metaTitle: text('meta_title').default(''),
    metaDescription: text('meta_description').default(''),
    heroHeading: text('hero_heading').default(''),
    heroBody: text('hero_body').default(''),
    heroImageUrl: text('hero_image_url').default(''),
    sectionsJson: jsonb('sections_json').$type<SitePageSection[]>().notNull().default([]),
    isPublished: boolean('is_published').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('site_pages_slug_idx').on(table.slug),
  ]
);

export const excelImportLogs = pgTable(
  'excel_import_logs',
  {
    id: serial('id').primaryKey(),
    filename: text('filename').notNull(),
    mode: text('mode').notNull().default('upload'), // 'workspace' | 'upload' | 'seed'
    overwriteExisting: boolean('overwrite_existing').notNull().default(false),
    sheetsProcessed: jsonb('sheets_processed').$type<string[]>().notNull().default([]),
    insertedCount: integer('inserted_count').notNull().default(0),
    updatedCount: integer('updated_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    reportJson: jsonb('report_json').$type<Record<string, unknown>>().notNull().default({}),
    importedByUserId: integer('imported_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('excel_import_logs_created_idx').on(table.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// 7. Watch History, Favorites, Notifications, System Settings, Audit Logs
// ---------------------------------------------------------------------------
export const watchHistory = pgTable(
  'watch_history',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    contentId: integer('content_id').references(() => contents.id, { onDelete: 'cascade' }),
    episodeId: integer('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
    channelId: integer('channel_id').references(() => channels.id, { onDelete: 'cascade' }),
    positionSeconds: integer('position_seconds').notNull().default(0),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    completed: boolean('completed').notNull().default(false),
    lastWatchedAt: timestamp('last_watched_at').defaultNow().notNull(),
  },
  (table) => [
    index('watch_history_user_last_idx').on(table.userId, table.lastWatchedAt),
  ]
);

export const favorites = pgTable(
  'favorites',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    contentId: integer('content_id').references(() => contents.id, { onDelete: 'cascade' }),
    channelId: integer('channel_id').references(() => channels.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('favorites_user_idx').on(table.userId),
  ]
);

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  category: text('category').notNull().default('general'),
  description: text('description').default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email').default('system'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').default(''),
    details: jsonb('details').$type<Record<string, unknown>>().default({}),
    ipAddress: text('ip_address').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_created_idx').on(table.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// Drizzle Relations
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ one, many }) => ({
  adminRole: one(adminRoles, { fields: [users.roleId], references: [adminRoles.id] }),
  devices: many(userDevices),
  subscriptions: many(subscriptions),
  wallet: one(wallets, { fields: [users.id], references: [wallets.userId] }),
  walletTransactions: many(walletTransactions),
  watchHistory: many(watchHistory),
  favorites: many(favorites),
}));

export const channelsRelations = relations(channels, ({ many }) => ({
  streams: many(channelStreams),
  categoryAssignments: many(channelCategoryAssignments),
  healthLogs: many(streamHealthLogs),
}));

export const channelStreamsRelations = relations(channelStreams, ({ one, many }) => ({
  channel: one(channels, { fields: [channelStreams.channelId], references: [channels.id] }),
  healthLogs: many(streamHealthLogs),
}));

export const contentsRelations = relations(contents, ({ many }) => ({
  seasons: many(seasons),
  episodes: many(episodes),
  categoryAssignments: many(contentCategoryAssignments),
}));

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
  content: one(contents, { fields: [seasons.contentId], references: [contents.id] }),
  episodes: many(episodes),
}));

export const episodesRelations = relations(episodes, ({ one }) => ({
  season: one(seasons, { fields: [episodes.seasonId], references: [seasons.id] }),
  content: one(contents, { fields: [episodes.contentId], references: [contents.id] }),
}));
