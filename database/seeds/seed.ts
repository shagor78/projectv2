import bcrypt from 'bcryptjs';
import { count, eq, like, sql } from 'drizzle-orm';
import { db } from '../index.ts';
import {
  adminRoles,
  channelCategories,
  channelCategoryAssignments,
  channelPlacements,
  channels,
  channelStreams,
  contentCategories,
  contentCategoryAssignments,
  contentPlacements,
  contents,
  episodes,
  heroSliderItems,
  heroSlides,
  homepageSectionItems,
  homepageSections,
  navigationItems,
  notifications,
  packages,
  pageHeroSliders,
  seasons,
  sitePages,
  systemSettings,
  users,
  wallets,
  walletTransactions,
} from '../schema/index.ts';
import { BANGLA_DRAMAS_CATALOG } from './banglaDramasCatalog.ts';
import { UPLOADED_CHANNEL_LOGOS_CATALOG } from './channelLogosCatalog.ts';

function makeStudioLogo(svgInner: string, bg = '#FFFFFF'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="${bg}"/>${svgInner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildBroadcastLogoMap(): Record<string, string> {
  return {
    'velonews-24': makeStudioLogo(
      `<rect x="24" y="56" width="192" height="72" rx="10" fill="#0F172A"/>
       <rect x="24" y="136" width="192" height="46" rx="8" fill="#DC2626"/>
       <text x="120" y="103" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="34" letter-spacing="1" fill="#FFFFFF">VELO</text>
       <text x="120" y="168" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="25" letter-spacing="2" fill="#FFFFFF">NEWS 24</text>`
    ),
    'apex-sports-1': makeStudioLogo(
      `<polygon points="22,64 176,64 160,122 22,122" fill="#DC2626"/>
       <rect x="166" y="64" width="52" height="58" rx="8" fill="#0F172A"/>
       <text x="94" y="105" text-anchor="middle" font-family="Arial,sans-serif" font-style="italic" font-weight="900" font-size="34" fill="#FFFFFF">APEX</text>
       <text x="192" y="106" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="34" fill="#FFFFFF">1</text>
       <text x="120" y="164" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="28" letter-spacing="2" fill="#0F172A">SPORTS HD</text>`
    ),
    'gridline-motorsport': makeStudioLogo(
      `<rect x="26" y="58" width="188" height="12" rx="4" fill="#18181B"/>
       <rect x="26" y="168" width="188" height="12" rx="4" fill="#EF4444"/>
       <text x="120" y="120" text-anchor="middle" font-family="Arial,sans-serif" font-style="italic" font-weight="900" font-size="31" fill="#18181B">GRIDLINE</text>
       <text x="120" y="152" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="22" letter-spacing="3" fill="#DC2626">MOTORSPORT</text>`
    ),
    'marquee-cinema-hd': makeStudioLogo(
      `<rect x="24" y="54" width="192" height="132" rx="18" fill="#111827"/>
       <circle cx="46" cy="76" r="6" fill="#F59E0B"/><circle cx="194" cy="76" r="6" fill="#F59E0B"/>
       <circle cx="46" cy="164" r="6" fill="#F59E0B"/><circle cx="194" cy="164" r="6" fill="#F59E0B"/>
       <text x="120" y="114" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="26" letter-spacing="1.5" fill="#FFFFFF">MARQUEE</text>
       <rect x="66" y="130" width="108" height="30" rx="6" fill="#F59E0B"/>
       <text x="120" y="152" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="18" fill="#111827">CINEMA HD</text>`
    ),
    'velodrama-prime': makeStudioLogo(
      `<rect x="26" y="64" width="188" height="62" rx="12" fill="#4F46E5"/>
       <text x="120" y="107" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="34" letter-spacing="1" fill="#FFFFFF">DRAMA</text>
       <text x="120" y="164" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="24" letter-spacing="3" fill="#EC4899">PRIME TV</text>`
    ),
    'terra-nova-docs': makeStudioLogo(
      `<circle cx="120" cy="94" r="38" fill="none" stroke="#059669" stroke-width="10"/>
       <circle cx="120" cy="94" r="14" fill="#F59E0B"/>
       <text x="120" y="162" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="24" letter-spacing="1.5" fill="#064E3B">TERRA NOVA</text>
       <text x="120" y="186" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="14" letter-spacing="3" fill="#059669">DOCUMENTARY</text>`
    ),
    'brightspark-family': makeStudioLogo(
      `<circle cx="76" cy="92" r="28" fill="#F59E0B"/>
       <circle cx="120" cy="82" r="30" fill="#EC4899"/>
       <circle cx="164" cy="92" r="28" fill="#0EA5E9"/>
       <text x="120" y="156" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="26" fill="#1E1B4B">BRIGHTSPARK</text>
       <text x="120" y="180" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="15" letter-spacing="2" fill="#DB2777">KIDS &amp; FAMILY</text>`
    ),
    'metro-beats-live': makeStudioLogo(
      `<rect x="52" y="88" width="16" height="48" rx="6" fill="#9333EA"/>
       <rect x="78" y="64" width="16" height="72" rx="6" fill="#EC4899"/>
       <rect x="104" y="48" width="16" height="88" rx="6" fill="#9333EA"/>
       <rect x="130" y="72" width="16" height="64" rx="6" fill="#EC4899"/>
       <rect x="156" y="58" width="16" height="78" rx="6" fill="#9333EA"/>
       <text x="120" y="176" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="24" letter-spacing="1" fill="#111827">METRO BEATS</text>`
    ),
    'channel-i-hd': makeStudioLogo(
      `<path d="M24,116 Q120,56 216,116 L216,144 Q120,100 24,144 Z" fill="#008C45"/>
       <rect x="24" y="74" width="192" height="28" rx="4" fill="#008C45"/>
       <text x="120" y="95" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="20" letter-spacing="2.5" fill="#FFFFFF">CHANNEL</text>
       <circle cx="120" cy="134" r="24" fill="#E11D48"/>
       <text x="120" y="146" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-weight="900" font-size="36" fill="#FFFFFF">i</text>`
    ),
    'somoy-news-24': makeStudioLogo(
      `<rect x="26" y="54" width="188" height="74" rx="10" fill="#B91C1C"/>
       <text x="120" y="106" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="36" letter-spacing="1" fill="#FFFFFF">SOMOY</text>
       <rect x="26" y="138" width="188" height="44" rx="8" fill="#111827"/>
       <text x="120" y="168" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="22" letter-spacing="2" fill="#FBBF24">NEWS 24</text>`
    ),
    'ntv-bangla': makeStudioLogo(
      `<text x="90" y="156" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-weight="900" font-size="136" fill="#FFFFFF">n</text>
       <text x="172" y="156" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="48" fill="#FFFFFF">tv</text>`,
      '#007A3D'
    ),
    'desh-cinema-hd': makeStudioLogo(
      `<circle cx="120" cy="96" r="46" fill="#DC2626"/>
       <text x="120" y="110" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="30" fill="#FFFFFF">DESH</text>
       <rect x="44" y="152" width="152" height="32" rx="8" fill="#0F172A"/>
       <text x="120" y="174" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="17" letter-spacing="2" fill="#FDE047">CINEMA HD</text>`
    ),
    'b4u-movies-india': makeStudioLogo(
      `<polygon points="44,58 196,46 184,132 32,144" fill="#6D28D9"/>
       <text x="116" y="114" text-anchor="middle" font-family="Arial,sans-serif" font-style="italic" font-weight="900" font-size="56" fill="#F97316">B4U</text>
       <rect x="52" y="152" width="136" height="32" rx="8" fill="#EA580C"/>
       <text x="120" y="175" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="20" letter-spacing="2" fill="#FFFFFF">MOVIES</text>`
    ),
    'zing-music-india': makeStudioLogo(
      `<rect x="26" y="68" width="188" height="104" rx="22" fill="#DB2777"/>
       <text x="120" y="136" text-anchor="middle" font-family="Arial,sans-serif" font-style="italic" font-weight="900" font-size="58" letter-spacing="2" fill="#FFFFFF">ZING</text>`
    ),
    'aajtak-world-desk': makeStudioLogo(
      `<polygon points="22,68 218,54 202,132 22,146" fill="#DC2626"/>
       <text x="120" y="114" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="38" fill="#FFFFFF">AAJ TAK</text>
       <text x="120" y="176" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="20" letter-spacing="2.5" fill="#111827">WORLD DESK</text>`
    ),
    'vexora-sports-arena': makeStudioLogo(
      `<rect x="26" y="54" width="188" height="74" rx="12" fill="#0F172A"/>
       <text x="120" y="102" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="30" letter-spacing="2" fill="#FFFFFF">VEXORA</text>
       <rect x="26" y="136" width="188" height="46" rx="10" fill="#E11D48"/>
       <text x="120" y="167" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="23" letter-spacing="2" fill="#FFFFFF">SPORTS HD</text>`
    ),
    'peace-heritage-tv': makeStudioLogo(
      `<circle cx="120" cy="96" r="42" fill="#065F46"/>
       <text x="120" y="108" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="26" fill="#FDE68A">PEACE</text>
       <text x="120" y="172" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="20" letter-spacing="2" fill="#064E3B">HERITAGE TV</text>`
    ),
    'sylhet-regional-live': makeStudioLogo(
      `<rect x="30" y="58" width="180" height="68" rx="14" fill="#15803D"/>
       <text x="120" y="104" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="30" letter-spacing="1" fill="#FFFFFF">SYLHET</text>
       <text x="120" y="164" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="22" letter-spacing="2" fill="#14532D">REGIONAL TV</text>`
    ),
  };
}

function makeSvgLogo(shortName: string, bg: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="#FFFFFF"/><rect x="28" y="64" width="184" height="112" rx="18" fill="${bg}"/><text x="120" y="132" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="40" letter-spacing="1" fill="${accent}">${shortName}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Public adaptive HLS test streams (Mux & Apple official HLS demo manifests)
const MUX_ABR_STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const APPLE_BIPBOP_MULTITRACK =
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8';
const MUX_PTS_STREAM = 'https://test-streams.mux.dev/pts_shift/master.m3u8';
const APPLE_BASIC_STREAM =
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      console.error('[Seed] Failed:', err);
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const [{ value: pkgCount }] = await db.select({ value: count() }).from(packages);
  if (pkgCount > 0) {
    await ensureLayoutSeeded();
    return;
  }

  console.log('[Seed] Initializing VEXORA PostgreSQL catalog and configuration...');

  // 1. Admin Roles
  const [superAdminRole] = await db
    .insert(adminRoles)
    .values([
      {
        name: 'Super Admin',
        slug: 'super-admin',
        description: 'Full unrestricted access across all platform modules.',
        permissions: ['*'],
      },
      {
        name: 'Content Editor',
        slug: 'content-editor',
        description: 'Manage movies, drama, web series, sports, hero slider, and layout.',
        permissions: ['content.manage', 'layout.manage'],
      },
      {
        name: 'IPTV Operator',
        slug: 'iptv-operator',
        description: 'Manage Live TV channels, categories, stream priorities, and health tests.',
        permissions: ['channels.manage', 'streams.manage'],
      },
      {
        name: 'Billing Manager',
        slug: 'billing-manager',
        description: 'Manage packages, subscriptions, wallets, and payment records.',
        permissions: ['billing.manage', 'users.view'],
      },
    ])
    .returning();

  // 2. Users (Admin + Demo Member)
  const adminPasswordHash = await bcrypt.hash('VeloAdmin!2026', 10);
  const memberPasswordHash = await bcrypt.hash('VeloUser!2026', 10);

  const [adminUser] = await db
    .insert(users)
    .values({
      uid: 'local_admin_velostream',
      email: 'admin@velostream.tv',
      phone: '+15550100001',
      passwordHash: adminPasswordHash,
      fullName: 'VeloStream Operations',
      role: 'super_admin',
      roleId: superAdminRole.id,
      emailVerified: true,
      trialUsed: true,
      status: 'active',
    })
    .onConflictDoNothing()
    .returning();

  const [memberUser] = await db
    .insert(users)
    .values({
      uid: 'local_member_velostream',
      email: 'member@velostream.tv',
      phone: '+15550100002',
      passwordHash: memberPasswordHash,
      fullName: 'Alex Mercer',
      role: 'user',
      emailVerified: true,
      trialUsed: false,
      status: 'active',
    })
    .onConflictDoNothing()
    .returning();

  if (adminUser) {
    await db.insert(wallets).values({ userId: adminUser.id, balanceCents: 0, currency: 'USD' }).onConflictDoNothing();
  }
  if (memberUser) {
    const [memberWallet] = await db
      .insert(wallets)
      .values({ userId: memberUser.id, balanceCents: 5000, currency: 'USD' })
      .onConflictDoNothing()
      .returning();
    if (memberWallet) {
      await db.insert(walletTransactions).values({
        walletId: memberWallet.id,
        userId: memberUser.id,
        type: 'credit',
        amountCents: 5000,
        balanceAfterCents: 5000,
        referenceKey: 'seed_welcome_credit_member',
        description: 'Initial promotional wallet credit',
      });
    }
  }

  // 3. Exact 4 Initial Subscription Packages (Admin-controlled prices)
  await db.insert(packages).values([
    {
      slug: 'free-access',
      name: 'Free Access',
      durationDays: 15,
      priceCents: 0,
      currency: 'USD',
      maxDevices: 1,
      maxQuality: 'HD',
      description: 'Complimentary 15-day full-platform trial for new accounts.',
      features: [
        '15 Days Unlimited Live TV & VOD',
        '720p HD Adaptive Streaming',
        '1 Registered Device',
        'Continue Watching Sync',
      ],
      isTrial: true,
      isActive: true,
      sortOrder: 1,
    },
    {
      slug: 'starter',
      name: 'Starter',
      durationDays: 90,
      priceCents: 1499,
      currency: 'USD',
      maxDevices: 2,
      maxQuality: 'FHD',
      description: '3-month plan for everyday cinema, drama, and live broadcasts.',
      features: [
        '3 Months Full Live TV & VOD Access',
        '1080p Full HD Adaptive Bitrate',
        'Up to 2 Concurrent Devices',
        'Multi-Audio & Subtitle Tracks',
      ],
      isTrial: false,
      isActive: true,
      sortOrder: 2,
    },
    {
      slug: 'premium',
      name: 'Premium',
      durationDays: 180,
      priceCents: 2699,
      currency: 'USD',
      maxDevices: 4,
      maxQuality: '4K',
      description: '6-month household tier with 4K UHD and multi-screen streaming.',
      features: [
        '6 Months Uncapped Live & On-Demand',
        '4K Ultra HD + HDR Playback',
        'Up to 4 Concurrent Devices',
        'Priority Live Sports & Zero-Buffer Failover',
      ],
      isTrial: false,
      isActive: true,
      sortOrder: 3,
    },
    {
      slug: 'ultimate',
      name: 'Ultimate',
      durationDays: 365,
      priceCents: 4999,
      currency: 'USD',
      maxDevices: 6,
      maxQuality: '4K',
      description: 'Annual all-access pass with maximum device slots and Smart TV support.',
      features: [
        '1 Full Year Complete Platform Access',
        '4K Ultra HD + Multi-Language Audio',
        'Up to 6 Registered Devices',
        'Dedicated VIP Support & Early Releases',
      ],
      isTrial: false,
      isActive: true,
      sortOrder: 4,
    },
  ]);

  // 4. Channel Categories
  const insertedChannelCats = await db
    .insert(channelCategories)
    .values([
      { name: 'News & World', slug: 'news-world', description: '24/7 global news desks and briefings', sortOrder: 1 },
      { name: 'Sports Live', slug: 'sports-live', description: 'Live matches, motorsport, and arena feeds', sortOrder: 2 },
      { name: 'Cinema & Hits', slug: 'cinema-hits', description: 'Nonstop feature films and premieres', sortOrder: 3 },
      { name: 'Entertainment', slug: 'entertainment', description: 'Drama, talk shows, and lifestyle', sortOrder: 4 },
      { name: 'Documentary', slug: 'documentary', description: 'Science, nature, and investigative series', sortOrder: 5 },
      { name: 'Kids & Family', slug: 'kids-family', description: 'Safe animated and family programming', sortOrder: 6 },
    ])
    .returning();

  const chCatMap = Object.fromEntries(insertedChannelCats.map((c) => [c.slug, c.id]));

  // 5. Live TV Channels (with unlimited HLS streams; channel 1 has 6 streams to demonstrate >5 support)
  const channelSeeds = [
    {
      name: 'VeloNews 24',
      slug: 'velonews-24',
      channelNumber: 101,
      logoUrl: makeSvgLogo('VN24', '#0F172A', '#F59E0B'),
      description: 'Global breaking news, financial markets, and live international press briefings.',
      country: 'United States',
      language: 'English',
      isFeatured: true,
      sortOrder: 1,
      placements: ['homepage_live', 'featured_channels'],
      categories: ['news-world', 'entertainment'],
      streams: [
        { label: 'North America Primary CDN', streamUrl: MUX_ABR_STREAM, priority: 1 },
        { label: 'Europe Edge Failover', streamUrl: APPLE_BIPBOP_MULTITRACK, priority: 2 },
        { label: 'Asia-Pacific Relay 1', streamUrl: MUX_PTS_STREAM, priority: 3 },
        { label: 'Global CloudFront Backup', streamUrl: APPLE_BASIC_STREAM, priority: 4 },
        { label: 'Low-Latency Edge 5', streamUrl: MUX_ABR_STREAM, priority: 5 },
        { label: 'Disaster Recovery Origin 6', streamUrl: APPLE_BIPBOP_MULTITRACK, priority: 6 },
      ],
    },
    {
      name: 'Apex Sports 1',
      slug: 'apex-sports-1',
      channelNumber: 201,
      logoUrl: makeSvgLogo('AS1', '#141B2D', '#EF4444'),
      description: 'Flagship live football, championship finals, and post-match studio analysis.',
      country: 'United Kingdom',
      language: 'English',
      isFeatured: true,
      sortOrder: 2,
      placements: ['homepage_live', 'sports_bar'],
      categories: ['sports-live'],
      streams: [
        { label: 'Primary UHD Sports Feed', streamUrl: APPLE_BIPBOP_MULTITRACK, priority: 1 },
        { label: 'Secondary Stadium Feed', streamUrl: MUX_ABR_STREAM, priority: 2 },
        { label: 'Failover Edge 3', streamUrl: MUX_PTS_STREAM, priority: 3 },
      ],
    },
    {
      name: 'Gridline Motorsport TV',
      slug: 'gridline-motorsport',
      channelNumber: 204,
      logoUrl: makeSvgLogo('GMX', '#18181B', '#F59E0B'),
      description: 'Grand Prix qualifying, pit lane telemetry feeds, and endurance racing.',
      country: 'Germany',
      language: 'English',
      isFeatured: true,
      sortOrder: 3,
      placements: ['homepage_live', 'sports_bar'],
      categories: ['sports-live', 'documentary'],
      streams: [
        { label: 'Trackside Master ABR', streamUrl: MUX_ABR_STREAM, priority: 1 },
        { label: 'Onboard Telemetry Backup', streamUrl: APPLE_BIPBOP_MULTITRACK, priority: 2 },
      ],
    },
    {
      name: 'Marquee Cinema HD',
      slug: 'marquee-cinema-hd',
      channelNumber: 301,
      logoUrl: makeSvgLogo('MCHD', '#111827', '#38BDF8'),
      description: 'Curated modern thrillers, director cuts, and international festival winners.',
      country: 'Canada',
      language: 'English',
      isFeatured: true,
      sortOrder: 4,
      placements: ['homepage_live'],
      categories: ['cinema-hits', 'entertainment'],
      streams: [
        { label: 'Cinema Primary Feed', streamUrl: APPLE_BIPBOP_MULTITRACK, priority: 1 },
        { label: 'Cinema Backup Feed', streamUrl: MUX_ABR_STREAM, priority: 2 },
      ],
    },
    {
      name: 'VeloDrama Prime',
      slug: 'velodrama-prime',
      channelNumber: 305,
      logoUrl: makeSvgLogo('VDP', '#1E1B4B', '#A78BFA'),
      description: '24/7 serialized dramas, prime-time premieres, and back-to-back marathons.',
      country: 'South Korea',
      language: 'English / Subtitled',
      isFeatured: false,
      sortOrder: 5,
      placements: ['homepage_live'],
      categories: ['entertainment', 'cinema-hits'],
      streams: [
        { label: 'Drama Primary HLS', streamUrl: MUX_PTS_STREAM, priority: 1 },
        { label: 'Drama Failover HLS', streamUrl: MUX_ABR_STREAM, priority: 2 },
      ],
    },
    {
      name: 'Terra Nova Docs',
      slug: 'terra-nova-docs',
      channelNumber: 401,
      logoUrl: makeSvgLogo('TND', '#064E3B', '#34D399'),
      description: 'Natural history, ocean exploration, aerospace engineering, and world cultures.',
      country: 'United Kingdom',
      language: 'English',
      isFeatured: false,
      sortOrder: 6,
      placements: ['homepage_live'],
      categories: ['documentary'],
      streams: [
        { label: 'Documentary Primary', streamUrl: MUX_ABR_STREAM, priority: 1 },
        { label: 'Documentary Backup', streamUrl: APPLE_BASIC_STREAM, priority: 2 },
      ],
    },
    {
      name: 'BrightSpark Family',
      slug: 'brightspark-family',
      channelNumber: 501,
      logoUrl: makeSvgLogo('BSF', '#312E81', '#FBBF24'),
      description: 'Animated adventures, STEM discovery shows, and weekend family movies.',
      country: 'United States',
      language: 'English',
      isFeatured: false,
      sortOrder: 7,
      placements: ['homepage_live'],
      categories: ['kids-family', 'entertainment'],
      streams: [
        { label: 'Family Stream 1', streamUrl: APPLE_BASIC_STREAM, priority: 1 },
        { label: 'Family Stream 2', streamUrl: MUX_ABR_STREAM, priority: 2 },
      ],
    },
    {
      name: 'Metro Beats Live',
      slug: 'metro-beats-live',
      channelNumber: 601,
      logoUrl: makeSvgLogo('MBL', '#3B0764', '#F472B6'),
      description: 'Live concert broadcasts, studio sessions, and global music charts.',
      country: 'France',
      language: 'English',
      isFeatured: false,
      sortOrder: 8,
      placements: ['homepage_live'],
      categories: ['entertainment'],
      streams: [
        { label: 'Concert Audio-Video Master', streamUrl: APPLE_BIPBOP_MULTITRACK, priority: 1 },
        { label: 'Concert Edge 2', streamUrl: MUX_ABR_STREAM, priority: 2 },
      ],
    },
  ];

  const insertedChannels: Array<{ id: number; slug: string }> = [];
  for (const ch of channelSeeds) {
    const [createdChannel] = await db
      .insert(channels)
      .values({
        name: ch.name,
        slug: ch.slug,
        channelNumber: ch.channelNumber,
        logoUrl: ch.logoUrl,
        description: ch.description,
        country: ch.country,
        language: ch.language,
        isFeatured: ch.isFeatured,
        isPublished: true,
        sortOrder: ch.sortOrder,
        placements: ch.placements,
        currentHealthStatus: 'healthy',
        lastCheckedAt: new Date(),
      })
      .returning();

    insertedChannels.push({ id: createdChannel.id, slug: createdChannel.slug });

    for (const catSlug of ch.categories) {
      if (chCatMap[catSlug]) {
        await db.insert(channelCategoryAssignments).values({
          channelId: createdChannel.id,
          categoryId: chCatMap[catSlug],
        });
      }
    }

    for (const s of ch.streams) {
      await db.insert(channelStreams).values({
        channelId: createdChannel.id,
        label: s.label,
        streamUrl: s.streamUrl,
        priority: s.priority,
        isActive: true,
        healthStatus: 'healthy',
        responseTimeMs: 140 + s.priority * 35,
        lastHttpStatus: 200,
        lastCheckedAt: new Date(),
      });
    }
  }

  // 6. Content Categories
  const insertedContentCats = await db
    .insert(contentCategories)
    .values([
      { name: 'Action & Thriller', slug: 'action-thriller', contentType: 'all', sortOrder: 1 },
      { name: 'Sci-Fi & Mystery', slug: 'scifi-mystery', contentType: 'all', sortOrder: 2 },
      { name: 'Prestige Drama', slug: 'prestige-drama', contentType: 'drama', sortOrder: 3 },
      { name: 'Crime & Noir', slug: 'crime-noir', contentType: 'movie', sortOrder: 4 },
      { name: 'Historical Epic', slug: 'historical-epic', contentType: 'series', sortOrder: 5 },
      { name: 'Championship Live', slug: 'championship-live', contentType: 'sports', sortOrder: 6 },
      { name: 'Motorsport', slug: 'motorsport', contentType: 'sports', sortOrder: 7 },
    ])
    .returning();
  const cCatMap = Object.fromEntries(insertedContentCats.map((c) => [c.slug, c.id]));

  // Local generated visual assets
  const IMG = {
    heroMeridian: '/src/assets/images/hero_midnight_meridian_1794748093840.jpg',
    heroCup: '/src/assets/images/hero_continental_cup_1794748094316.jpg',
    heroHarbor: '/src/assets/images/hero_solstice_harbor_1794748094409.jpg',
    backdropGp: '/src/assets/images/backdrop_motorsport_gp_1794748095954.jpg',
    posterMeridian: '/src/assets/images/poster_midnight_meridian_1794748095273.jpg',
    posterHarbor: '/src/assets/images/poster_solstice_harbor_1794748096705.jpg',
    posterDynasty: '/src/assets/images/poster_glass_dynasty_1794748097049.jpg',
    posterNoir: '/src/assets/images/poster_velvet_noir_1794748098020.jpg',
    posterCircuit: '/src/assets/images/poster_iron_circuit_1794748096937.jpg',
    posterCrown: '/src/assets/images/poster_northern_crown_1794748098400.jpg',
  };

  // 7. VOD Content (Movies, Drama, Web Series, Sports)
  const contentSeeds = [
    // MOVIES (6 movies so 5-per-row desktop grid fills completely!)
    {
      title: 'Midnight Meridian',
      slug: 'midnight-meridian',
      contentType: 'movie',
      synopsis:
        'When an encrypted satellite relay drops out over the Pacific Rim, a veteran counter-intelligence investigator has twelve hours to intercept a rogue courier across a rain-swept metropolis.',
      posterUrl: IMG.posterMeridian,
      backdropUrl: IMG.heroMeridian,
      hlsUrl: APPLE_BIPBOP_MULTITRACK,
      releaseDate: '2026-10-18',
      releaseYear: 2026,
      durationMinutes: 128,
      rating: 'PG-13',
      maturityScore: '8.9',
      language: 'English',
      castList: ['Liam Vance', 'Elena Rostova', 'Marcus Thorne'],
      director: 'Julian Mercer',
      isFeatured: true,
      placements: ['hero', 'trending', 'recently_added'],
      categories: ['action-thriller', 'scifi-mystery'],
    },
    {
      title: 'The Midnight Echo',
      slug: 'the-midnight-echo',
      contentType: 'movie',
      synopsis:
        'A jazz pianist witnesses an underworld handoff outside a rain-soaked club and becomes entangled in a decades-old municipal conspiracy.',
      posterUrl: IMG.posterNoir,
      backdropUrl: IMG.heroMeridian,
      hlsUrl: MUX_ABR_STREAM,
      releaseDate: '2026-09-22',
      releaseYear: 2026,
      durationMinutes: 114,
      rating: 'R',
      maturityScore: '8.6',
      language: 'English',
      castList: ['Arthur Pendelton', 'Nadia Vance', 'Victor Hale'],
      director: 'claire Moreau',
      isFeatured: true,
      placements: ['trending', 'recently_added'],
      categories: ['crime-noir', 'action-thriller'],
    },
    {
      title: 'Iron Circuit: Apex Zero',
      slug: 'iron-circuit-apex-zero',
      contentType: 'movie',
      synopsis:
        'Inside the high-stakes engineering war of a fledgling endurance racing team fighting for pole position at midnight.',
      posterUrl: IMG.posterCircuit,
      backdropUrl: IMG.backdropGp,
      hlsUrl: APPLE_BIPBOP_MULTITRACK,
      releaseDate: '2026-08-14',
      releaseYear: 2026,
      durationMinutes: 136,
      rating: 'PG-13',
      maturityScore: '8.7',
      language: 'English',
      castList: ['Mateo Silva', 'Henrik Lindqvist', 'Maya Chen'],
      director: 'David K. Brooks',
      isFeatured: false,
      placements: ['trending', 'recently_added'],
      categories: ['action-thriller', 'motorsport'],
    },
    {
      title: 'Harbor of Glass',
      slug: 'harbor-of-glass',
      contentType: 'movie',
      synopsis:
        'Two estranged siblings reunite at a remote Nordic lighthouse to settle an inheritance that conceals an unspoken family secret.',
      posterUrl: IMG.posterHarbor,
      backdropUrl: IMG.heroHarbor,
      hlsUrl: MUX_PTS_STREAM,
      releaseDate: '2026-07-09',
      releaseYear: 2026,
      durationMinutes: 109,
      rating: 'PG-13',
      maturityScore: '8.3',
      language: 'English',
      castList: ['Soren Holm', 'Astrid Berg', 'Jonas Lind'],
      director: 'Freja Nystrom',
      isFeatured: false,
      placements: ['recently_added'],
      categories: ['prestige-drama'],
    },
    {
      title: 'Skyline Syndicate',
      slug: 'skyline-syndicate',
      contentType: 'movie',
      synopsis:
        'An architectural forensic auditor uncovers a trillion-dollar laundering network hidden inside a Manhattan penthouse tower.',
      posterUrl: IMG.posterDynasty,
      backdropUrl: IMG.heroMeridian,
      hlsUrl: MUX_ABR_STREAM,
      releaseDate: '2026-06-01',
      releaseYear: 2026,
      durationMinutes: 121,
      rating: 'TV-MA',
      maturityScore: '8.1',
      language: 'English',
      castList: ['Claire Sterling', 'Devon Brooks', 'Sasha Lin'],
      director: 'Martin Cho',
      isFeatured: false,
      placements: ['trending'],
      categories: ['crime-noir', 'scifi-mystery'],
    },
    {
      title: 'Citadel of Fjord',
      slug: 'citadel-of-fjord',
      contentType: 'movie',
      synopsis:
        'Cut off by winter storms, an ancient northern garrison prepares to defend a mountain pass against an incoming armada.',
      posterUrl: IMG.posterCrown,
      backdropUrl: IMG.heroHarbor,
      hlsUrl: APPLE_BIPBOP_MULTITRACK,
      releaseDate: '2026-05-11',
      releaseYear: 2026,
      durationMinutes: 142,
      rating: 'R',
      maturityScore: '8.5',
      language: 'English',
      castList: ['Erik Torvald', 'Ingrid Solberg', 'Ronan Hale'],
      director: 'Torben Lind',
      isFeatured: false,
      placements: ['recently_added'],
      categories: ['historical-epic', 'action-thriller'],
    },

    // DRAMA (5 titles)
    {
      title: 'Solstice Harbor',
      slug: 'solstice-harbor',
      contentType: 'drama',
      synopsis:
        'Across six winters in a mist-bound coastal town, a lighthouse keeper and a marine biologist confront shifting tides and buried pasts.',
      posterUrl: IMG.posterHarbor,
      backdropUrl: IMG.heroHarbor,
      hlsUrl: MUX_ABR_STREAM,
      releaseDate: '2026-10-05',
      releaseYear: 2026,
      durationMinutes: 52,
      rating: 'TV-14',
      maturityScore: '9.0',
      language: 'English',
      castList: ['Klara Lind', 'Thomas Shaw', 'Maren Eide'],
      director: 'Henrik Vestergaard',
      isFeatured: true,
      placements: ['trending', 'recently_added'],
      categories: ['prestige-drama'],
    },
    {
      title: 'Velvet Rain',
      slug: 'velvet-rain',
      contentType: 'drama',
      synopsis:
        'Inside a family-run music conservatory facing bankruptcy, rival prodigies discover what they are willing to sacrifice for a solo.',
      posterUrl: IMG.posterNoir,
      backdropUrl: IMG.heroMeridian,
      hlsUrl: APPLE_BIPBOP_MULTITRACK,
      releaseDate: '2026-09-10',
      releaseYear: 2026,
      durationMinutes: 48,
      rating: 'TV-14',
      maturityScore: '8.4',
      language: 'English',
      castList: ['Clara Bennett', 'Lucas Reyes', 'Evelyn Park'],
      director: 'Naomi Sato',
      isFeatured: false,
      placements: ['recently_added'],
      categories: ['prestige-drama'],
    },
    {
      title: 'Tides of Autumn',
      slug: 'tides-of-autumn',
      contentType: 'drama',
      synopsis:
        'A coastal shipbuilder struggles to keep a century-old maritime yard afloat while his children chart futures far from the sea.',
      posterUrl: IMG.posterHarbor,
      backdropUrl: IMG.heroHarbor,
      hlsUrl: MUX_PTS_STREAM,
      releaseDate: '2026-08-01',
      releaseYear: 2026,
      durationMinutes: 50,
      rating: 'TV-PG',
      maturityScore: '8.2',
      language: 'English',
      castList: ['Arthur Gallagher', 'Maeve Doyle', 'Owen Walsh'],
      director: 'Liam O’Connor',
      isFeatured: false,
      placements: ['trending'],
      categories: ['prestige-drama'],
    },
    {
      title: 'The Quiet Staircase',
      slug: 'the-quiet-staircase',
      contentType: 'drama',
      synopsis:
        'An intimate portrait of three generations sharing a historic townhouse as the city outside transforms overnight.',
      posterUrl: IMG.posterDynasty,
      backdropUrl: IMG.heroHarbor,
      hlsUrl: MUX_ABR_STREAM,
      releaseDate: '2026-07-15',
      releaseYear: 2026,
      durationMinutes: 46,
      rating: 'TV-14',
      maturityScore: '8.0',
      language: 'English',
      castList: ['Miriam Cohen', 'Daniel Alvarez', 'Sophie Laurent'],
      director: 'Rebecca Weiss',
      isFeatured: false,
      placements: ['recently_added'],
      categories: ['prestige-drama'],
    },
    {
      title: 'Winter Crossing',
      slug: 'winter-crossing',
      contentType: 'drama',
      synopsis:
        'Two paramedics working the overnight shift forge an unlikely bond across a turbulent winter in the northern highlands.',
      posterUrl: IMG.posterMeridian,
      backdropUrl: IMG.heroMeridian,
      hlsUrl: APPLE_BIPBOP_MULTITRACK,
      releaseDate: '2026-06-20',
      releaseYear: 2026,
      durationMinutes: 54,
      rating: 'TV-14',
      maturityScore: '8.5',
      language: 'English',
      castList: ['Hannah Cole', 'Samir Patel', 'Owen Grant'],
      director: 'Pauline Moreau',
      isFeatured: false,
      placements: ['trending'],
      categories: ['prestige-drama'],
    },

    // WEB SERIES (5 titles)
    {
      title: 'Glass Dynasty',
      slug: 'glass-dynasty',
      contentType: 'series',
      synopsis:
        'When the matriarch of a global architectural empire vanishes on the night of her succession gala, every heir becomes a suspect.',
      posterUrl: IMG.posterDynasty,
      backdropUrl: IMG.heroMeridian,
      hlsUrl: APPLE_BIPBOP_MULTITRACK,
      releaseDate: '2026-11-01',
      releaseYear: 2026,
      durationMinutes: 55,
      rating: 'TV-MA',
      maturityScore: '9.1',
      language: 'English',
      castList: ['Victoria Sterling', 'Julian Thorne', 'Camille Laurent'],
      director: 'Alexander Reid',
      isFeatured: true,
      placements: ['hero', 'trending', 'recently_added'],
      categories: ['scifi-mystery', 'prestige-drama'],
    },
    {
      title: 'The Northern Crown',
      slug: 'the-northern-crown',
      contentType: 'series',
      synopsis:
        'Rival fjord kingdoms clash over iron trade routes and ancient oaths in a sweeping saga of loyalty and betrayal.',
      posterUrl: IMG.posterCrown,
      backdropUrl: IMG.heroHarbor,
      hlsUrl: MUX_ABR_STREAM,
      releaseDate: '2026-10-12',
      releaseYear: 2026,
      durationMinutes: 58,
      rating: 'TV-MA',
      maturityScore: '8.9',
      language: 'English',
      castList: ['Leif Haraldsson', 'Signe Valen', 'Magnus Krog'],
      director: 'Anders Lindqvist',
      isFeatured: true,
      placements: ['trending', 'recently_added'],
      categories: ['historical-epic', 'action-thriller'],
    },
    {
      title: 'Signal Protocol',
      slug: 'signal-protocol',
      contentType: 'series',
      synopsis:
        'Cyber-forensic analysts intercept a broadcast from an orbital station that was decommissioned ten years earlier.',
      posterUrl: IMG.posterMeridian,
      backdropUrl: IMG.heroMeridian,
      hlsUrl: MUX_PTS_STREAM,
      releaseDate: '2026-09-03',
      releaseYear: 2026,
      durationMinutes: 49,
      rating: 'TV-14',
      maturityScore: '8.6',
      language: 'English',
      castList: ['Maya Lin', 'Elias Vance', 'Nora Vance'],
      director: 'Keiko Takahashi',
      isFeatured: false,
      placements: ['recently_added'],
      categories: ['scifi-mystery'],
    },
    {
      title: 'Redline Telemetry',
      slug: 'redline-telemetry',
      contentType: 'series',
      synopsis:
        'An all-access inside series following championship pit walls, driver rivalries, and split-second strategy calls.',
      posterUrl: IMG.posterCircuit,
      backdropUrl: IMG.backdropGp,
      hlsUrl: APPLE_BIPBOP_MULTITRACK,
      releaseDate: '2026-08-25',
      releaseYear: 2026,
      durationMinutes: 44,
      rating: 'TV-14',
      maturityScore: '8.8',
      language: 'English',
      castList: ['Luca Rossi', 'Maxime Laurent', 'Chloe Park'],
      director: 'Simon Vance',
      isFeatured: false,
      placements: ['trending'],
      categories: ['motorsport'],
    },
    {
      title: 'Neon Precinct',
      slug: 'neon-precinct',
      contentType: 'series',
      synopsis:
        'Night-shift detectives navigate a labyrinth of high-stakes financial crimes and old-school street informants.',
      posterUrl: IMG.posterNoir,
      backdropUrl: IMG.heroMeridian,
      hlsUrl: MUX_ABR_STREAM,
      releaseDate: '2026-07-30',
      releaseYear: 2026,
      durationMinutes: 51,
      rating: 'TV-MA',
      maturityScore: '8.4',
      language: 'English',
      castList: ['Dante Cruz', 'Rachel Kim', 'Gideon Brooks'],
      director: 'Marco Bellini',
      isFeatured: false,
      placements: ['recently_added'],
      categories: ['crime-noir', 'action-thriller'],
    },

    // SPORTS (5 titles)
    {
      title: 'Continental Cup: Grand Final',
      slug: 'continental-cup-grand-final',
      contentType: 'sports',
      synopsis:
        'Full 4K broadcast coverage of the Continental Cup Final under stadium floodlights, featuring tactical camera angles and pre-match analysis.',
      posterUrl: IMG.posterCircuit,
      backdropUrl: IMG.heroCup,
      hlsUrl: APPLE_BIPBOP_MULTITRACK,
      releaseDate: '2026-11-14',
      releaseYear: 2026,
      durationMinutes: 135,
      rating: 'LIVE',
      maturityScore: '9.4',
      language: 'English',
      castList: ['Commentary: James Mercer', 'Analysis: Carlos Silva'],
      director: 'VeloSports Broadcast',
      isFeatured: true,
      placements: ['hero', 'trending', 'recently_added'],
      categories: ['championship-live'],
    },
    {
      title: 'Twilight Grand Prix: Qualifying & Sprint',
      slug: 'twilight-grand-prix-sprint',
      contentType: 'sports',
      synopsis:
        'High-speed open-wheel qualifying shootout with live pit wall telemetry and onboard corner replays.',
      posterUrl: IMG.posterCircuit,
      backdropUrl: IMG.backdropGp,
      hlsUrl: MUX_ABR_STREAM,
      releaseDate: '2026-11-12',
      releaseYear: 2026,
      durationMinutes: 95,
      rating: 'HD',
      maturityScore: '9.1',
      language: 'English',
      castList: ['Commentary: Martin Croft', 'Pit Lane: Sarah Jenkins'],
      director: 'Gridline World Feed',
      isFeatured: true,
      placements: ['trending', 'recently_added'],
      categories: ['motorsport', 'championship-live'],
    },
    {
      title: 'Champions Derby: Semi-Final Replay',
      slug: 'champions-derby-semi-final',
      contentType: 'sports',
      synopsis:
        'Relive every extra-time goal and dramatic penalty shootout from the semi-final clash.',
      posterUrl: IMG.posterMeridian,
      backdropUrl: IMG.heroCup,
      hlsUrl: MUX_PTS_STREAM,
      releaseDate: '2026-11-08',
      releaseYear: 2026,
      durationMinutes: 120,
      rating: 'HD',
      maturityScore: '8.8',
      language: 'English',
      castList: ['Commentary: Alan Sterling'],
      director: 'VeloSports Archive',
      isFeatured: false,
      placements: ['recently_added'],
      categories: ['championship-live'],
    },
    {
      title: '24H Midnight Endurance Highlights',
      slug: '24h-midnight-endurance',
      contentType: 'sports',
      synopsis:
        'Extended 75-minute recap of the grueling overnight stint through mist and rain.',
      posterUrl: IMG.posterCircuit,
      backdropUrl: IMG.backdropGp,
      hlsUrl: APPLE_BIPBOP_MULTITRACK,
      releaseDate: '2026-10-29',
      releaseYear: 2026,
      durationMinutes: 75,
      rating: '4K',
      maturityScore: '8.9',
      language: 'English',
      castList: ['Commentary: Claire Bennett'],
      director: 'Gridline World Feed',
      isFeatured: false,
      placements: ['trending'],
      categories: ['motorsport'],
    },
    {
      title: 'Nordic Winter Cup Highlights',
      slug: 'nordic-winter-cup',
      contentType: 'sports',
      synopsis:
        'Best moments and tactical breakdowns from the Northern Invitational Championship.',
      posterUrl: IMG.posterCrown,
      backdropUrl: IMG.heroCup,
      hlsUrl: MUX_ABR_STREAM,
      releaseDate: '2026-10-20',
      releaseYear: 2026,
      durationMinutes: 60,
      rating: 'HD',
      maturityScore: '8.5',
      language: 'English',
      castList: ['Commentary: Henrik Solberg'],
      director: 'VeloSports Europe',
      isFeatured: false,
      placements: ['recently_added'],
      categories: ['championship-live'],
    },
  ];

  const insertedContentMap = new Map<string, number>();

  for (let idx = 0; idx < contentSeeds.length; idx += 1) {
    const item = contentSeeds[idx];
    const [created] = await db
      .insert(contents)
      .values({
        title: item.title,
        slug: item.slug,
        contentType: item.contentType,
        synopsis: item.synopsis,
        posterUrl: item.posterUrl,
        backdropUrl: item.backdropUrl,
        hlsUrl: item.hlsUrl,
        releaseDate: item.releaseDate,
        releaseYear: item.releaseYear,
        durationMinutes: item.durationMinutes,
        rating: item.rating,
        maturityScore: item.maturityScore,
        language: item.language,
        castList: item.castList,
        director: item.director,
        isFeatured: item.isFeatured,
        isPublished: true,
        requiresSubscription: false,
        placements: item.placements,
        sortOrder: idx + 1,
        viewCount: 1200 + idx * 340,
      })
      .returning();

    insertedContentMap.set(created.slug, created.id);

    for (const catSlug of item.categories) {
      if (cCatMap[catSlug]) {
        await db.insert(contentCategoryAssignments).values({
          contentId: created.id,
          categoryId: cCatMap[catSlug],
        });
      }
    }

    // Create Seasons & Episodes for Drama and Web Series!
    if (item.contentType === 'drama' || item.contentType === 'series') {
      const seasonCount = item.slug === 'glass-dynasty' || item.slug === 'solstice-harbor' ? 2 : 1;
      for (let sNum = 1; sNum <= seasonCount; sNum += 1) {
        const [season] = await db
          .insert(seasons)
          .values({
            contentId: created.id,
            seasonNumber: sNum,
            title: `Season ${sNum}`,
            synopsis: `${item.title} — Season ${sNum} complete episodic collection.`,
            posterUrl: item.posterUrl,
            releaseYear: 2025 + sNum - 1,
            isPublished: true,
          })
          .returning();

        const epTitles = [
          'The Opening Gambit',
          'Fractured Signals',
          'Under the Tide',
          'Crossroads at Midnight',
        ];
        for (let eNum = 1; eNum <= epTitles.length; eNum += 1) {
          await db.insert(episodes).values({
            seasonId: season.id,
            contentId: created.id,
            episodeNumber: eNum,
            title: epTitles[eNum - 1],
            synopsis: `Episode ${eNum} of ${item.title} Season ${sNum}.`,
            thumbnailUrl: item.backdropUrl,
            hlsUrl: eNum % 2 === 1 ? APPLE_BIPBOP_MULTITRACK : MUX_ABR_STREAM,
            durationMinutes: 44 + eNum * 3,
            releaseDate: item.releaseDate,
            isPublished: true,
          });
        }
      }
    }
  }

  // 8. Hero Slides
  await db.insert(heroSlides).values([
    {
      title: 'Midnight Meridian',
      subtitle:
        'A race against the clock across a rain-swept metropolis. Stream the 4K premiere with multi-language audio.',
      badgeText: 'Premiere Cinema',
      imageUrl: IMG.heroMeridian,
      ctaLabel: 'Watch Now',
      ctaLink: '/title/midnight-meridian',
      contentId: insertedContentMap.get('midnight-meridian') ?? null,
      sortOrder: 1,
      isActive: true,
    },
    {
      title: 'Continental Cup: Grand Final',
      subtitle:
        'Live championship stadium feed with zero-buffer multi-CDN HLS failover and instant match replays.',
      badgeText: 'Live Sports Event',
      imageUrl: IMG.heroCup,
      ctaLabel: 'Stream Live',
      ctaLink: '/title/continental-cup-grand-final',
      contentId: insertedContentMap.get('continental-cup-grand-final') ?? null,
      sortOrder: 2,
      isActive: true,
    },
    {
      title: 'Solstice Harbor',
      subtitle:
        'Acclaimed coastal drama across two unforgettable seasons. Every episode streaming in crisp adaptive HD.',
      badgeText: 'Original Drama',
      imageUrl: IMG.heroHarbor,
      ctaLabel: 'Explore Series',
      ctaLink: '/title/solstice-harbor',
      contentId: insertedContentMap.get('solstice-harbor') ?? null,
      sortOrder: 3,
      isActive: true,
    },
  ]);

  // 9. Homepage Layout Sections (Admin-controlled order)
  await db.insert(homepageSections).values([
    {
      title: 'Live TV Channels',
      slug: 'live-tv-channels',
      sectionType: 'live_channels',
      placementKey: 'homepage_live',
      maxItems: 8,
      sortOrder: 1,
      isActive: true,
    },
    {
      title: 'Featured Movies',
      slug: 'featured-movies',
      sectionType: 'movies',
      placementKey: 'trending',
      maxItems: 10,
      sortOrder: 2,
      isActive: true,
    },
    {
      title: 'Prestige Drama',
      slug: 'prestige-drama',
      sectionType: 'drama',
      placementKey: '',
      maxItems: 10,
      sortOrder: 3,
      isActive: true,
    },
    {
      title: 'Original Web Series',
      slug: 'original-web-series',
      sectionType: 'series',
      placementKey: '',
      maxItems: 10,
      sortOrder: 4,
      isActive: true,
    },
    {
      title: 'Live & Replay Sports',
      slug: 'live-replay-sports',
      sectionType: 'sports',
      placementKey: '',
      maxItems: 10,
      sortOrder: 5,
      isActive: true,
    },
    {
      title: 'Recently Added',
      slug: 'recently-added',
      sectionType: 'recently_added',
      placementKey: 'recently_added',
      maxItems: 10,
      sortOrder: 6,
      isActive: true,
    },
  ]);

  // 10. System Settings
  await db.insert(systemSettings).values([
    {
      key: 'platform_name',
      value: 'VEXORA',
      category: 'general',
      description: 'Customer-facing platform brand name',
    },
    {
      key: 'support_email',
      value: 'support@velostream.tv',
      category: 'general',
      description: 'Customer support contact address',
    },
    {
      key: 'trial_duration_days',
      value: '15',
      category: 'billing',
      description: 'Default free trial access duration in days',
    },
    {
      key: 'hls_hourly_monitor_enabled',
      value: 'true',
      category: 'streaming',
      description: 'Run automated hourly HLS manifest & segment verification cron',
    },
    {
      key: 'maintenance_mode',
      value: 'false',
      category: 'general',
      description: 'Put customer storefront into maintenance notice mode',
    },
  ]);

  // 11. Broadcast Welcome Notification
  await db.insert(notifications).values({
    userId: null,
    title: 'Welcome to VEXORA',
    message: 'New accounts qualify for a 15-day Free Access trial with Live TV failover and 4K VOD.',
    type: 'promo',
    isRead: false,
  });

  await ensureLayoutSeeded();
  console.log('[Seed] Completed successfully.');
}

async function ensureBroadcastLogosSeeded(): Promise<void> {
  const [logoMarker] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'layout_v3_logos_seeded'));
  if (logoMarker?.value === 'true') {
    return;
  }

  const logoMap = buildBroadcastLogoMap();
  const allCh = await db.select().from(channels);
  for (const ch of allCh) {
    const newLogo = logoMap[ch.slug];
    if (newLogo && (!ch.logoUrl || ch.logoUrl.startsWith('data:image/svg+xml'))) {
      await db
        .update(channels)
        .set({ logoUrl: newLogo, updatedAt: new Date() })
        .where(eq(channels.id, ch.id));
    }
  }

  await db
    .insert(systemSettings)
    .values({
      key: 'layout_v3_logos_seeded',
      value: 'true',
      category: 'system',
      description: 'Marks studio broadcaster SVG logo upgrade complete',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: 'true', updatedAt: new Date() },
    });
}

