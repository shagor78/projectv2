export interface UserProfile {
  id: number;
  uid: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  avatarUrl?: string | null;
  role: string;
  roleId?: number | null;
  permissions?: string[];
  emailVerified: boolean;
  trialUsed: boolean;
  status: string;
}

export interface SubscriptionPackage {
  id: number;
  slug: string;
  name: string;
  durationDays: number;
  priceCents: number;
  currency: string;
  maxDevices: number;
  maxQuality: string;
  description: string;
  features: string[];
  isTrial: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface UserSubscription {
  id: number;
  userId: number;
  packageId: number;
  status: string;
  startsAt: string;
  expiresAt: string;
  autoRenew: boolean;
  paymentMethod: string;
  amountPaidCents: number;
  package: SubscriptionPackage;
}

export interface WalletInfo {
  id: number;
  userId: number;
  balanceCents: number;
  currency: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: number;
  walletId: number;
  userId: number;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  referenceKey: string;
  description: string;
  createdAt: string;
}

export interface ChannelCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  language: string;
  categoryType: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ChannelStream {
  id: number;
  channelId: number;
  label: string;
  streamUrl: string;
  priority: number;
  isActive: boolean;
  healthStatus: 'healthy' | 'degraded' | 'offline' | 'unknown';
  responseTimeMs: number | null;
  lastHttpStatus: number | null;
  lastError: string | null;
  lastCheckedAt: string | null;
  consecutiveFailures: number;
  playlistDetails?: {
    type?: string;
    variants?: number;
    segments?: number;
  };
}

export interface LiveChannel {
  id: number;
  name: string;
  slug: string;
  channelNumber: number;
  logoUrl: string;
  description: string;
  country: string;
  language: string;
  isFeatured: boolean;
  isPublished: boolean;
  showOnHomepage?: boolean;
  showOnLiveTv?: boolean;
  sortOrder: number;
  placements: string[];
  currentHealthStatus: 'healthy' | 'degraded' | 'offline' | 'unknown';
  lastCheckedAt: string | null;
  categories: ChannelCategory[];
  categoryIds?: number[];
  streams: ChannelStream[];
}

export interface ContentCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  contentType: string;
  language?: string;
  sortOrder: number;
  isActive?: boolean;
}

export interface EpisodeItem {
  id: number;
  seasonId: number;
  contentId: number;
  episodeNumber: number;
  title: string;
  synopsis: string;
  thumbnailUrl: string;
  hlsUrl: string;
  durationMinutes: number;
  releaseDate: string;
  isPublished: boolean;
}

export interface SeasonItem {
  id: number;
  contentId: number;
  seasonNumber: number;
  title: string;
  synopsis: string;
  posterUrl: string;
  releaseYear: number;
  isPublished: boolean;
  episodes: EpisodeItem[];
}

export interface ContentItem {
  id: number;
  title: string;
  slug: string;
  contentType: 'movie' | 'drama' | 'series' | 'sports';
  synopsis: string;
  posterUrl: string;
  backdropUrl: string;
  hlsUrl: string;
  trailerUrl?: string;
  releaseDate: string;
  releaseYear: number;
  durationMinutes: number;
  rating: string;
  maturityScore: string;
  language: string;
  country?: string;
  castList: string[];
  tags?: string[];
  director: string;
  isFeatured: boolean;
  isRecentlyAdded?: boolean;
  isPublished: boolean;
  requiresSubscription: boolean;
  placements: string[];
  sortOrder: number;
  viewCount: number;
  categories: ContentCategory[];
  categoryIds?: number[];
  seasonCount?: number;
  seasons?: SeasonItem[];
  createdAt?: string;
}

export interface PageHeroSlider {
  id: number;
  pageKey: string;
  name: string;
  autoplay: boolean;
  slideDurationMs: number;
  isActive: boolean;
  slideCount?: number;
}