async function ensureLayoutSeeded(): Promise<void> {
  const [marker] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'layout_v2_seeded'));
  await removeRegionalChannelCategoryOnce();
  await simplifyLiveTvCategoriesOnce();
  await seedBanglaDramasOnce();
  await migrateDramaUrlsToAynaottOnce();
  await applyOttUiUpgradeV3Once();
  await seedUploadedChannelLogosOnce();
  if (marker?.value === 'true') {
    await ensureBroadcastLogosSeeded();
    await ensureCmsAndNavigationSeeded();
    return;
  }

  console.log('[Seed] Upgrading layout configuration, core Live TV categories, multilingual catalog & page hero sliders...');

  // 1. Keep core clean Live TV genre categories (language filtering lives in the language dropdown)
  const requiredChannelCats = [
    { name: 'News', slug: 'news-channels', description: '24/7 breaking news & current affairs desks', language: 'All', categoryType: 'genre', sortOrder: 1 },
    { name: 'Sports', slug: 'sports-channels', description: 'Live cricket, football, motorsport & arena feeds', language: 'All', categoryType: 'genre', sortOrder: 2 },
    { name: 'Movies', slug: 'movie-channels', description: 'Nonstop feature films & cinema premieres', language: 'All', categoryType: 'genre', sortOrder: 3 },
    { name: 'Entertainment', slug: 'entertainment', description: 'Drama, documentaries & prime-time variety', language: 'All', categoryType: 'genre', sortOrder: 4 },
    { name: 'Kids', slug: 'kids-channels', description: 'Safe animated cartoons & family learning channels', language: 'All', categoryType: 'genre', sortOrder: 5 },
    { name: 'Music', slug: 'music-channels', description: 'Nonstop concerts, chart hits & live sessions', language: 'All', categoryType: 'genre', sortOrder: 6 },
  ];

  const catSlugToId = new Map<string, number>();
  for (const cat of requiredChannelCats) {
    const [existing] = await db
      .select()
      .from(channelCategories)
      .where(eq(channelCategories.slug, cat.slug));
    if (existing) {
      await db
        .update(channelCategories)
        .set({
          name: cat.name,
          description: cat.description,
          language: cat.language,
          categoryType: cat.categoryType,
          sortOrder: cat.sortOrder,
          isActive: true,
        })
        .where(eq(channelCategories.id, existing.id));
      catSlugToId.set(cat.slug, existing.id);
    } else {
      const [created] = await db
        .insert(channelCategories)
        .values({ ...cat, isActive: true })
        .returning();
      catSlugToId.set(cat.slug, created.id);
    }
  }

  // Deactivate extra overlapping tag categories so Live TV displays only clean core categories
  const legacyRedundantCatSlugs = [
    'news-world',
    'sports-live',
    'cinema-hits',
    'documentary',
    'kids-family',
    'regional-channels',
    'popular-channels',
    'bangla-channels',
    'english-channels',
    'hindi-channels',
    'international-channels',
    'religious-channels',
  ];
  for (const legacySlug of legacyRedundantCatSlugs) {
    await db
      .update(channelCategories)
      .set({ isActive: false })
      .where(eq(channelCategories.slug, legacySlug));
  }

  // Also ensure existing channels are assigned to appropriate language & new genre categories
  const existingChannelCats = await db.select().from(channelCategories);
  for (const c of existingChannelCats) catSlugToId.set(c.slug, c.id);

  // Add Bangla, Hindi, Kids, Music, Religious & Regional Live Channels if not present
  const extraChannels = [
    {
      name: 'Channel i HD',
      slug: 'channel-i-hd',
      channelNumber: 110,
      logoUrl: makeSvgLogo('CH i', '#047857', '#FDE047'),
      description: 'Flagship Bangla television featuring drama serials, cinema premieres, and cultural shows.',
      country: 'Bangladesh',
      language: 'Bangla',
      isFeatured: true,
      sortOrder: 9,
      placements: ['homepage_live', 'popular_channels'],
      categories: ['popular-channels', 'bangla-channels', 'entertainment'],
      streams: [
        { label: 'Dhaka Primary Edge', streamUrl: MUX_ABR_STREAM, priority: 1 },
        { label: 'Singapore CDN Failover', streamUrl: APPLE_BIPBOP_MULTITRACK, priority: 2 },
      ],
    },
    {
      name: 'Somoy News 24',
      slug: 'somoy-news-24',
      channelNumber: 112,
      logoUrl: makeSvgLogo('SOMOY', '#991B1B', '#FCA5A5'),
      description: '24/7 Bangla breaking news desk, business bulletins, and live regional reports.',
      country: 'Bangladesh',
      language: 'Bangla',
      isFeatured: true,
      sortOrder: 10,
      placements: ['popular_channels', 'news_desk'],
      categories: ['popular-channels', 'bangla-channels', 'news-channels'],
      streams: [
        { label: 'News Primary ABR', streamUrl: APPLE_BIPBOP_MULTITRACK, priority: 1 },
        { label: 'News Backup Edge', streamUrl: MUX_PTS_STREAM, priority: 2 },
      ],
    },
    {
      name: 'NTV Bangla',
      slug: 'ntv-bangla',
      channelNumber: 114,
      logoUrl: makeSvgLogo('NTV', '#065F46', '#6EE7B7'),
      description: 'Popular Bangla drama, musical evenings, and international diaspora broadcasts.',
      country: 'Bangladesh',
      language: 'Bangla',
      isFeatured: false,
      sortOrder: 11,
      placements: ['homepage_live', 'popular_channels'],
      categories: ['bangla-channels', 'entertainment'],
      streams: [
        { label: 'Primary Stream', streamUrl: MUX_PTS_STREAM, priority: 1 },
        { label: 'Backup Stream', streamUrl: MUX_ABR_STREAM, priority: 2 },
      ],
    },
    {
      name: 'Desh Cinema HD',
      slug: 'desh-cinema-hd',
      channelNumber: 116,
      logoUrl: makeSvgLogo('DESH', '#1E1B4B', '#F472B6'),
      description: 'Nonstop Bangla feature films, classic cinema restorations, and weekend matinees.',
      country: 'Bangladesh',
      language: 'Bangla',
      isFeatured: true,
      sortOrder: 12,
      placements: ['homepage_live'],
      categories: ['bangla-channels', 'entertainment'],
      streams: [
        { label: 'Cinema Master HLS', streamUrl: APPLE_BIPBOP_MULTITRACK, priority: 1 },
        { label: 'Cinema Edge 2', streamUrl: MUX_ABR_STREAM, priority: 2 },
      ],
    },
    {
      name: 'B4U Movies India',
      slug: 'b4u-movies-india',
      channelNumber: 310,
      logoUrl: makeSvgLogo('B4U', '#7C2D12', '#FDBA74'),
      description: '24/7 Hindi blockbuster cinema, classic romances, and studio premieres.',
      country: 'India',
      language: 'Hindi',
      isFeatured: true,
      sortOrder: 13,
      placements: ['homepage_live', 'popular_channels'],
      categories: ['popular-channels', 'hindi-channels', 'international-channels', 'entertainment'],
      streams: [
        { label: 'Mumbai Primary HLS', streamUrl: MUX_ABR_STREAM, priority: 1 },
        { label: 'Global Failover HLS', streamUrl: APPLE_BIPBOP_MULTITRACK, priority: 2 },
      ],
    },
    {
      name: 'Zing Music India',
      slug: 'zing-music-india',
      channelNumber: 315,
      logoUrl: makeSvgLogo('ZING', '#831843', '#F9A8D4'),
      description: 'Hindi chart-topping music videos, live acoustic sessions, and countdowns.',
      country: 'India',
      language: 'Hindi',
      isFeatured: false,
      sortOrder: 14,
      placements: ['popular_channels'],
      categories: ['hindi-channels', 'music-channels', 'international-channels'],
      streams: [
        { label: 'Music Primary', streamUrl: APPLE_BASIC_STREAM, priority: 1 },
        { label: 'Music Backup', streamUrl: MUX_ABR_STREAM, priority: 2 },
      ],
    },
    {
      name: 'AajTak World Desk',
      slug: 'aajtak-world-desk',
      channelNumber: 320,
      logoUrl: makeSvgLogo('AAJ', '#991B1B', '#FDE047'),
      description: 'Live Hindi national headlines, business coverage, and political debates.',
      country: 'India',
      language: 'Hindi',
      isFeatured: false,
      sortOrder: 15,
      placements: ['news_desk'],
      categories: ['hindi-channels', 'news-channels'],
      streams: [
        { label: 'Live News Edge', streamUrl: MUX_PTS_STREAM, priority: 1 },
        { label: 'Failover Edge', streamUrl: MUX_ABR_STREAM, priority: 2 },
      ],
    },
    {
      name: 'VEXORA Sports Arena',
      slug: 'vexora-sports-arena',
      channelNumber: 210,
      logoUrl: makeSvgLogo('VSA', '#0F172A', '#EC4899'),
      description: 'Live international cricket, football derbies, and championship highlights.',
      country: 'United Kingdom',
      language: 'English',
      isFeatured: true,
      sortOrder: 16,
      placements: ['homepage_live', 'popular_channels', 'sports_bar'],
      categories: ['popular-channels', 'english-channels', 'sports-channels', 'international-channels'],
      streams: [
        { label: 'UHD Sports Master', streamUrl: APPLE_BIPBOP_MULTITRACK, priority: 1 },
        { label: 'Failover Sports Feed', streamUrl: MUX_ABR_STREAM, priority: 2 },
      ],
    },
    {
      name: 'Peace & Heritage TV',
      slug: 'peace-heritage-tv',
      channelNumber: 701,
      logoUrl: makeSvgLogo('PHTV', '#064E3B', '#A7F3D0'),
      description: 'Reflective lectures, heritage documentaries, and community broadcasts.',
      country: 'Global',
      language: 'English',
      isFeatured: false,
      sortOrder: 17,
      placements: [],
      categories: ['religious-channels', 'english-channels'],
      streams: [
        { label: 'Heritage Primary', streamUrl: APPLE_BASIC_STREAM, priority: 1 },
      ],
    },
    {
      name: 'Sylhet Regional Live',
      slug: 'sylhet-regional-live',
      channelNumber: 750,
      logoUrl: makeSvgLogo('SRL', '#14532D', '#86EFAC'),
      description: 'Regional Bangla cultural festivals, local community news, and folk music.',
      country: 'Bangladesh',
      language: 'Bangla',
      isFeatured: false,
      sortOrder: 18,
      placements: [],
      categories: ['bangla-channels', 'music-channels'],
      streams: [
        { label: 'Regional Primary', streamUrl: MUX_ABR_STREAM, priority: 1 },
      ],
    },
  ];

  for (const ch of extraChannels) {
    const [existing] = await db.select().from(channels).where(eq(channels.slug, ch.slug));
    let channelId = existing?.id;
    if (!channelId) {
      const [created] = await db
        .insert(channels)
        .values({
          name: ch.name,
          slug: ch.slug,
          channelNumber: ch.channelNumber,
          logoUrl: ch.logoUrl,
          description: ch.description,
          country: ch.country,
          language: ch.language,
          isFeatured: ch.isFeatured,
          isPublished: true,
          showOnHomepage: true,
          showOnLiveTv: true,
          sortOrder: ch.sortOrder,
          placements: ch.placements,
          currentHealthStatus: 'healthy',
          lastCheckedAt: new Date(),
        })
        .returning();
      channelId = created.id;

      for (const s of ch.streams) {
        await db.insert(channelStreams).values({
          channelId,
          label: s.label,
          streamUrl: s.streamUrl,
          priority: s.priority,
          isActive: true,
          healthStatus: 'healthy',
          responseTimeMs: 135 + s.priority * 30,
          lastHttpStatus: 200,
          lastCheckedAt: new Date(),
        });
      }
    }

    for (const cSlug of ch.categories) {
      const cid = catSlugToId.get(cSlug);
      if (cid) {
        await db
          .insert(channelCategoryAssignments)
          .values({ channelId, categoryId: cid })
          .onConflictDoNothing();
      }
    }
    for (let pIdx = 0; pIdx < ch.placements.length; pIdx += 1) {
      await db
        .insert(channelPlacements)
        .values({ channelId, placementKey: ch.placements[pIdx], sortOrder: pIdx + 1 })
        .onConflictDoNothing();
    }
  }

  // Link original seeded channels to the new 12 categories cleanly
  const legacyCatLinkMap: Record<string, string[]> = {
    'velonews-24': ['popular-channels', 'english-channels', 'news-channels', 'international-channels'],
    'apex-sports-1': ['popular-channels', 'english-channels', 'sports-channels', 'international-channels'],
    'gridline-motorsport': ['english-channels', 'sports-channels', 'international-channels'],
    'marquee-cinema-hd': ['popular-channels', 'english-channels', 'international-channels', 'entertainment'],
    'velodrama-prime': ['popular-channels', 'international-channels', 'entertainment'],
    'terra-nova-docs': ['english-channels', 'international-channels'],
    'brightspark-family': ['english-channels', 'kids-channels'],
    'metro-beats-live': ['english-channels', 'music-channels', 'international-channels'],
  };

  const allCurrentChannels = await db.select().from(channels);
  for (const ch of allCurrentChannels) {
    const extraLinks = legacyCatLinkMap[ch.slug];
    if (extraLinks) {
      for (const cSlug of extraLinks) {
        const cid = catSlugToId.get(cSlug);
        if (cid) {
          await db
            .insert(channelCategoryAssignments)
            .values({ channelId: ch.id, categoryId: cid })
            .onConflictDoNothing();
        }
      }
    }
    for (let pIdx = 0; pIdx < (ch.placements || []).length; pIdx += 1) {
      await db
        .insert(channelPlacements)
        .values({ channelId: ch.id, placementKey: ch.placements[pIdx], sortOrder: pIdx + 1 })
        .onConflictDoNothing();
    }
  }

  // 2. Ensure Content Categories for Kids, Bangla, Asian/Korean Drama, Hindi Cinema
  const extraContentCats = [
    { name: 'Kids & Family', slug: 'kids-family', description: 'Animated adventures & family features', contentType: 'all', language: 'All', sortOrder: 8 },
    { name: 'Bangla Originals', slug: 'bangla-originals', description: 'Bangla cinema, natok & web series', contentType: 'all', language: 'Bangla', sortOrder: 9 },
    { name: 'Korean & Asian Drama', slug: 'asian-drama', description: 'Acclaimed Korean, Japanese & Chinese dramas', contentType: 'all', language: 'Korean', sortOrder: 10 },
    { name: 'Hindi Blockbusters', slug: 'hindi-blockbusters', description: 'Hindi feature films & series', contentType: 'all', language: 'Hindi', sortOrder: 11 },
  ];

  const contentCatSlugToId = new Map<string, number>();
  const existingCCats = await db.select().from(contentCategories);
  for (const c of existingCCats) contentCatSlugToId.set(c.slug, c.id);

  for (const c of extraContentCats) {
    if (!contentCatSlugToId.has(c.slug)) {
      const [created] = await db.insert(contentCategories).values({ ...c, isActive: true }).returning();
      contentCatSlugToId.set(c.slug, created.id);
    }
  }

  // 3. Add Bangla, Hindi, Korean/Chinese, and Kids & Family VOD items using verified local assets
  const IMG2 = {
    banglaRiver: '/src/assets/images/hero_bangla_cinema_river_1794754860005.jpg',
    seoulNoir: '/src/assets/images/hero_international_seoul_noir_1794754859485.jpg',
    kidsSky: '/src/assets/images/hero_kids_sky_adventure_1794754867940.jpg',
    liveStudio: '/src/assets/images/hero_live_broadcast_studio_1794754858923.jpg',
    heroMeridian: '/src/assets/images/hero_midnight_meridian_1794748093840.jpg',
    heroHarbor: '/src/assets/images/hero_solstice_harbor_1794748094409.jpg',
    posterHarbor: '/src/assets/images/poster_solstice_harbor_1794748096705.jpg',
    posterDynasty: '/src/assets/images/poster_glass_dynasty_1794748097049.jpg',
    posterNoir: '/src/assets/images/poster_velvet_noir_1794748098020.jpg',
    posterCrown: '/src/assets/images/poster_northern_crown_1794748098400.jpg',
  };

  const multilingualContents = [
    {
      title: 'Padma Twilight',
      slug: 'padma-twilight',
      contentType: 'drama',
      synopsis: 'A sweeping Bangla family saga set along the riverbanks where old loyalties collide with a new generation.',
      posterUrl: IMG2.posterHarbor,
      backdropUrl: IMG2.banglaRiver,
      hlsUrl: APPLE_BIPBOP_MULTITRACK,
      releaseDate: '2026-11-10',
      releaseYear: 2026,
      durationMinutes: 54,
      rating: 'TV-14',
      maturityScore: '9.2',
      language: 'Bangla',
      country: 'Bangladesh',
      director: 'Tanvir Ahmed',
      isFeatured: true,
      isRecentlyAdded: true,
      placements: ['trending', 'recently_added', 'bangla_entertainment'],
      categories: ['bangla-originals', 'prestige-drama'],
    },
    {
      title: 'Dhaka Midnight File',
      slug: 'dhaka-midnight-file',
      contentType: 'series',
      synopsis: 'An investigative thriller web series tracking an enigmatic journalist uncovering citywide syndicate secrets.',
      posterUrl: IMG2.posterNoir,
      backdropUrl: IMG2.heroMeridian,
      hlsUrl: MUX_ABR_STREAM,
      releaseDate: '2026-11-06',
      releaseYear: 2026,
      durationMinutes: 48,
      rating: 'TV-MA',
      maturityScore: '9.0',
      language: 'Bangla',
      country: 'Bangladesh',
      director: 'Farhan Rahman',
      isFeatured: true,
      isRecentlyAdded: true,
      placements: ['trending', 'recently_added', 'bangla_entertainment'],
      categories: ['bangla-originals', 'action-thriller'],
    },
    {
      title: 'Monsoon Lanterns',
      slug: 'monsoon-lanterns',
      contentType: 'movie',
      synopsis: 'A poignant Bangla feature film following two musicians returning to their ancestral riverside town.',
      posterUrl: IMG2.posterDynasty,
      backdropUrl: IMG2.banglaRiver,
      hlsUrl: MUX_PTS_STREAM,
      releaseDate: '2026-10-28',
      releaseYear: 2026,
      durationMinutes: 124,
      rating: 'U',
      maturityScore: '8.8',
      language: 'Bangla',
      country: 'Bangladesh',
      director: 'Nusrat Jahan',
      isFeatured: false,
      isRecentlyAdded: true,
      placements: ['recently_added', 'bangla_entertainment'],
      categories: ['bangla-originals', 'prestige-drama'],
    },
    {
      title: 'Titas River Chronicles',
      slug: 'titas-river-chronicles',
      contentType: 'drama',
      synopsis: 'Classic Bengali drama anthology celebrating resilience, craft, and kinship along Bengal waterways.',
      posterUrl: IMG2.posterCrown,
      backdropUrl: IMG2.banglaRiver,
      hlsUrl: APPLE_BIPBOP_MULTITRACK,
      releaseDate: '2026-10-14',
      releaseYear: 2026,
      durationMinutes: 46,
      rating: 'U',
      maturityScore: '8.7',
      language: 'Bangla',
      country: 'Bangladesh',
      director: 'Kamrul Hasan',
      isFeatured: false,
      isRecentlyAdded: false,
      placements: ['bangla_entertainment'],
      categories: ['bangla-originals'],
    },
    {
      title: 'Seoul Rain Protocol',
      slug: 'seoul-rain-protocol',
      contentType: 'drama',
      synopsis: 'A Seoul cyber-investigator teams with a prosecutor to untangle a shadowy corporate cover-up.',
      posterUrl: IMG2.posterNoir,
      backdropUrl: IMG2.seoulNoir,
      hlsUrl: APPLE_BIPBOP_MULTITRACK,
      releaseDate: '2026-11-11',
      releaseYear: 2026,
      durationMinutes: 58,
      rating: 'TV-14',
      maturityScore: '9.1',
      language: 'Korean',
      country: 'South Korea',
      director: 'Park Min-jun',
      isFeatured: true,
      isRecentlyAdded: true,
      placements: ['trending', 'recently_added', 'international_entertainment'],
      categories: ['asian-drama', 'action-thriller'],
    },
    {
      title: 'Shanghai Velvet',
      slug: 'shanghai-velvet',
      contentType: 'series',
      synopsis: 'Chinese mystery drama following an art conservator tracing stolen porcelain across coastal galleries.',
      posterUrl: IMG2.posterDynasty,
      backdropUrl: IMG2.seoulNoir,
      hlsUrl: MUX_ABR_STREAM,
      releaseDate: '2026-10-29',
      releaseYear: 2026,
      durationMinutes: 50,
      rating: 'TV-14',
      maturityScore: '8.8',
      language: 'Chinese',
      country: 'China',
      director: 'Lin Wei',
      isFeatured: false,
      isRecentlyAdded: true,
      placements: ['recently_added', 'international_entertainment'],
      categories: ['asian-drama', 'scifi-mystery'],
    },
    {
      title: 'Mumbai Express 4K',
      slug: 'mumbai-express-4k',
      contentType: 'movie',
      synopsis: 'High-octane Hindi action feature about an undercover rail marshal racing to stop a heist.',
      posterUrl: IMG2.posterNoir,
      backdropUrl: IMG2.heroMeridian,
      hlsUrl: MUX_PTS_STREAM,
      releaseDate: '2026-11-04',
      releaseYear: 2026,
      durationMinutes: 138,
      rating: 'PG-13',
      maturityScore: '8.7',
      language: 'Hindi',
      country: 'India',
      director: 'Rohan Malhotra',
      isFeatured: true,
      isRecentlyAdded: true,
      placements: ['trending', 'recently_added', 'international_entertainment'],
      categories: ['hindi-blockbusters', 'action-thriller'],
    },
    {
      title: 'Skyward Treehouse',
      slug: 'skyward-treehouse',
      contentType: 'movie',
      synopsis: 'Animated family adventure following young inventors sailing hot-air balloons across cloud islands.',
      posterUrl: IMG2.posterHarbor,
      backdropUrl: IMG2.kidsSky,
      hlsUrl: APPLE_BASIC_STREAM,
      releaseDate: '2026-11-09',
      releaseYear: 2026,
      durationMinutes: 94,
      rating: 'U',
      maturityScore: '9.0',
      language: 'English',
      country: 'United States',
      director: 'Maya Lin',
      isFeatured: true,
      isRecentlyAdded: true,
      placements: ['trending', 'recently_added', 'kids_family'],
      categories: ['kids-family'],
    },
    {
      title: 'Cloud Harbor Explorers',
      slug: 'cloud-harbor-explorers',
      contentType: 'series',
      synopsis: 'Educational animated series teaching science, weather, and friendship through sky-island quests.',
      posterUrl: IMG2.posterCrown,
      backdropUrl: IMG2.kidsSky,
      hlsUrl: MUX_ABR_STREAM,
      releaseDate: '2026-10-19',
      releaseYear: 2026,
      durationMinutes: 26,
      rating: 'U',
      maturityScore: '8.9',
      language: 'English',
      country: 'Canada',
      director: 'Emma Brooks',
      isFeatured: false,
      isRecentlyAdded: true,
      placements: ['kids_family', 'recently_added'],
      categories: ['kids-family'],
    },
  ];

  const slugToContentId = new Map<string, number>();
  const existingAllContents = await db.select().from(contents);
  for (const c of existingAllContents) slugToContentId.set(c.slug, c.id);

  for (let i = 0; i < multilingualContents.length; i += 1) {
    const item = multilingualContents[i];
    if (!slugToContentId.has(item.slug)) {
      const [created] = await db
        .insert(contents)
        .values({
          title: item.title,
          slug: item.slug,
          contentType: item.contentType,
          synopsis: item.synopsis,
          posterUrl: item.posterUrl,
          backdropUrl: item.backdropUrl,
          hlsUrl: item.hlsUrl,
          releaseDate: item.releaseDate,
          releaseYear: item.releaseYear,
          durationMinutes: item.durationMinutes,
          rating: item.rating,
          maturityScore: item.maturityScore,
          language: item.language,
          country: item.country,
          castList: [],
          director: item.director,
          isFeatured: item.isFeatured,
          isRecentlyAdded: item.isRecentlyAdded,
          isPublished: true,
          requiresSubscription: false,
          placements: item.placements,
          sortOrder: 30 + i,
          viewCount: 1800 + i * 210,
        })
        .returning();
      slugToContentId.set(created.slug, created.id);

      for (const catSlug of item.categories) {
        const cid = contentCatSlugToId.get(catSlug);
        if (cid) {
          await db
            .insert(contentCategoryAssignments)
            .values({ contentId: created.id, categoryId: cid })
            .onConflictDoNothing();
        }
      }

      if (item.contentType === 'drama' || item.contentType === 'series') {
        const [season] = await db
          .insert(seasons)
          .values({
            contentId: created.id,
            seasonNumber: 1,
            title: 'Season 1',
            synopsis: `${item.title} Season 1 episodes.`,
            posterUrl: item.posterUrl,
            releaseYear: 2026,
            isPublished: true,
          })
          .returning();
        await db.insert(episodes).values([
          {
            seasonId: season.id,
            contentId: created.id,
            episodeNumber: 1,
            title: 'Episode 1: Opening Horizon',
            synopsis: `Premiere episode of ${item.title}.`,
            thumbnailUrl: item.backdropUrl,
            hlsUrl: APPLE_BIPBOP_MULTITRACK,
            durationMinutes: item.durationMinutes,
            releaseDate: item.releaseDate,
            isPublished: true,
          },
          {
            seasonId: season.id,
            contentId: created.id,
            episodeNumber: 2,
            title: 'Episode 2: Turning Current',
            synopsis: `Second episode of ${item.title}.`,
            thumbnailUrl: item.backdropUrl,
            hlsUrl: MUX_ABR_STREAM,
            durationMinutes: item.durationMinutes,
            releaseDate: item.releaseDate,
            isPublished: true,
          },
        ]);
      }
    }
  }

  // Sync content placements
  const refreshedContents = await db.select().from(contents);
  for (const c of refreshedContents) {
    for (let idx = 0; idx < (c.placements || []).length; idx += 1) {
      await db
        .insert(contentPlacements)
        .values({ contentId: c.id, placementKey: c.placements[idx], sortOrder: idx + 1 })
        .onConflictDoNothing();
    }
  }

  // 4. Seed 6 Independent Page Hero Sliders & Slide Items
  const sliderPages = [
    { pageKey: 'home', name: 'Home Page Hero Slider', slideDurationMs: 6500 },
    { pageKey: 'live_tv', name: 'Live TV Hero Slider', slideDurationMs: 6000 },
    { pageKey: 'movies', name: 'Movies Hero Slider', slideDurationMs: 6500 },
    { pageKey: 'drama', name: 'Drama Hero Slider', slideDurationMs: 6500 },
    { pageKey: 'series', name: 'Web Series Hero Slider', slideDurationMs: 6500 },
    { pageKey: 'sports', name: 'Sports Hero Slider', slideDurationMs: 6000 },
  ];

  const sliderIdMap = new Map<string, number>();
  for (const p of sliderPages) {
    const [existing] = await db
      .select()
      .from(pageHeroSliders)
      .where(eq(pageHeroSliders.pageKey, p.pageKey));
    if (existing) {
      sliderIdMap.set(p.pageKey, existing.id);
    } else {
      const [created] = await db
        .insert(pageHeroSliders)
        .values({ ...p, autoplay: true, isActive: true })
        .returning();
      sliderIdMap.set(p.pageKey, created.id);
    }
  }

  const [{ value: sliderItemsCount }] = await db.select({ value: count() }).from(heroSliderItems);
  if (sliderItemsCount === 0) {
    const chMap = new Map((await db.select().from(channels)).map((c) => [c.slug, c.id]));
    const coMap = new Map((await db.select().from(contents)).map((c) => [c.slug, c.id]));

    await db.insert(heroSliderItems).values([
      // Home Page Slides
      {
        sliderId: sliderIdMap.get('home'),
        pageKey: 'home',
        title: 'Midnight Meridian',
        subtitle: 'A race against time across a rain-swept metropolis. Streaming in 4K UHD with multi-audio.',
        badgeText: 'Premiere Cinema',
        categoryLabel: 'Action & Thriller',
        languageLabel: 'English',
        imageUrl: IMG2.heroMeridian,
        ctaLabel: 'Watch Now',
        ctaLink: '/title/midnight-meridian',
        secondaryCtaLabel: 'More Info',
        secondaryCtaLink: '/title/midnight-meridian',
        contentId: coMap.get('midnight-meridian') ?? null,
        sortOrder: 1,
        isActive: true,
      },
      {
        sliderId: sliderIdMap.get('home'),
        pageKey: 'home',
        title: 'Padma Twilight',
        subtitle: 'Acclaimed Bangla family drama along the golden riverbanks, streaming exclusively on VEXORA.',
        badgeText: 'Bangla Original',
        categoryLabel: 'Bangla Drama',
        languageLabel: 'Bangla',
        imageUrl: IMG2.banglaRiver,
        ctaLabel: 'Watch Now',
        ctaLink: '/title/padma-twilight',
        secondaryCtaLabel: 'More Info',
        secondaryCtaLink: '/title/padma-twilight',
        contentId: coMap.get('padma-twilight') ?? null,
        sortOrder: 2,
        isActive: true,
      },
      {
        sliderId: sliderIdMap.get('home'),
        pageKey: 'home',
        title: 'VEXORA Sports Arena Live',
        subtitle: 'Championship stadium coverage and live broadcasts with instant multi-CDN failover.',
        badgeText: 'Live Channel',
        categoryLabel: 'Sports Live',
        languageLabel: 'English',
        imageUrl: '/src/assets/images/hero_continental_cup_1794748094316.jpg',
        ctaLabel: 'Watch Live',
        ctaLink: '/live-tv?channel=vexora-sports-arena',
        secondaryCtaLabel: 'All Live TV',
        secondaryCtaLink: '/live-tv',
        channelId: chMap.get('vexora-sports-arena') ?? null,
        sortOrder: 3,
        isActive: true,
      },
      {
        sliderId: sliderIdMap.get('home'),
        pageKey: 'home',
        title: 'Seoul Rain Protocol',
        subtitle: 'High-stakes international thriller weaving cyber-forensics with late-night city intrigue.',
        badgeText: 'International Hit',
        categoryLabel: 'Korean Drama',
        languageLabel: 'Korean',
        imageUrl: IMG2.seoulNoir,
        ctaLabel: 'Watch Now',
        ctaLink: '/title/seoul-rain-protocol',
        secondaryCtaLabel: 'More Info',
        secondaryCtaLink: '/title/seoul-rain-protocol',
        contentId: coMap.get('seoul-rain-protocol') ?? null,
        sortOrder: 4,
        isActive: true,
      },

      // Live TV Independent Slides
      {
        sliderId: sliderIdMap.get('live_tv'),
        pageKey: 'live_tv',
        title: 'Somoy News 24 Live Desk',
        subtitle: '24/7 Bangla breaking news, live field dispatches, and national evening prime bulletins.',
        badgeText: 'LIVE NOW',
        categoryLabel: 'News Channels',
        languageLabel: 'Bangla',
        imageUrl: IMG2.liveStudio,
        ctaLabel: 'Watch Live',
        ctaLink: '/live-tv?channel=somoy-news-24',
        secondaryCtaLabel: 'Channel Guide',
        secondaryCtaLink: '/live-tv',
        channelId: chMap.get('somoy-news-24') ?? null,
        sortOrder: 1,
        isActive: true,
      },
      {
        sliderId: sliderIdMap.get('live_tv'),
        pageKey: 'live_tv',
        title: 'Apex Sports 1 HD',
        subtitle: 'Live championship fixtures, touchline analysis, and multi-source redundant HD feeds.',
        badgeText: 'LIVE SPORTS',
        categoryLabel: 'Sports Channels',
        languageLabel: 'English',
        imageUrl: '/src/assets/images/hero_continental_cup_1794748094316.jpg',
        ctaLabel: 'Watch Live',
        ctaLink: '/live-tv?channel=apex-sports-1',
        secondaryCtaLabel: 'All Sports',
        secondaryCtaLink: '/sports',
        channelId: chMap.get('apex-sports-1') ?? null,
        sortOrder: 2,
        isActive: true,
      },
      {
        sliderId: sliderIdMap.get('live_tv'),
        pageKey: 'live_tv',
        title: 'Channel i HD Prime',
        subtitle: 'Premier Bangla entertainment, cinema matinees, and live cultural specials.',
        badgeText: 'LIVE TV',
        categoryLabel: 'Bangla Channels',
        languageLabel: 'Bangla',
        imageUrl: IMG2.banglaRiver,
        ctaLabel: 'Watch Live',
        ctaLink: '/live-tv?channel=channel-i-hd',
        secondaryCtaLabel: 'Bangla Hub',
        secondaryCtaLink: '/drama',
        channelId: chMap.get('channel-i-hd') ?? null,
        sortOrder: 3,
        isActive: true,
      },

      // Movies Page Independent Slide
      {
        sliderId: sliderIdMap.get('movies'),
        pageKey: 'movies',
        title: 'Midnight Meridian',
        subtitle: 'Critically acclaimed action thriller streaming in crisp 4K adaptive bitrate.',
        badgeText: 'Feature Film',
        categoryLabel: 'Action & Thriller',
        languageLabel: 'English',
        imageUrl: IMG2.heroMeridian,
        ctaLabel: 'Watch Movie',
        ctaLink: '/title/midnight-meridian',
        secondaryCtaLabel: 'More Info',
        secondaryCtaLink: '/title/midnight-meridian',
        contentId: coMap.get('midnight-meridian') ?? null,
        sortOrder: 1,
        isActive: true,
      },

      // Drama Page Independent Slide
      {
        sliderId: sliderIdMap.get('drama'),
        pageKey: 'drama',
        title: 'Padma Twilight',
        subtitle: 'Poetic Bangla riverine drama exploring family bonds and timeless resilience.',
        badgeText: 'Drama Premiere',
        categoryLabel: 'Bangla Drama',
        languageLabel: 'Bangla',
        imageUrl: IMG2.banglaRiver,
        ctaLabel: 'Watch Drama',
        ctaLink: '/title/padma-twilight',
        secondaryCtaLabel: 'More Info',
        secondaryCtaLink: '/title/padma-twilight',
        contentId: coMap.get('padma-twilight') ?? null,
        sortOrder: 1,
        isActive: true,
      },

      // Series Page Independent Slide
      {
        sliderId: sliderIdMap.get('series'),
        pageKey: 'series',
        title: 'Glass Dynasty',
        subtitle: 'Every heir becomes a suspect on the night of a global succession gala.',
        badgeText: 'Original Series',
        categoryLabel: 'Mystery Series',
        languageLabel: 'English',
        imageUrl: IMG2.seoulNoir,
        ctaLabel: 'Watch Series',
        ctaLink: '/title/glass-dynasty',
        secondaryCtaLabel: 'More Info',
        secondaryCtaLink: '/title/glass-dynasty',
        contentId: coMap.get('glass-dynasty') ?? null,
        sortOrder: 1,
        isActive: true,
      },

      // Sports Page Independent Slide
      {
        sliderId: sliderIdMap.get('sports'),
        pageKey: 'sports',
        title: 'Continental Cup: Grand Final',
        subtitle: 'Full stadium coverage under floodlights with instant match highlights.',
        badgeText: 'Championship Live',
        categoryLabel: 'Football',
        languageLabel: 'English',
        imageUrl: '/src/assets/images/hero_continental_cup_1794748094316.jpg',
        ctaLabel: 'Watch Now',
        ctaLink: '/title/continental-cup-grand-final',
        secondaryCtaLabel: 'Live Sports TV',
        secondaryCtaLink: '/live-tv',
        contentId: coMap.get('continental-cup-grand-final') ?? null,
        sortOrder: 1,
        isActive: true,
      },
    ]);
  }

  // 5. Ensure Complete Dynamic Homepage Sections (12 configurable sections matching Master Prompt Section 2)
  const desiredSections = [
    {
      title: 'Continue Watching',
      subtitle: 'Pick up right where you left off',
      slug: 'continue-watching',
      sectionType: 'continue_watching',
      layoutStyle: 'continue_watching',
      selectionMode: 'auto',
      placementKey: '',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: '',
      viewAllLink: '/history',
      showRecentlyAddedRibbon: false,
      maxItems: 5,
      sortOrder: 1,
      isActive: true,
    },
    {
      title: 'Live TV Highlights',
      subtitle: 'Featured 24/7 live channels with automatic failover',
      slug: 'live-tv-channels',
      sectionType: 'live_channels',
      layoutStyle: 'channel_cards',
      selectionMode: 'auto',
      placementKey: 'homepage_live',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: '',
      viewAllLink: '/live-tv',
      showRecentlyAddedRibbon: false,
      maxItems: 10,
      sortOrder: 2,
      isActive: true,
    },
    {
      title: 'Popular Live Channels',
      subtitle: 'Top Bangla, English, Hindi, Sports & Kids channels',
      slug: 'popular-live-channels',
      sectionType: 'live_channels',
      layoutStyle: 'circle_rail',
      selectionMode: 'auto',
      placementKey: 'popular_channels',
      categoryFilter: 'popular-channels',
      languageFilter: '',
      contentTypeFilter: '',
      viewAllLink: '/live-tv',
      showRecentlyAddedRibbon: false,
      maxItems: 12,
      sortOrder: 3,
      isActive: true,
    },
    {
      title: 'Trending Movies',
      subtitle: 'Most-watched cinema releases this week',
      slug: 'featured-movies',
      sectionType: 'movies',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'trending',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: 'movie',
      viewAllLink: '/movies',
      showRecentlyAddedRibbon: false,
      maxItems: 10,
      sortOrder: 4,
      isActive: true,
    },
    {
      title: 'Latest Movies',
      subtitle: 'Recently added films across all genres',
      slug: 'latest-movies',
      sectionType: 'movies',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'recently_added',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: 'movie',
      viewAllLink: '/movies',
      showRecentlyAddedRibbon: true,
      maxItems: 10,
      sortOrder: 5,
      isActive: true,
    },
    {
      title: 'Bangla Entertainment',
      subtitle: 'Bangla movies, natok, drama & original web series',
      slug: 'bangla-entertainment',
      sectionType: 'bangla_entertainment',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'bangla_entertainment',
      categoryFilter: '',
      languageFilter: 'Bangla',
      contentTypeFilter: '',
      viewAllLink: '/drama',
      showRecentlyAddedRibbon: false,
      maxItems: 10,
      sortOrder: 6,
      isActive: true,
    },
    {
      title: 'International Entertainment',
      subtitle: 'English, Hindi, Korean & Asian cinema and series',
      slug: 'international-entertainment',
      sectionType: 'international_entertainment',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'international_entertainment',
      categoryFilter: '',
      languageFilter: 'International',
      contentTypeFilter: '',
      viewAllLink: '/series',
      showRecentlyAddedRibbon: false,
      maxItems: 10,
      sortOrder: 7,
      isActive: true,
    },
    {
      title: 'Sports',
      subtitle: 'Live arena channels, finals & motorsport highlights',
      slug: 'live-replay-sports',
      sectionType: 'sports',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: '',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: 'sports',
      viewAllLink: '/sports',
      showRecentlyAddedRibbon: false,
      maxItems: 10,
      sortOrder: 8,
      isActive: true,
    },
    {
      title: 'News',
      subtitle: 'Dedicated Bangla, English & International live news desks',
      slug: 'news-channels-section',
      sectionType: 'news_channels',
      layoutStyle: 'channel_cards',
      selectionMode: 'auto',
      placementKey: 'news_desk',
      categoryFilter: 'news-channels',
      languageFilter: '',
      contentTypeFilter: '',
      viewAllLink: '/live-tv',
      showRecentlyAddedRibbon: false,
      maxItems: 10,
      sortOrder: 9,
      isActive: true,
    },
    {
      title: 'Kids & Family',
      subtitle: 'Animated movies, cartoons & family series',
      slug: 'kids-family-section',
      sectionType: 'kids_family',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'kids_family',
      categoryFilter: 'kids-family',
      languageFilter: '',
      contentTypeFilter: '',
      viewAllLink: '/movies',
      showRecentlyAddedRibbon: false,
      maxItems: 10,
      sortOrder: 10,
      isActive: true,
    },
    {
      title: 'Recommended For You',
      subtitle: 'Curated picks tailored to your viewing activity',
      slug: 'recommended-for-you',
      sectionType: 'recommended',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: '',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: '',
      viewAllLink: '/series',
      showRecentlyAddedRibbon: false,
      maxItems: 10,
      sortOrder: 11,
      isActive: true,
    },
  ];

  // Clear old default 6 generic sections ONLY once during v2 upgrade so the full curated layout takes effect
  const existingSecSlugs = new Set((await db.select().from(homepageSections)).map((s) => s.slug));
  for (const sec of desiredSections) {
    if (!existingSecSlugs.has(sec.slug)) {
      await db.insert(homepageSections).values(sec);
    } else {
      await db
        .update(homepageSections)
        .set({
          title: sec.title,
          subtitle: sec.subtitle,
          layoutStyle: sec.layoutStyle,
          languageFilter: sec.languageFilter,
          categoryFilter: sec.categoryFilter,
          contentTypeFilter: sec.contentTypeFilter,
          viewAllLink: sec.viewAllLink,
          showRecentlyAddedRibbon: sec.showRecentlyAddedRibbon,
          sortOrder: sec.sortOrder,
        })
        .where(eq(homepageSections.slug, sec.slug));
    }
  }

  // Mark upgrade seeded so Admin changes are never overwritten afterwards
  await db
    .insert(systemSettings)
    .values({
      key: 'layout_v2_seeded',
      value: 'true',
      category: 'system',
      description: 'Marks initial dynamic layout v2 catalog seed complete',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: 'true', updatedAt: new Date() },
    });

  await ensureBroadcastLogosSeeded();
  await ensureCmsAndNavigationSeeded();
}

export async function ensureCmsAndNavigationSeeded(): Promise<void> {
  // 1. Expanded Website Settings (idempotent via onConflictDoNothing)
  const expandedSettings = [
    { key: 'logo_url', value: '', category: 'branding', description: 'Optional custom storefront logo image URL' },
    { key: 'favicon_url', value: '', category: 'branding', description: 'Optional custom favicon URL' },
    { key: 'footer_tagline', value: 'Commercial OTT cinema, serialized drama, and live IPTV broadcasting with multi-CDN HLS failover.', category: 'branding', description: 'Footer brand summary description' },
    { key: 'contact_phone', value: '+1 (800) 555-0194', category: 'contact', description: 'Customer support phone number' },
    { key: 'contact_address', value: '820 Media Plaza, Suite 400, Singapore', category: 'contact', description: 'Corporate office address' },
    { key: 'social_facebook', value: 'https://facebook.com/vexoramedia', category: 'social', description: 'Official Facebook page URL' },
    { key: 'social_youtube', value: 'https://youtube.com/@vexoramedia', category: 'social', description: 'Official YouTube channel URL' },
    { key: 'social_instagram', value: 'https://instagram.com/vexoramedia', category: 'social', description: 'Official Instagram profile URL' },
    { key: 'social_x', value: 'https://x.com/vexoramedia', category: 'social', description: 'Official X (Twitter) profile URL' },
    { key: 'seo_title', value: 'VEXORA — OTT & Live IPTV Streaming', category: 'seo', description: 'Default HTML title tag for SEO' },
    { key: 'seo_description', value: 'Stream Live TV channels with automatic HLS failover, movies, drama, web series, and live sports in adaptive HD and 4K.', category: 'seo', description: 'Default meta description for search engines' },
  ];

  for (const setting of expandedSettings) {
    await db.insert(systemSettings).values(setting).onConflictDoNothing({ target: systemSettings.key });
  }

  // 2. Navigation Items (seeded only when empty so Admin edits persist)
  const [{ value: navCount }] = await db.select({ value: count() }).from(navigationItems);
  if (navCount === 0) {
    await db.insert(navigationItems).values([
      { label: 'Home', url: '/', location: 'header', sortOrder: 1, isVisible: true },
      { label: 'Live TV', url: '/live-tv', location: 'header', sortOrder: 2, isVisible: true },
      { label: 'Sports', url: '/sports', location: 'header', sortOrder: 3, isVisible: true },
      { label: 'Drama', url: '/drama', location: 'header', sortOrder: 4, isVisible: true },
      { label: 'Movies', url: '/movies', location: 'header', sortOrder: 5, isVisible: true },
      { label: 'Web Series', url: '/series', location: 'header', sortOrder: 6, isVisible: true },
      { label: 'Live TV Channels', url: '/live-tv', location: 'footer', sortOrder: 1, isVisible: true },
      { label: 'Movies', url: '/movies', location: 'footer', sortOrder: 2, isVisible: true },
      { label: 'Drama', url: '/drama', location: 'footer', sortOrder: 3, isVisible: true },
      { label: 'Web Series', url: '/series', location: 'footer', sortOrder: 4, isVisible: true },
      { label: 'Sports', url: '/sports', location: 'footer', sortOrder: 5, isVisible: true },
      { label: 'Subscription Plans', url: '/plans', location: 'footer_membership', sortOrder: 1, isVisible: true },
      { label: 'Account & Wallet', url: '/dashboard', location: 'footer_membership', sortOrder: 2, isVisible: true },
      { label: 'Device Management', url: '/devices', location: 'footer_membership', sortOrder: 3, isVisible: true },
      { label: 'About VEXORA', url: '/page/about', location: 'footer_membership', sortOrder: 4, isVisible: true },
    ]);
  }

  // 3. CMS Site Pages (seeded idempotently by pageKey)
  const defaultPages = [
    {
      pageKey: 'home',
      slug: 'home',
      title: 'Home',
      subtitle: 'Curated live channels, cinema premieres, and serialized entertainment',
      metaTitle: 'VEXORA — Home',
      metaDescription: 'Stream Live TV, Movies, Drama, Web Series, and Live Sports on VEXORA.',
      heroHeading: 'Stream Without Boundaries',
      heroBody: 'Multi-CDN Live IPTV failover paired with 4K cinema and exclusive drama series.',
      isPublished: true,
      sortOrder: 1,
      sectionsJson: [],
    },
    {
      pageKey: 'live_tv',
      slug: 'live-tv',
      title: 'Live TV',
      subtitle: '24/7 news, sports, cinema, kids, and international channels',
      metaTitle: 'VEXORA — Live TV Channels',
      metaDescription: 'Watch live IPTV channels with automatic stream failover.',
      heroHeading: 'Live Broadcast Television',
      heroBody: 'Instant playback across sports, breaking news, cinema, and regional networks.',
      isPublished: true,
      sortOrder: 2,
      sectionsJson: [],
    },
    {
      pageKey: 'movies',
      slug: 'movies',
      title: 'Movies',
      subtitle: 'Premiere feature films and cinema collections',
      metaTitle: 'VEXORA — Movies',
      metaDescription: 'Browse curated feature films and cinema blockbusters in adaptive HD & 4K.',
      heroHeading: 'Cinema Premieres',
      heroBody: 'Hand-picked thrillers, dramas, and action features.',
      isPublished: true,
      sortOrder: 3,
      sectionsJson: [],
    },
    {
      pageKey: 'drama',
      slug: 'drama',
      title: 'Drama',
      subtitle: 'Serialized television dramas and acclaimed anthologies',
      metaTitle: 'VEXORA — Drama',
      metaDescription: 'Watch Bangla, Korean, English, and international dramas on VEXORA.',
      heroHeading: 'Serialized Drama',
      heroBody: 'Critically acclaimed multi-episode stories.',
      isPublished: true,
      sortOrder: 4,
      sectionsJson: [],
    },
    {
      pageKey: 'series',
      slug: 'series',
      title: 'Web Series',
      subtitle: 'Original multi-season series and investigative thrillers',
      metaTitle: 'VEXORA — Web Series',
      metaDescription: 'Stream original web series across every genre.',
      heroHeading: 'Original Web Series',
      heroBody: 'Full seasons ready to stream across all your devices.',
      isPublished: true,
      sortOrder: 5,
      sectionsJson: [],
    },
    {
      pageKey: 'sports',
      slug: 'sports',
      title: 'Sports',
      subtitle: 'Live arena coverage, motorsport, and full-match replays',
      metaTitle: 'VEXORA — Sports',
      metaDescription: 'Watch live football, cricket, motorsport, and arena events.',
      heroHeading: 'Championship Arena',
      heroBody: 'Live broadcasts and full-match replays with zero buffering.',
      isPublished: true,
      sortOrder: 6,
      sectionsJson: [],
    },
    {
      pageKey: 'about',
      slug: 'about',
      title: 'About VEXORA',
      subtitle: 'Next-generation commercial OTT cinema and resilient Live IPTV infrastructure',
      metaTitle: 'About VEXORA',
      metaDescription: 'Learn about VEXORA media technology, multi-CDN HLS failover, and platform support.',
      heroHeading: 'Built for Uninterrupted Streaming',
      heroBody: 'VEXORA combines adaptive bitrate video on demand with automated multi-source HLS failover across Web, Mobile, and Smart TVs.',
      isPublished: true,
      sortOrder: 7,
      sectionsJson: [
        {
          id: 'about-1',
          heading: 'Multi-Source HLS Failover',
          body: 'Every live channel monitors primary and backup ingest origins every hour and fails over seamlessly during playback.',
          ctaLabel: 'Browse Live TV',
          ctaUrl: '/live-tv',
          sortOrder: 1,
          isVisible: true,
        },
        {
          id: 'about-2',
          heading: 'Cross-Platform Membership',
          body: 'Enjoy a 15-day complimentary trial on eligible devices and flexible subscription tiers with built-in wallet billing.',
          ctaLabel: 'View Plans',
          ctaUrl: '/plans',
          sortOrder: 2,
          isVisible: true,
        },
      ],
    },
    {
      pageKey: 'contact',
      slug: 'contact',
      title: 'Contact & Support',
      subtitle: 'Reach our broadcast operations and subscriber support team',
      metaTitle: 'Contact VEXORA',
      metaDescription: 'Contact VEXORA support for billing, device management, or broadcast inquiries.',
      heroHeading: 'Subscriber & Partner Support',
      heroBody: 'Our engineering and customer care teams operate 24/7 for active members.',
      isPublished: true,
      sortOrder: 8,
      sectionsJson: [
        {
          id: 'contact-1',
          heading: '24/7 Subscriber Care',
          body: 'For billing, device revocation, or stream quality assistance, sign in to your Account Dashboard or email support@velostream.tv.',
          ctaLabel: 'Open Dashboard',
          ctaUrl: '/dashboard',
          sortOrder: 1,
          isVisible: true,
        },
      ],
    },
  ];

  for (const page of defaultPages) {
    await db.insert(sitePages).values(page).onConflictDoNothing({ target: sitePages.pageKey });
  }
}