export interface HeroSlide {
  id: number;
  sliderId?: number | null;
  pageKey?: string;
  title: string;
  subtitle: string;
  badgeText: string;
  categoryLabel?: string;
  languageLabel?: string;
  imageUrl: string;
  tabletImageUrl?: string;
  mobileImageUrl?: string;
  ctaLabel: string;
  ctaLink: string;
  secondaryCtaLabel?: string;
  secondaryCtaLink?: string;
  contentId: number | null;
  channelId: number | null;
  channelSlug?: string | null;
  channelLogoUrl?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface HomepageSectionItemRecord {
  id: number;
  sectionId: number;
  contentId: number | null;
  channelId: number | null;
  sortOrder: number;
}

export interface HomepageSection {
  id: number;
  title: string;
  subtitle?: string;
  slug: string;
  sectionType:
    | 'continue_watching'
    | 'latest_content'
    | 'live_channels'
    | 'news_channels'
    | 'movies'
    | 'drama'
    | 'series'
    | 'sports'
    | 'bangla_entertainment'
    | 'international_entertainment'
    | 'kids_family'
    | 'recommended'
    | 'recently_added'
    | 'featured'
    | 'custom';
  layoutStyle?: 'rail' | 'circle_rail' | 'channel_cards' | 'continue_watching';
  selectionMode?: 'auto' | 'manual' | 'hybrid';
  placementKey: string;
  categoryFilter?: string;
  languageFilter?: string;
  contentTypeFilter?: string;
  requiredPackageSlug?: string;
  viewAllLink?: string;
  showRecentlyAddedRibbon?: boolean;
  maxItems: number;
  sortOrder: number;
  isActive: boolean;
  items: any[];
  assignedItems?: HomepageSectionItemRecord[];
}

export interface UserDevice {
  id: number;
  userId: number;
  deviceIdentifier: string;
  deviceName: string;
  platform: string;
  userAgent: string;
  ipAddress: string;
  lastActiveAt: string;
  isRevoked: boolean;
}

export interface NavigationItemRecord {
  id: number;
  label: string;
  url: string;
  location: 'header' | 'footer' | 'footer_membership';
  parentId?: number | null;
  badgeText?: string | null;
  openInNewTab: boolean;
  sortOrder: number;
  isVisible: boolean;
}

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

export interface SitePageRecord {
  id: number;
  pageKey: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  heroHeading?: string | null;
  heroBody?: string | null;
  heroImageUrl?: string | null;
  sectionsJson: SitePageSection[];
  isPublished: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PublicSettings {
  platformName: string;
  supportEmail: string;
  maintenanceMode: boolean;
  logoUrl: string;
  faviconUrl: string;
  footerTagline: string;
  contactPhone: string;
  contactAddress: string;
  seoTitle: string;
  seoDescription: string;
  socialLinks: {
    facebook: string;
    youtube: string;
    instagram: string;
    x: string;
  };
  stripeConfigured?: boolean;
  smtpConfigured?: boolean;
}

export interface MediaAssetItem {
  filename: string;
  url: string;
  source: 'uploads' | 'builtin';
  sizeBytes: number;
  modifiedAt: string;
  usedBy: string[];
}

export interface ExcelImportRowDetail {
  sheet: string;
  row: number;
  identifier: string;
  action: 'inserted' | 'updated' | 'skipped' | 'error';
  message: string;
}

export interface ExcelImportReport {
  filename: string;
  mode: 'workspace' | 'upload' | 'seed';
  overwriteExisting: boolean;
  sheetsProcessed: string[];
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  perSheet: Record<string, { inserted: number; updated: number; skipped: number; errors: number }>;
  details: ExcelImportRowDetail[];
}

export interface ExcelImportLogRecord {
  id: number;
  filename: string;
  mode: string;
  overwriteExisting: boolean;
  sheetsProcessed: string[];
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  reportJson: {
    perSheet?: Record<string, { inserted: number; updated: number; skipped: number; errors: number }>;
    details?: ExcelImportRowDetail[];
  };
  createdAt: string;
}