async function removeRegionalChannelCategoryOnce() {
  const [done] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'removed_regional_channels_v1'));
  if (done?.value === 'true') return;

  await db.delete(channelCategories).where(eq(channelCategories.slug, 'regional-channels'));

  await db
    .insert(systemSettings)
    .values({
      key: 'removed_regional_channels_v1',
      value: 'true',
      description: 'Marker indicating legacy Regional Channels category option was removed',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: 'true' },
    });
}

async function simplifyLiveTvCategoriesOnce() {
  const [done] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'simplified_livetv_categories_v1'));
  if (done?.value === 'true') return;

  const coreCategories = [
    { name: 'News', slug: 'news-channels', description: '24/7 breaking news & current affairs desks', sortOrder: 1 },
    { name: 'Sports', slug: 'sports-channels', description: 'Live cricket, football, motorsport & arena feeds', sortOrder: 2 },
    { name: 'Movies', slug: 'movie-channels', description: 'Nonstop feature films & cinema premieres', sortOrder: 3 },
    { name: 'Entertainment', slug: 'entertainment', description: 'Drama, documentaries & prime-time variety', sortOrder: 4 },
    { name: 'Kids', slug: 'kids-channels', description: 'Safe animated cartoons & family learning channels', sortOrder: 5 },
    { name: 'Music', slug: 'music-channels', description: 'Nonstop concerts, chart hits & live sessions', sortOrder: 6 },
  ];

  const catSlugToId = new Map<string, number>();
  for (const cat of coreCategories) {
    const [existing] = await db
      .select()
      .from(channelCategories)
      .where(eq(channelCategories.slug, cat.slug));
    if (existing) {
      await db
        .update(channelCategories)
        .set({
          name: cat.name,
          description: cat.description,
          language: 'All',
          categoryType: 'genre',
          sortOrder: cat.sortOrder,
          isActive: true,
        })
        .where(eq(channelCategories.id, existing.id));
      catSlugToId.set(cat.slug, existing.id);
    } else {
      const [created] = await db
        .insert(channelCategories)
        .values({
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          language: 'All',
          categoryType: 'genre',
          sortOrder: cat.sortOrder,
          isActive: true,
        })
        .returning();
      catSlugToId.set(cat.slug, created.id);
    }
  }

  const extraTagSlugs = [
    'popular-channels',
    'bangla-channels',
    'english-channels',
    'hindi-channels',
    'international-channels',
    'religious-channels',
    'regional-channels',
    'news-world',
    'sports-live',
    'cinema-hits',
    'documentary',
    'kids-family',
  ];
  for (const slug of extraTagSlugs) {
    await db
      .update(channelCategories)
      .set({ isActive: false })
      .where(eq(channelCategories.slug, slug));
  }

  // Ensure every existing channel stays reachable under its core genre category
  const ensureAssignments: Record<string, string[]> = {
    'desh-cinema-hd': ['movie-channels'],
    'marquee-cinema-hd': ['movie-channels'],
    'b4u-movies-india': ['movie-channels'],
    'vexora-cinema-plus': ['movie-channels'],
    'terra-nova-docs': ['entertainment'],
    'peace-heritage-tv': ['entertainment'],
  };

  for (const [channelSlug, catSlugs] of Object.entries(ensureAssignments)) {
    const [ch] = await db.select().from(channels).where(eq(channels.slug, channelSlug));
    if (!ch) continue;
    for (const cSlug of catSlugs) {
      const catId = catSlugToId.get(cSlug);
      if (!catId) continue;
      await db
        .insert(channelCategoryAssignments)
        .values({ channelId: ch.id, categoryId: catId })
        .onConflictDoNothing();
    }
  }

  await db
    .insert(systemSettings)
    .values({
      key: 'simplified_livetv_categories_v1',
      value: 'true',
      description: 'Marker indicating Live TV categories simplified to core genres',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: 'true' },
    });
}

async function seedBanglaDramasOnce(): Promise<void> {
  const [done] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'bangla_dramas_catalog_v1'));
  if (done?.value === 'true') return;

  console.log(`[Seed] Importing ${BANGLA_DRAMAS_CATALOG.length} Bangla dramas into VOD catalog...`);

  const dramaCategoriesToEnsure = [
    {
      name: 'Bangla Originals',
      slug: 'bangla-originals',
      description: 'Bangla cinema, natok & original web stories',
      contentType: 'all',
      language: 'Bangla',
      sortOrder: 9,
    },
    {
      name: 'Comedy Natok',
      slug: 'comedy-natok',
      description: 'Humorous Bangla comedy natok and lighthearted family stories',
      contentType: 'drama',
      language: 'Bangla',
      sortOrder: 12,
    },
    {
      name: 'Eid Special Natok',
      slug: 'eid-special-natok',
      description: 'Festive Eid television dramas and holiday premieres',
      contentType: 'drama',
      language: 'Bangla',
      sortOrder: 13,
    },
    {
      name: 'Emotional Drama',
      slug: 'emotional-drama',
      description: 'Heartfelt Bangla television dramas and social stories',
      contentType: 'drama',
      language: 'Bangla',
      sortOrder: 14,
    },
    {
      name: 'Prestige Drama',
      slug: 'prestige-drama',
      description: 'Critically acclaimed serialized dramas',
      contentType: 'drama',
      language: 'All',
      sortOrder: 3,
    },
  ];

  const catSlugToId = new Map<string, number>();
  const allExistingCats = await db.select().from(contentCategories);
  for (const c of allExistingCats) catSlugToId.set(c.slug, c.id);

  for (const cat of dramaCategoriesToEnsure) {
    if (!catSlugToId.has(cat.slug)) {
      const [created] = await db
        .insert(contentCategories)
        .values({ ...cat, isActive: true })
        .returning();
      catSlugToId.set(cat.slug, created.id);
    }
  }

  const existingContents = await db
    .select({ id: contents.id, slug: contents.slug, hlsUrl: contents.hlsUrl })
    .from(contents);
  const usedSlugs = new Set(existingContents.map((c) => c.slug));
  const existingUrls = new Set(existingContents.map((c) => c.hlsUrl).filter(Boolean));

  const artworkPool = [
    '/src/assets/images/hero_bangla_cinema_river_1794754860005.jpg',
    '/src/assets/images/hero_solstice_harbor_1794748094409.jpg',
    '/src/assets/images/hero_midnight_meridian_1794748093840.jpg',
    '/src/assets/images/hero_international_seoul_noir_1794754859485.jpg',
    '/src/assets/images/hero_kids_sky_adventure_1794754867940.jpg',
  ];

  const posterPool = [
    '/src/assets/images/poster_solstice_harbor_1794748096705.jpg',
    '/src/assets/images/poster_glass_dynasty_1794748097049.jpg',
    '/src/assets/images/poster_velvet_noir_1794748098020.jpg',
    '/src/assets/images/poster_northern_crown_1794748098400.jpg',
    '/src/assets/images/hero_bangla_cinema_river_1794754860005.jpg',
  ];

  const makeUniqueSlug = (rawTitle: string, url: string): string => {
    const base =
      rawTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'bangla-drama';

    if (!usedSlugs.has(base)) {
      usedSlugs.add(base);
      return base;
    }

    const folderTag = url.includes('/comedy_natok/')
      ? 'comedy'
      : url.includes('/Eid_Special_Natok/')
        ? 'eid'
        : url.includes('/ayna_global/')
          ? 'global'
          : url.includes('/exclusive/')
            ? 'exclusive'
            : (url.match(/\/(20\d{2})\//)?.[1] ?? 'bd');

    const withFolder = `${base}-${folderTag}`;
    if (!usedSlugs.has(withFolder)) {
      usedSlugs.add(withFolder);
      return withFolder;
    }

    let counter = 2;
    while (usedSlugs.has(`${withFolder}-${counter}`)) {
      counter += 1;
    }
    const finalSlug = `${withFolder}-${counter}`;
    usedSlugs.add(finalSlug);
    return finalSlug;
  };

  interface PendingDrama {
    title: string;
    slug: string;
    hlsUrl: string;
    releaseDate: string;
    releaseYear: number;
    durationMinutes: number;
    rating: string;
    maturityScore: string;
    synopsis: string;
    posterUrl: string;
    backdropUrl: string;
    isFeatured: boolean;
    isRecentlyAdded: boolean;
    placements: string[];
    sortOrder: number;
    viewCount: number;
    categorySlugs: string[];
    tags: string[];
  }

  const toInsert: PendingDrama[] = [];

  for (let idx = 0; idx < BANGLA_DRAMAS_CATALOG.length; idx += 1) {
    const [rawTitle, hlsUrl] = BANGLA_DRAMAS_CATALOG[idx];
    if (existingUrls.has(hlsUrl)) continue;
    existingUrls.add(hlsUrl);

    const cleanTitle = rawTitle.replace(/\)$/, '').replace(/\s+/g, ' ').trim();
    const yearMatch = urlYear(hlsUrl);
    const slug = makeUniqueSlug(cleanTitle, hlsUrl);

    const isComedy = hlsUrl.includes('/comedy_natok/');
    const isEid = hlsUrl.includes('/Eid_Special_Natok/');
    const isExclusive = hlsUrl.includes('/exclusive/') || hlsUrl.includes('/ayna_global/');

    const categorySlugs = isComedy
      ? ['comedy-natok', 'bangla-originals']
      : isEid
        ? ['eid-special-natok', 'bangla-originals']
        : isExclusive
          ? ['bangla-originals', 'prestige-drama']
          : ['emotional-drama', 'bangla-originals'];

    const categoryLabel = isComedy
      ? 'Comedy Natok'
      : isEid
        ? 'Eid Special Natok'
        : isExclusive
          ? 'Bangla Original'
          : 'Bangla Television Drama';

    const backdropUrl = artworkPool[idx % artworkPool.length];
    const posterUrl = posterPool[idx % posterPool.length];
    const isRecent = yearMatch >= 2025 || isExclusive;
    const isFeatured = yearMatch >= 2026 || isExclusive;

    toInsert.push({
      title: cleanTitle,
      slug,
      hlsUrl,
      releaseDate: `${yearMatch}-01-15`,
      releaseYear: yearMatch,
      durationMinutes: 42 + (idx % 18),
      rating: 'U',
      maturityScore: (8.1 + ((idx % 12) * 0.1)).toFixed(1),
      synopsis: `${cleanTitle} is a ${categoryLabel} (${yearMatch}) presented in Bangla with adaptive HLS streaming.`,
      posterUrl,
      backdropUrl,
      isFeatured,
      isRecentlyAdded: isRecent,
      placements: isRecent ? ['bangla_entertainment', 'recently_added'] : ['bangla_entertainment'],
      sortOrder: (2030 - yearMatch) * 1000 + idx,
      viewCount: 800 + ((yearMatch - 2016) * 120) + ((526 - idx) % 400),
      categorySlugs,
      tags: ['Bangla', 'Natok', categoryLabel, String(yearMatch)],
    });
  }

  const chunkSize = 100;
  for (let offset = 0; offset < toInsert.length; offset += chunkSize) {
    const chunk = toInsert.slice(offset, offset + chunkSize);
    const createdRows = await db
      .insert(contents)
      .values(
        chunk.map((item) => ({
          title: item.title,
          slug: item.slug,
          contentType: 'drama',
          synopsis: item.synopsis,
          posterUrl: item.posterUrl,
          backdropUrl: item.backdropUrl,
          hlsUrl: item.hlsUrl,
          releaseDate: item.releaseDate,
          releaseYear: item.releaseYear,
          durationMinutes: item.durationMinutes,
          rating: item.rating,
          maturityScore: item.maturityScore,
          language: 'Bangla',
          country: 'Bangladesh',
          castList: [],
          tags: item.tags,
          director: 'G-Series Bangla',
          isFeatured: item.isFeatured,
          isRecentlyAdded: item.isRecentlyAdded,
          isPublished: true,
          requiresSubscription: false,
          placements: item.placements,
          sortOrder: item.sortOrder,
          viewCount: item.viewCount,
        }))
      )
      .onConflictDoNothing({ target: contents.slug })
      .returning({ id: contents.id, slug: contents.slug });

    const createdIdBySlug = new Map(createdRows.map((r) => [r.slug, r.id]));
    const catValues: Array<{ contentId: number; categoryId: number }> = [];
    const placementValues: Array<{ contentId: number; placementKey: string; sortOrder: number }> = [];

    for (const item of chunk) {
      const contentId = createdIdBySlug.get(item.slug);
      if (!contentId) continue;

      for (const cSlug of item.categorySlugs) {
        const categoryId = catSlugToId.get(cSlug);
        if (categoryId) {
          catValues.push({ contentId, categoryId });
        }
      }

      for (let pIdx = 0; pIdx < item.placements.length; pIdx += 1) {
        placementValues.push({
          contentId,
          placementKey: item.placements[pIdx],
          sortOrder: item.sortOrder + pIdx,
        });
      }
    }

    if (catValues.length > 0) {
      await db.insert(contentCategoryAssignments).values(catValues).onConflictDoNothing();
    }
    if (placementValues.length > 0) {
      await db.insert(contentPlacements).values(placementValues).onConflictDoNothing();
    }
  }

  await db
    .insert(systemSettings)
    .values({
      key: 'bangla_dramas_catalog_v1',
      value: 'true',
      description: 'Marker indicating 526 Bangla dramas catalog has been seeded',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: 'true', updatedAt: new Date() },
    });

  console.log(`[Seed] Inserted ${toInsert.length} Bangla dramas.`);
}

function urlYear(url: string): number {
  const parenMatch = url.match(/\(\s*(20\d{2})\s*\)/);
  if (parenMatch) return Number(parenMatch[1]);
  const folderMatch = url.match(/\/(20\d{2})\//);
  if (folderMatch) return Number(folderMatch[1]);
  if (url.includes('/ayna_global/') || url.includes('/exclusive/')) return 2025;
  return 2022;
}

async function migrateDramaUrlsToAynaottOnce(): Promise<void> {
  const [done] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'drama_urls_aynaott_v1'));
  if (done?.value === 'true') return;

  const updatedContents = await db
    .update(contents)
    .set({
      hlsUrl: sql`replace(${contents.hlsUrl}, 'https://vods2.aynascope.net', 'https://vods2.aynaott.com')`,
      updatedAt: new Date(),
    })
    .where(like(contents.hlsUrl, '%vods2.aynascope.net%'))
    .returning({ id: contents.id });

  const updatedEpisodes = await db
    .update(episodes)
    .set({
      hlsUrl: sql`replace(${episodes.hlsUrl}, 'https://vods2.aynascope.net', 'https://vods2.aynaott.com')`,
    })
    .where(like(episodes.hlsUrl, '%vods2.aynascope.net%'))
    .returning({ id: episodes.id });

  await db
    .insert(systemSettings)
    .values({
      key: 'drama_urls_aynaott_v1',
      value: 'true',
      description: 'Marks replacement of vods2.aynascope.net URLs with vods2.aynaott.com',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: 'true', updatedAt: new Date() },
    });

  console.log(
    `[Seed] Migrated drama URLs to vods2.aynaott.com (contents=${updatedContents.length}, episodes=${updatedEpisodes.length}).`
  );
}

async function applyOttUiUpgradeV3Once(): Promise<void> {
  const [done] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'ott_ui_upgrade_v4'));
  if (done?.value === 'true') return;

  console.log('[Seed] Applying OTT UI/UX v3 upgrade (16:9 artwork, Home nav, Live TV categories, VOD home sections)...');

  // 1. Replace any portrait poster_* paths stored in backdropUrl with 16:9 widescreen hero artwork
  const posterToHeroReplacements: Array<[string, string]> = [
    ['/src/assets/images/poster_solstice_harbor_1794748096705.jpg', '/src/assets/images/hero_solstice_harbor_1794748094409.jpg'],
    ['/src/assets/images/poster_glass_dynasty_1794748097049.jpg', '/src/assets/images/hero_international_seoul_noir_1794754859485.jpg'],
    ['/src/assets/images/poster_velvet_noir_1794748098020.jpg', '/src/assets/images/hero_midnight_meridian_1794748093840.jpg'],
    ['/src/assets/images/poster_northern_crown_1794748098400.jpg', '/src/assets/images/hero_bangla_cinema_river_1794754860005.jpg'],
    ['/src/assets/images/poster_midnight_meridian_1794748095273.jpg', '/src/assets/images/hero_midnight_meridian_1794748093840.jpg'],
    ['/src/assets/images/poster_iron_circuit_1794748096937.jpg', '/src/assets/images/backdrop_motorsport_gp_1794748095954.jpg'],
  ];

  for (const [portraitUrl, widescreenUrl] of posterToHeroReplacements) {
    await db
      .update(contents)
      .set({ backdropUrl: widescreenUrl, updatedAt: new Date() })
      .where(eq(contents.backdropUrl, portraitUrl));
  }

  // 2. Ensure Header Navigation has Home first in exact requested order
  const existingHeaderNav = await db
    .select()
    .from(navigationItems)
    .where(eq(navigationItems.location, 'header'));
  const desiredHeader = [
    { label: 'Home', url: '/', sortOrder: 1 },
    { label: 'Live TV', url: '/live-tv', sortOrder: 2 },
    { label: 'Sports', url: '/sports', sortOrder: 3 },
    { label: 'Drama', url: '/drama', sortOrder: 4 },
    { label: 'Movies', url: '/movies', sortOrder: 5 },
    { label: 'Web Series', url: '/series', sortOrder: 6 },
  ];
  for (const item of desiredHeader) {
    const existing = existingHeaderNav.find((n) => n.url === item.url);
    if (existing) {
      await db
        .update(navigationItems)
        .set({ label: item.label, sortOrder: item.sortOrder, isVisible: true })
        .where(eq(navigationItems.id, existing.id));
    } else {
      await db.insert(navigationItems).values({
        label: item.label,
        url: item.url,
        location: 'header',
        openInNewTab: false,
        sortOrder: item.sortOrder,
        isVisible: true,
      });
    }
  }

  // 3. Configure the exact 6 Live TV channel categories (following All Channels on Live TV page)
  const targetLiveCategories = [
    { name: 'Bangla Channels', slug: 'bangla-channels', description: 'Bangla news, drama & entertainment television', language: 'Bangla', categoryType: 'language', sortOrder: 1 },
    { name: 'Hindi Channels', slug: 'hindi-channels', description: 'Hindi cinema, entertainment & music channels', language: 'Hindi', categoryType: 'language', sortOrder: 2 },
    { name: 'News Channels', slug: 'news-channels', description: '24/7 breaking news & current affairs desks', language: 'All', categoryType: 'genre', sortOrder: 3 },
    { name: 'English Channels', slug: 'english-channels', description: 'English international news, cinema & sports', language: 'English', categoryType: 'language', sortOrder: 4 },
    { name: 'Kids Channels', slug: 'kids-channels', description: 'Safe animated cartoons & family learning channels', language: 'All', categoryType: 'genre', sortOrder: 5 },
    { name: 'Religion Channels', slug: 'religious-channels', description: 'Spiritual, heritage & cultural broadcasts', language: 'All', categoryType: 'genre', sortOrder: 6 },
  ];

  const catIdBySlug = new Map<string, number>();
  for (const cat of targetLiveCategories) {
    const [existing] = await db
      .select()
      .from(channelCategories)
      .where(eq(channelCategories.slug, cat.slug));
    if (existing) {
      await db
        .update(channelCategories)
        .set({
          name: cat.name,
          description: cat.description,
          language: cat.language,
          categoryType: cat.categoryType,
          sortOrder: cat.sortOrder,
          isActive: true,
        })
        .where(eq(channelCategories.id, existing.id));
      catIdBySlug.set(cat.slug, existing.id);
    } else {
      const [created] = await db
        .insert(channelCategories)
        .values({ ...cat, isActive: true })
        .returning();
      catIdBySlug.set(cat.slug, created.id);
    }
  }

  const keepSlugs = new Set(targetLiveCategories.map((c) => c.slug));
  const allCats = await db.select().from(channelCategories);
  for (const c of allCats) {
    if (!keepSlugs.has(c.slug) && c.isActive) {
      await db
        .update(channelCategories)
        .set({ isActive: false })
        .where(eq(channelCategories.id, c.id));
    }
  }

  // Ensure channels are linked to matching language/genre categories
  const allChans = await db.select().from(channels);
  for (const ch of allChans) {
    const langLower = (ch.language || '').toLowerCase();
    const toAssign: string[] = [];
    if (langLower === 'bangla') toAssign.push('bangla-channels');
    if (langLower === 'hindi') toAssign.push('hindi-channels');
    if (langLower.includes('english')) toAssign.push('english-channels');
    if (ch.slug === 'peace-heritage-tv' || ch.name.toLowerCase().includes('peace')) {
      toAssign.push('religious-channels');
    }
    for (const cSlug of toAssign) {
      const cid = catIdBySlug.get(cSlug);
      if (cid) {
        await db
          .insert(channelCategoryAssignments)
          .values({ channelId: ch.id, categoryId: cid })
          .onConflictDoNothing();
      }
    }
  }

  // 4. Disable TV channel sections on HomePage and enforce VOD-only HomePage sections
  await db
    .update(homepageSections)
    .set({ isActive: false, updatedAt: new Date() })
    .where(sql`${homepageSections.sectionType} IN ('live_channels', 'news_channels')`);

  const vodHomeSections = [
    {
      title: 'Continue Watching',
      subtitle: 'Pick up right where you left off',
      slug: 'continue-watching',
      sectionType: 'continue_watching',
      layoutStyle: 'continue_watching',
      selectionMode: 'auto',
      placementKey: '',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: '',
      viewAllLink: '/history',
      showRecentlyAddedRibbon: false,
      maxItems: 5,
      sortOrder: 1,
      isActive: true,
    },
    {
      title: 'Latest Content',
      subtitle: 'Newest releases across Movies, Drama & Web Series',
      slug: 'latest-content',
      sectionType: 'latest_content',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: '',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: 'all',
      viewAllLink: '/movies',
      showRecentlyAddedRibbon: true,
      maxItems: 12,
      sortOrder: 2,
      isActive: true,
    },
    {
      title: 'Latest Movies',
      subtitle: 'Newly published feature films & cinema hits',
      slug: 'latest-movies',
      sectionType: 'movies',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'recently_added',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: 'movie',
      viewAllLink: '/movies',
      showRecentlyAddedRibbon: true,
      maxItems: 12,
      sortOrder: 3,
      isActive: true,
    },
    {
      title: 'Latest Web Series',
      subtitle: 'Newly released original multi-season series',
      slug: 'latest-series',
      sectionType: 'series',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'recently_added',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: 'series',
      viewAllLink: '/series',
      showRecentlyAddedRibbon: true,
      maxItems: 12,
      sortOrder: 4,
      isActive: true,
    },
    {
      title: 'Latest Drama',
      subtitle: 'Newest serialized dramas and Bangla natok',
      slug: 'latest-drama',
      sectionType: 'drama',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'recently_added',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: 'drama',
      viewAllLink: '/drama',
      showRecentlyAddedRibbon: true,
      maxItems: 12,
      sortOrder: 5,
      isActive: true,
    },
    {
      title: 'Trending Movies',
      subtitle: 'Most-watched cinema releases this week',
      slug: 'featured-movies',
      sectionType: 'movies',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'trending',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: 'movie',
      viewAllLink: '/movies',
      showRecentlyAddedRibbon: false,
      maxItems: 12,
      sortOrder: 6,
      isActive: true,
    },
    {
      title: 'Trending Web Series',
      subtitle: 'Top binge-watched web series & thrillers',
      slug: 'trending-series',
      sectionType: 'series',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'trending',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: 'series',
      viewAllLink: '/series',
      showRecentlyAddedRibbon: false,
      maxItems: 12,
      sortOrder: 7,
      isActive: true,
    },
    {
      title: 'Recently Added',
      subtitle: 'Freshly added titles across the entire VOD catalog',
      slug: 'recently-added-vod',
      sectionType: 'recently_added',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'recently_added',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: 'all',
      viewAllLink: '/movies',
      showRecentlyAddedRibbon: true,
      maxItems: 12,
      sortOrder: 8,
      isActive: true,
    },
    {
      title: 'Bangla Entertainment',
      subtitle: 'Bangla movies, natok, drama & original web series',
      slug: 'bangla-entertainment',
      sectionType: 'bangla_entertainment',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'bangla_entertainment',
      categoryFilter: '',
      languageFilter: 'Bangla',
      contentTypeFilter: '',
      viewAllLink: '/drama',
      showRecentlyAddedRibbon: false,
      maxItems: 12,
      sortOrder: 9,
      isActive: true,
    },
    {
      title: 'International Entertainment',
      subtitle: 'English, Hindi, Korean & Asian cinema and series',
      slug: 'international-entertainment',
      sectionType: 'international_entertainment',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'international_entertainment',
      categoryFilter: '',
      languageFilter: 'International',
      contentTypeFilter: '',
      viewAllLink: '/series',
      showRecentlyAddedRibbon: false,
      maxItems: 12,
      sortOrder: 10,
      isActive: true,
    },
    {
      title: 'Sports',
      subtitle: 'Arena highlights, motorsport sprints & full-match replays',
      slug: 'live-replay-sports',
      sectionType: 'sports',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: '',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: 'sports',
      viewAllLink: '/sports',
      showRecentlyAddedRibbon: false,
      maxItems: 10,
      sortOrder: 11,
      isActive: true,
    },
    {
      title: 'Kids & Family',
      subtitle: 'Animated movies, cartoons & family series',
      slug: 'kids-family-section',
      sectionType: 'kids_family',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: 'kids_family',
      categoryFilter: 'kids-family',
      languageFilter: '',
      contentTypeFilter: '',
      viewAllLink: '/movies',
      showRecentlyAddedRibbon: false,
      maxItems: 10,
      sortOrder: 12,
      isActive: true,
    },
    {
      title: 'Recommended For You',
      subtitle: 'Curated picks tailored to your viewing activity',
      slug: 'recommended-for-you',
      sectionType: 'recommended',
      layoutStyle: 'rail',
      selectionMode: 'auto',
      placementKey: '',
      categoryFilter: '',
      languageFilter: '',
      contentTypeFilter: '',
      viewAllLink: '/series',
      showRecentlyAddedRibbon: false,
      maxItems: 10,
      sortOrder: 13,
      isActive: true,
    },
  ];

  for (const sec of vodHomeSections) {
    const [existing] = await db
      .select()
      .from(homepageSections)
      .where(eq(homepageSections.slug, sec.slug));
    if (existing) {
      await db
        .update(homepageSections)
        .set({ ...sec, updatedAt: new Date() })
        .where(eq(homepageSections.id, existing.id));
    } else {
      await db.insert(homepageSections).values(sec);
    }
  }

  const keepHomeSlugs = new Set(vodHomeSections.map((s) => s.slug));
  const allHomeSections = await db.select().from(homepageSections);
  for (const s of allHomeSections) {
    if (!keepHomeSlugs.has(s.slug) && s.isActive) {
      await db
        .update(homepageSections)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(homepageSections.id, s.id));
    }
  }

  await db
    .insert(systemSettings)
    .values({
      key: 'ott_ui_upgrade_v4',
      value: 'true',
      category: 'system',
      description: 'Marks OTT UI/UX v4 upgrade complete (deduplicated VOD home sections, 16:9 artwork, Home nav, Live TV categories)',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: 'true', updatedAt: new Date() },
    });

  console.log('[Seed] OTT UI/UX v3 upgrade complete.');
}

async function seedUploadedChannelLogosOnce(): Promise<void> {
  const [done] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'uploaded_channel_logos_v1'));
  if (done?.value === 'true') return;

  console.log(`[Seed] Adding ${UPLOADED_CHANNEL_LOGOS_CATALOG.length} uploaded channel logos (streams pending user configuration)...`);

  const [existingChannels, allCategories] = await Promise.all([
    db
      .select({
        id: channels.id,
        slug: channels.slug,
        name: channels.name,
        channelNumber: channels.channelNumber,
      })
      .from(channels),
    db.select().from(channelCategories),
  ]);

  const normalizeName = (val: string) =>
    val
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/\b(hd|tv|uk|bd|24|bangla)\b/g, (m) => m)
      .replace(/[^a-z0-9]/g, '');

  const usedSlugs = new Set(existingChannels.map((c) => c.slug.toLowerCase()));
  const usedNormNames = new Set(existingChannels.map((c) => normalizeName(c.name)));
  const usedNumbers = new Set(existingChannels.map((c) => c.channelNumber));
  const catIdBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));

  let insertedCount = 0;

  for (let idx = 0; idx < UPLOADED_CHANNEL_LOGOS_CATALOG.length; idx += 1) {
    const item = UPLOADED_CHANNEL_LOGOS_CATALOG[idx];
    const norm = normalizeName(item.name);
    if (usedSlugs.has(item.slug.toLowerCase()) || usedNormNames.has(norm)) {
      continue;
    }

    let channelNumber = item.channelNumber;
    while (usedNumbers.has(channelNumber)) {
      channelNumber += 1;
    }

    usedSlugs.add(item.slug.toLowerCase());
    usedNormNames.add(norm);
    usedNumbers.add(channelNumber);

    const [created] = await db
      .insert(channels)
      .values({
        name: item.name,
        slug: item.slug,
        channelNumber,
        logoUrl: item.logoUrl,
        description: item.description,
        country: item.country,
        language: item.language,
        isFeatured: false,
        isPublished: true,
        showOnHomepage: true,
        showOnLiveTv: true,
        sortOrder: 100 + idx,
        placements: item.placements,
        currentHealthStatus: 'unknown',
      })
      .onConflictDoNothing({ target: channels.slug })
      .returning({ id: channels.id });

    if (!created) continue;
    insertedCount += 1;

    for (const cSlug of item.categorySlugs) {
      const catId = catIdBySlug.get(cSlug);
      if (catId) {
        await db
          .insert(channelCategoryAssignments)
          .values({ channelId: created.id, categoryId: catId })
          .onConflictDoNothing();
      }
    }

    for (let pIdx = 0; pIdx < item.placements.length; pIdx += 1) {
      await db
        .insert(channelPlacements)
        .values({
          channelId: created.id,
          placementKey: item.placements[pIdx],
          sortOrder: 100 + idx + pIdx,
        })
        .onConflictDoNothing();
    }
  }

  await db
    .insert(systemSettings)
    .values({
      key: 'uploaded_channel_logos_v1',
      value: 'true',
      category: 'system',
      description: 'Marks import of deduplicated uploaded channel logos (stream URLs pending)',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: 'true', updatedAt: new Date() },
    });

  console.log(`[Seed] Inserted ${insertedCount} uploaded channel logos.`);
}







