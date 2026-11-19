import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../index.ts';
import {
  channelCategories,
  channelCategoryAssignments,
  channelPlacements,
  channels,
  channelStreams,
  contents,
  heroSliderItems,
  heroSlides,
  pageHeroSliders,
  systemSettings,
} from '../schema/index.ts';

interface ParsedM3uEntry {
  tvgId: string;
  tvgLogo: string;
  groupTitles: string[];
  rawName: string;
  cleanName: string;
  streamUrl: string;
  qualityTag: string;
  userAgent?: string;
  referrer?: string;
}

const M3U_SETTINGS_KEY = 'm3u_categorized_channels_904c5007_v1';

// Curated alias map: normalized cleaned M3U name (alphanumeric lowercase, '&' -> 'and')
// mapped directly to existing DB channel slugs so running channels keep their logos untouched.
const M3U_NAME_TO_EXISTING_SLUG: Record<string, string> = {
  atnbangla: 'atn-bangla',
  atnbanglauk: 'atn-bangla-uk',
  banglavision: 'banglavision',
  colorsbanglahd: 'colors-bangla',
  colorsbanglacinema: 'colors-bangla-cinema',
  iqrabangla: 'iqra-bangla-tv',
  mytvbangladesh: 'my-tv',
  ntvbangladesh: 'ntv-bangla',
  peacetvbangla: 'peace-tv-bangla-hd',
  peacetvenglish: 'peace-tv-english-hd',
  peacetvurdu: 'peace-tv-urdu-hd',
  republicbangla: 'republic-bangla',
  republicbharat: 'republic-tv-bharat',
  rtvbangladesh: 'rtv',
  rupasibangla: 'rupshi-bangla',
  starjalsha: 'star-jalsha',
  starjalshahd: 'star-jalsha-hd',
  tsports: 't-sports-hd',
  zeebanglahd: 'zee-bangla-hd',
  zeecinemahd: 'zee-cinema-hd',
  zeecinemaapac: 'zee-cinema-hd',
  colors: 'colors-hd',
  colorshd: 'colors-hd',
  sonyentertainmenttelevisionhd: 'sony-hd',
  andtv: 'andtv-hd',
  andtvinternational: 'andtv-hd',
  b4umovies: 'b4u-movies-india',
  dangaltv: 'dangal',
  mastiii: 'mastiii-music',
  bbcnewsafrica: 'bbc-news',
  bbcnewseurope: 'bbc-news',
  bbcnewsnorthamerica: 'bbc-news',
  bbcnewssouthasia: 'bbc-news',
  bbcnewsukhd: 'bbc-news',
  cnn: 'cnn',
  cnnhd: 'cnn',
  foxnewschannel: 'fox-news',
  foxnewsinternational: 'fox-news',
  cnbc: 'cnbc-tv',
  espnunitedstates: 'espn',
  espnunitedstateshd: 'espn',
  tntsports1: 'tnt-sports-1',
  ptvsports: 'ptv-sports',
  foxsports1: 'fox-sports-1',
  madanichannelurdu: 'madani-tv',
  islamchannel: 'islam-channel',
  nhkworldjapan: 'nhk-world-japan',
  nhkworldjapanhd: 'nhk-world-japan',
  trtworld: 'trt-world',
  trtworldhd: 'trt-world',
  cgtn: 'cgtn-news',
  cgtndocumentary: 'cgtn-documentary',
  discoverychannelindia: 'discovery-hd',
  discoverychannelindiahd: 'discovery-hd',
  discoverychannelunitedkingdom: 'discovery-hd',
  discoverychannelunitedstates: 'discovery-hd',
  animalplanetunitedkingdom: 'animal-planet-hd',
  animalplanetunitedstates: 'animal-planet-hd',
  nationalgeographicunitedkingdom: 'nat-geo-tv',
  nationalgeographicunitedstates: 'nat-geo-tv',
  nationalgeographicunitedstateshdeast: 'nat-geo-tv',
  historytv18hd: 'history-channel',
};

const COUNTRY_TLD_MAP: Record<string, string> = {
  ae: 'UAE',
  al: 'Albania',
  ar: 'Argentina',
  au: 'Australia',
  bd: 'Bangladesh',
  be: 'Belgium',
  bg: 'Bulgaria',
  br: 'Brazil',
  cl: 'Chile',
  cn: 'China',
  co: 'Colombia',
  cz: 'Czech Republic',
  dz: 'Algeria',
  fr: 'France',
  gb: 'United Kingdom',
  ge: 'Georgia',
  hr: 'Croatia',
  hu: 'Hungary',
  id: 'Indonesia',
  ie: 'Ireland',
  il: 'Israel',
  in: 'India',
  ir: 'Iran',
  it: 'Italy',
  jp: 'Japan',
  mk: 'North Macedonia',
  mn: 'Mongolia',
  mx: 'Mexico',
  ng: 'Nigeria',
  nl: 'Netherlands',
  pe: 'Peru',
  pk: 'Pakistan',
  pl: 'Poland',
  pt: 'Portugal',
  ro: 'Romania',
  ru: 'Russia',
  sg: 'Singapore',
  th: 'Thailand',
  tr: 'Turkiye',
  ua: 'Ukraine',
  uk: 'United Kingdom',
  us: 'United States',
};

function makeFallbackSvgLogo(title: string, bg = '#1E1B4B', fg = '#F472B6'): string {
  const letters = title
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.slice(0, 3).toUpperCase())
    .join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="${bg}"/><text x="60" y="67" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="24" fill="${fg}">${letters || 'TV'}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function resolvePlaylistPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'public/assets/aistudio/OTT_Categorized_Channels_904c5007.txt'),
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../public/assets/aistudio/OTT_Categorized_Channels_904c5007.txt'
    ),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function cleanM3uDisplayName(rawName: string): { cleanName: string; qualityTag: string } {
  const qualityMatch = rawName.match(/\(\s*(\d{3,4}[pi])\s*\)/i);
  const qualityTag = qualityMatch ? qualityMatch[1].toUpperCase() : '';
  const cleanName = rawName
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\(\s*\d{3,4}[pi]\s*\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { cleanName, qualityTag };
}

function normAlphaNum(value: string): string {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

function toSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'channel'
  );
}

// Key for grouping multi-quality / regional variants of NEW channels cleanly
function buildNewChannelGroupKey(entry: ParsedM3uEntry): string {
  const tvgBase = entry.tvgId ? entry.tvgId.split('@')[0].toLowerCase() : '';
  if (tvgBase === 'cnninternational.us') {
    return 'group:cnninternational.us';
  }
  const stripped = entry.cleanName
    .replace(/\b(hd|sd)\b$/i, '')
    .replace(/\b(sd|hd)\s+(east|west)\b/i, '$2')
    .replace(/\s+/g, ' ')
    .trim();
  return normAlphaNum(stripped);
}

function pickCanonicalNewChannelName(entries: ParsedM3uEntry[]): string {
  const first = entries[0];
  const tvgBase = first.tvgId ? first.tvgId.split('@')[0].toLowerCase() : '';
  if (tvgBase === 'cnninternational.us') {
    return 'CNN International';
  }
  // Prefer cleaner non-SD-suffixed base name when combining e.g. "Aaj Tak" + "Aaj Tak HD"
  const sorted = [...entries].sort((a, b) => a.cleanName.length - b.cleanName.length);
  const shortest = sorted[0].cleanName;
  if (entries.length > 1) {
    return shortest.replace(/\s+(SD|HD)$/i, '').trim() || shortest;
  }
  return shortest;
}

function inferCountry(entry: ParsedM3uEntry): string {
  const match = entry.tvgId.match(/\.([a-z]{2})@/i);
  if (match) {
    const code = match[1].toLowerCase();
    if (COUNTRY_TLD_MAP[code]) return COUNTRY_TLD_MAP[code];
  }
  const lower = entry.cleanName.toLowerCase();
  if (lower.includes('bangladesh') || entry.groupTitles.includes('Bangla Channels')) return 'Bangladesh';
  if (lower.includes('india')) return 'India';
  if (lower.includes('pakistan')) return 'Pakistan';
  if (lower.includes('united states')) return 'United States';
  if (lower.includes('united kingdom')) return 'United Kingdom';
  return 'International';
}

function inferLanguage(entry: ParsedM3uEntry): string {
  const lower = entry.cleanName.toLowerCase();
  const group = entry.groupTitles[0] || '';
  const tvgLower = entry.tvgId.toLowerCase();

  if (
    lower.includes('bangla') ||
    lower.includes('sony aath') ||
    lower.includes('ananda') ||
    lower.includes('ekushey') ||
    lower.includes('atn music') ||
    lower.includes('channel s') ||
    lower.includes('green tv') ||
    lower.includes('matribhumi') ||
    lower.includes('nan tv') ||
    lower.includes('rajdhani') ||
    lower.includes('star news') ||
    lower.includes('vokta tv') ||
    group === 'Bangla Channels' ||
    tvgLower.includes('.bd@')
  ) {
    return 'Bangla';
  }

  if (lower.includes('arabic') || lower.includes('arabiya')) return 'Arabic';
  if (lower.includes('urdu') || lower.includes('ten sports pakistan') || lower.includes('quran tv (pakistan)') || lower.includes('paigham') || lower.includes('paighan') || lower.includes('fazal') || lower.includes('grace network') || lower.includes('isaac tv') || lower.includes('joshua tv') || lower.includes('king tv')) {
    return 'Urdu';
  }
  if (lower.includes('pashto')) return 'Pashto';
  if (lower.includes('chinese')) return 'Chinese';
  if (lower.includes('punjabi')) return 'Punjabi';
  if (lower.includes('tagalog')) return 'Tagalog';
  if (lower.includes('hindi') || lower.includes('bhojpuri') || lower.includes('awaaz') || lower.includes('bajar')) {
    if (group !== 'English Channels - Top 50' && group !== 'News Channels - Top 50') return 'Hindi';
    if (lower.includes('awaaz') || lower.includes('bajar') || lower.includes('hindi')) return 'Hindi';
  }
  if (lower.includes('tamil')) return 'Tamil';
  if (lower.includes('telugu')) return 'Telugu';
  if (lower.includes('kannada')) return 'Kannada';
  if (lower.includes('marathi')) return 'Marathi';
  if (lower.includes('gujarati')) return 'Gujarati';
  if (lower.includes('brasil') || lower.includes('portugal') || lower.includes('brazil')) return 'Portuguese';
  if (lower.includes('espanol') || lower.includes('spanish') || lower.includes('latin america') || lower.includes('argentina') || lower.includes('chile') || lower.includes('colombia') || lower.includes('mexico') || lower.includes('movistar') || lower.includes('tacna')) {
    return 'Spanish';
  }
  if (lower.includes('indonesia')) return 'Indonesian';
  if (lower.includes('french') || lower === 'france 24' || lower.includes('(france)')) return 'French';
  if (lower.includes('german')) return 'German';
  if (lower.includes('russian') || lower.includes('(russia)')) return 'Russian';
  if (lower.includes('turk') || lower.includes('turkiye') || lower.includes('bloomberg ht') || lower.includes('cnbc-e')) return 'Turkish';
  if (lower.includes('italian') || lower.includes('(italy)') || lower.includes('class cnbc')) return 'Italian';
  if (lower.includes('quran tv (iran)')) return 'Persian';
  if (lower.includes('netherlands')) return 'Dutch';
  if (lower.includes('bulgaria')) return 'Bulgarian';
  if (lower.includes('romania') || lower.includes('antena 3')) return 'Romanian';
  if (lower.includes('poland')) return 'Polish';
  if (lower.includes('hungary') || lower.includes('hungarian')) return 'Hungarian';
  if (lower.includes('greek')) return 'Greek';
  if (lower.includes('georgia')) return 'Georgian';
  if (lower.includes('albania') || lower.includes('a2 cnn')) return 'Albanian';
  if (lower.includes('ukraine')) return 'Ukrainian';
  if (lower.includes('czech') || lower.includes('prima')) return 'Czech';
  if (lower.includes('croatia')) return 'Croatian';
  if (lower.includes('finland')) return 'Finnish';
  if (lower.includes('mongolia')) return 'Mongolian';
  if (lower.includes('israel')) return 'Hebrew';
  if (lower.includes('macedonia') || lower.includes('televizija')) return 'Macedonian';
  if (lower.includes('t sports 7')) return 'Thai';

  if (group === 'Hindi Channels') {
    const internationalNonHindi = [
      'discovery',
      'animal planet',
      'national geographic',
      'nat geo',
      'zoomoo',
      'kozoom',
      'prima zoom',
      'canal zoom',
      'veluwezoom',
      'tv zoom',
      'zoom (',
      'zoom news',
      'afroland',
      'movistar',
      'star plus televizija',
      'cnd film',
    ];
    if (internationalNonHindi.some((kw) => lower.includes(kw))) {
      return lower.includes('(india)') ? 'Hindi' : 'English';
    }
    return 'Hindi';
  }

  return 'English';
}

function inferCategorySlugs(entry: ParsedM3uEntry): string[] {
  const lower = entry.cleanName.toLowerCase();
  const groups = entry.groupTitles;
  const cats = new Set<string>();

  if (
    groups.includes('Sports Channels - Top 50') ||
    /\b(sports|espn|espnu|cricket|football|f1|nfl|golf|ten sports|t sports)\b/i.test(entry.cleanName)
  ) {
    cats.add('sports-channels');
  }

  if (
    groups.includes('News Channels - Top 50') ||
    /\b(news|cnn|cnbc|bloomberg|bbc|aaj tak|abp|ndtv|republic|times now|bharat24|sudarshan|dd news|dbc|star news|calcutta news|france 24|euronews|cgtn|cna|trt world|nhk world|weather)\b/i.test(
      entry.cleanName
    )
  ) {
    cats.add('news-channels');
  }

  if (
    /\b(cinema|movies|flix|horror|goldmines|cineplex|b4u movies|sony wah|utsav movies|cnd film)\b/i.test(
      entry.cleanName
    )
  ) {
    cats.add('movie-channels');
  }

  if (/\b(kids|pogo|yay|zoomoo|junior|toon)\b/i.test(entry.cleanName)) {
    cats.add('kids-channels');
  }

  if (/\b(music|9xm|9x|mastiii|sangeet|mtv)\b/i.test(entry.cleanName)) {
    cats.add('music-channels');
  }

  if (
    groups.includes('Religion Channels - Top 30') ||
    /\b(madani|quran|paigham|paighan|fazal|grace network|god stands|isaac tv|joshua tv|king tv|peace tv|islam|iqra)\b/i.test(
      entry.cleanName
    )
  ) {
    cats.add('religious-channels');
    cats.add('entertainment');
  }

  if (cats.size === 0) {
    cats.add('entertainment');
  }

  return Array.from(cats);
}

function parseM3uPlaylist(raw: string): ParsedM3uEntry[] {
  const lines = raw.split(/\r?\n/);
  const byUrl = new Map<string, ParsedM3uEntry>();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXTINF:')) continue;

    const tvgId = (line.match(/tvg-id="([^"]*)"/) || [])[1] || '';
    const tvgLogo = (line.match(/tvg-logo="([^"]*)"/) || [])[1] || '';
    const groupTitle = (line.match(/group-title="([^"]*)"/) || [])[1] || '';
    let userAgent = (line.match(/http-user-agent="([^"]*)"/) || [])[1] || undefined;
    let referrer = (line.match(/http-referrer="([^"]*)"/) || [])[1] || undefined;

    const commaIdx = line.lastIndexOf(',');
    const rawName = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : '';

    let streamUrl = '';
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j].trim();
      if (!next) {
        j += 1;
        continue;
      }
      if (next.startsWith('#EXTVLCOPT:')) {
        const opt = next.slice('#EXTVLCOPT:'.length);
        if (opt.startsWith('http-user-agent=')) {
          userAgent = userAgent || opt.slice('http-user-agent='.length).trim();
        } else if (opt.startsWith('http-referrer=')) {
          referrer = referrer || opt.slice('http-referrer='.length).trim();
        }
        j += 1;
        continue;
      }
      if (!next.startsWith('#')) {
        streamUrl = next;
        break;
      }
      break;
    }

    if (!rawName || !streamUrl || !streamUrl.startsWith('http')) continue;

    const { cleanName, qualityTag } = cleanM3uDisplayName(rawName);
    const existing = byUrl.get(streamUrl);
    if (existing) {
      if (groupTitle && !existing.groupTitles.includes(groupTitle)) {
        existing.groupTitles.push(groupTitle);
      }
      continue;
    }

    byUrl.set(streamUrl, {
      tvgId,
      tvgLogo,
      groupTitles: groupTitle ? [groupTitle] : [],
      rawName,
      cleanName,
      streamUrl,
      qualityTag,
      userAgent,
      referrer,
    });
  }

  return Array.from(byUrl.values());
}

export async function seedCategorizedM3uChannelsOnce(): Promise<void> {
  const [done] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, M3U_SETTINGS_KEY));
  if (done?.value === 'true') return;

  const playlistPath = resolvePlaylistPath();
  if (!playlistPath) {
    console.warn('[Seed] M3U playlist OTT_Categorized_Channels_904c5007.txt not found, skipping.');
    return;
  }

  const raw = fs.readFileSync(playlistPath, 'utf8');
  const entries = parseM3uPlaylist(raw);
  if (entries.length === 0) return;

  const [existingChannels, existingStreams, allCategories] = await Promise.all([
    db.select().from(channels),
    db.select().from(channelStreams),
    db.select().from(channelCategories),
  ]);

  const bySlug = new Map(existingChannels.map((c) => [c.slug.toLowerCase(), c]));
  const byExactNorm = new Map<string, (typeof existingChannels)[number]>();
  for (const ch of existingChannels) {
    const key = normAlphaNum(ch.name);
    if (key && !byExactNorm.has(key)) byExactNorm.set(key, ch);
  }

  const catIdBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));
  const streamsByChannelId = new Map<number, Set<string>>();
  const maxPriorityByChannelId = new Map<number, number>();
  for (const s of existingStreams) {
    if (!streamsByChannelId.has(s.channelId)) {
      streamsByChannelId.set(s.channelId, new Set());
      maxPriorityByChannelId.set(s.channelId, 0);
    }
    streamsByChannelId.get(s.channelId)!.add(s.streamUrl);
    if (s.priority > (maxPriorityByChannelId.get(s.channelId) || 0)) {
      maxPriorityByChannelId.set(s.channelId, s.priority);
    }
  }

  const usedSlugs = new Set(existingChannels.map((c) => c.slug.toLowerCase()));
  const usedNumbers = new Set(existingChannels.map((c) => c.channelNumber));
  let nextChannelNumber =
    existingChannels.reduce((max, c) => Math.max(max, c.channelNumber), 1000) + 1;

  const matchedChannelIds = new Set<number>();
  let streamsAddedToExisting = 0;
  let newChannelsCreated = 0;
  let streamsAddedToNew = 0;

  const unmatchedEntries: ParsedM3uEntry[] = [];

  for (const entry of entries) {
    const norm = normAlphaNum(entry.cleanName);
    const aliasSlug = M3U_NAME_TO_EXISTING_SLUG[norm];
    const matchedChannel =
      (aliasSlug ? bySlug.get(aliasSlug) : undefined) || byExactNorm.get(norm);

    if (matchedChannel) {
      matchedChannelIds.add(matchedChannel.id);
      if (!streamsByChannelId.has(matchedChannel.id)) {
        streamsByChannelId.set(matchedChannel.id, new Set());
        maxPriorityByChannelId.set(matchedChannel.id, 0);
      }
      const existingUrls = streamsByChannelId.get(matchedChannel.id)!;
      if (!existingUrls.has(entry.streamUrl)) {
        const nextPriority = (maxPriorityByChannelId.get(matchedChannel.id) || 0) + 1;
        maxPriorityByChannelId.set(matchedChannel.id, nextPriority);
        existingUrls.add(entry.streamUrl);

        const labelSuffix = entry.qualityTag ? ` (${entry.qualityTag})` : '';
        await db.insert(channelStreams).values({
          channelId: matchedChannel.id,
          label: `${entry.cleanName}${labelSuffix}`,
          streamUrl: entry.streamUrl,
          priority: nextPriority,
          isActive: true,
          healthStatus: 'unknown',
          playlistDetails: {
            source: 'OTT_Categorized_Channels',
            tvgId: entry.tvgId,
            groupTitles: entry.groupTitles,
            ...(entry.userAgent ? { userAgent: entry.userAgent } : {}),
            ...(entry.referrer ? { referrer: entry.referrer } : {}),
          },
        });
        streamsAddedToExisting += 1;
      }

      if (!matchedChannel.showOnLiveTv) {
        await db
          .update(channels)
          .set({ showOnLiveTv: true, updatedAt: new Date() })
          .where(eq(channels.id, matchedChannel.id));
      }

      for (const cSlug of inferCategorySlugs(entry)) {
        const catId = catIdBySlug.get(cSlug);
        if (catId) {
          await db
            .insert(channelCategoryAssignments)
            .values({ channelId: matchedChannel.id, categoryId: catId })
            .onConflictDoNothing();
        }
      }
    } else {
      unmatchedEntries.push(entry);
    }
  }

  // Group unmatched entries by canonical channel key so SD/HD variants combine cleanly
  const groupedNew = new Map<string, ParsedM3uEntry[]>();
  for (const entry of unmatchedEntries) {
    const key = buildNewChannelGroupKey(entry);
    if (!groupedNew.has(key)) groupedNew.set(key, []);
    groupedNew.get(key)!.push(entry);
  }

  let sortIdx = 0;
  for (const groupEntries of groupedNew.values()) {
    sortIdx += 1;
    const primary = groupEntries[0];
    const displayName = pickCanonicalNewChannelName(groupEntries);
    const baseSlug = toSlug(displayName);
    let uniqueSlug = baseSlug;
    let suffix = 2;
    while (usedSlugs.has(uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    usedSlugs.add(uniqueSlug);

    while (usedNumbers.has(nextChannelNumber)) {
      nextChannelNumber += 1;
    }
    const channelNumber = nextChannelNumber;
    usedNumbers.add(channelNumber);
    nextChannelNumber += 1;

    const language = inferLanguage(primary);
    const country = inferCountry(primary);
    const categorySlugs = Array.from(
      new Set(groupEntries.flatMap((e) => inferCategorySlugs(e)))
    );
    const logoUrl =
      groupEntries.find((e) => e.tvgLogo)?.tvgLogo || makeFallbackSvgLogo(displayName);

    const placements: string[] = ['homepage_live'];
    if (categorySlugs.includes('news-channels')) placements.push('news_desk');
    if (categorySlugs.includes('sports-channels')) placements.push('sports_bar');

    const [created] = await db
      .insert(channels)
      .values({
        name: displayName,
        slug: uniqueSlug,
        channelNumber,
        logoUrl,
        description: `${displayName} — ${language} live broadcast channel (${country}).`,
        country,
        language,
        isFeatured: false,
        isPublished: true,
        showOnHomepage: true,
        showOnLiveTv: true,
        sortOrder: 400 + sortIdx,
        placements,
        currentHealthStatus: 'unknown',
      })
      .onConflictDoNothing({ target: channels.slug })
      .returning({ id: channels.id });

    if (!created) continue;
    newChannelsCreated += 1;

    for (let sIdx = 0; sIdx < groupEntries.length; sIdx += 1) {
      const se = groupEntries[sIdx];
      const label = se.qualityTag
        ? `${se.cleanName} (${se.qualityTag})`
        : `${se.cleanName} Source ${sIdx + 1}`;
      await db.insert(channelStreams).values({
        channelId: created.id,
        label,
        streamUrl: se.streamUrl,
        priority: sIdx + 1,
        isActive: true,
        healthStatus: 'unknown',
        playlistDetails: {
          source: 'OTT_Categorized_Channels',
          tvgId: se.tvgId,
          groupTitles: se.groupTitles,
          ...(se.userAgent ? { userAgent: se.userAgent } : {}),
          ...(se.referrer ? { referrer: se.referrer } : {}),
        },
      });
      streamsAddedToNew += 1;
    }

    for (const cSlug of categorySlugs) {
      const catId = catIdBySlug.get(cSlug);
      if (catId) {
        await db
          .insert(channelCategoryAssignments)
          .values({ channelId: created.id, categoryId: catId })
          .onConflictDoNothing();
      }
    }

    for (let pIdx = 0; pIdx < placements.length; pIdx += 1) {
      await db
        .insert(channelPlacements)
        .values({
          channelId: created.id,
          placementKey: placements[pIdx],
          sortOrder: 400 + sortIdx + pIdx,
        })
        .onConflictDoNothing();
    }
  }

  await db
    .insert(systemSettings)
    .values({
      key: M3U_SETTINGS_KEY,
      value: 'true',
      category: 'system',
      description:
        'Marks import of OTT_Categorized_Channels_904c5007.txt M3U sources (stream-only on existing channels, logo+channel on new)',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: 'true', updatedAt: new Date() },
    });

  console.log(
    `[Seed] M3U channels sync complete: updated ${matchedChannelIds.size} existing channels (+${streamsAddedToExisting} streams, logos preserved), created ${newChannelsCreated} new channels (+${streamsAddedToNew} streams).`
  );
}

const USER_CUSTOM_CLEANUP_KEY = 'user_custom_streams_cleanup_v2';

const USER_PRIMARY_CHANNEL_STREAMS: Array<{
  slug: string;
  url: string;
  extraCategories?: string[];
}> = [
  { slug: 'star-jalsha', url: 'https://tvsen3.aynaott.com/B54Pv4YLa/index.m3u8' },
  { slug: 'zee-bangla-hd', url: 'https://tvsen3.aynaott.com/kUdWS6pD/index.m3u8' },
  { slug: 'colors-bangla', url: 'https://tvsen3.aynaott.com/eZjN2jXQ/index.m3u8' },
  { slug: 'colors-hd', url: 'https://tvsen3.aynaott.com/Q4Pz3CJW/index.m3u8' },
  { slug: 'sony-hd', url: 'https://tvsen3.aynaott.com/UmkR527E/index.m3u8' },
  { slug: 'star-plus-hd', url: 'https://tvsen3.aynaott.com/tuJx392n/index.m3u8' },
  {
    slug: 'star-sports-1-hd',
    url: 'https://tvsen3.aynaott.com/u8zOJWM9az6J/index.m3u8',
    extraCategories: ['sports-channels'],
  },
  { slug: 'akash-bangla-tv', url: 'https://tvsen3.aynaott.com/Wm9Lv2RjZGT6/index.m3u8' },
  {
    slug: 't-sports-hd',
    url: 'https://tvsen3.aynaott.com/bdYNMn5kZz/index.m3u8',
    extraCategories: ['sports-channels'],
  },
];

const SYNTHETIC_DUMMY_CHANNEL_SLUGS = new Set([
  'velonews-24',
  'apex-sports-1',
  'gridline-motorsport',
  'marquee-cinema-hd',
  'velodrama-prime',
  'terra-nova-docs',
  'brightspark-family',
  'metro-beats-live',
  'channel-i-hd',
  'somoy-news-24',
  'desh-cinema-hd',
  'zing-music-india',
  'aajtak-world-desk',
  'vexora-sports-arena',
  'peace-heritage-tv',
  'sylhet-regional-live',
  'vexora-cinema-plus',
  'apex-arena-hd',
]);

const KNOWN_DUMMY_HERO_TITLES = new Set([
  'Midnight Meridian',
  'Padma Twilight',
  'VEXORA Sports Arena Live',
  'Seoul Rain Protocol',
  'Somoy News 24 Live Desk',
  'Apex Sports 1 HD',
  'Channel i HD Prime',
  'Glass Dynasty',
  'Continental Cup: Grand Final',
  'Continental Cup Final',
  'Solstice Harbor',
]);

const KNOWN_DUMMY_CONTENT_SLUGS = new Set([
  'midnight-meridian',
  'padma-twilight',
  'seoul-rain-protocol',
  'glass-dynasty',
  'continental-cup-grand-final',
  'solstice-harbor',
]);

function isDummyDemoStreamUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.includes('test-streams.mux.dev') ||
    url.includes('devstreaming-cdn.apple.com')
  );
}

export async function applyUserStreamsAndCleanupDummyContentOnce(): Promise<void> {
  const [done] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, USER_CUSTOM_CLEANUP_KEY));
  if (done?.value === 'true') return;

  const [allCategories, allChannels] = await Promise.all([
    db.select().from(channelCategories),
    db.select().from(channels),
  ]);
  const catIdBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));
  const channelBySlug = new Map(allChannels.map((c) => [c.slug, c]));

  // 1. Add user's 9 explicit stream URLs as primary (priority 1) while preserving logos
  let customStreamsAdded = 0;
  for (const spec of USER_PRIMARY_CHANNEL_STREAMS) {
    const ch = channelBySlug.get(spec.slug);
    if (!ch) continue;

    const existing = await db
      .select()
      .from(channelStreams)
      .where(eq(channelStreams.channelId, ch.id))
      .orderBy(asc(channelStreams.priority), asc(channelStreams.id));

    const matching = existing.find((s) => s.streamUrl === spec.url);
    const others = existing.filter((s) => s.streamUrl !== spec.url);

    // Shift other streams down to priority 2, 3, ...
    for (let i = 0; i < others.length; i += 1) {
      await db
        .update(channelStreams)
        .set({ priority: i + 2, updatedAt: new Date() })
        .where(eq(channelStreams.id, others[i].id));
    }

    if (matching) {
      await db
        .update(channelStreams)
        .set({ priority: 1, isActive: true, updatedAt: new Date() })
        .where(eq(channelStreams.id, matching.id));
    } else {
      await db.insert(channelStreams).values({
        channelId: ch.id,
        label: `${ch.name} Live`,
        streamUrl: spec.url,
        priority: 1,
        isActive: true,
        healthStatus: 'unknown',
        playlistDetails: { source: 'User_Custom_Primary' },
      });
      customStreamsAdded += 1;
    }

    await db
      .update(channels)
      .set({
        isPublished: true,
        showOnLiveTv: true,
        showOnHomepage: true,
        updatedAt: new Date(),
      })
      .where(eq(channels.id, ch.id));

    for (const cSlug of spec.extraCategories || []) {
      const catId = catIdBySlug.get(cSlug);
      if (catId) {
        await db
          .insert(channelCategoryAssignments)
          .values({ channelId: ch.id, categoryId: catId })
          .onConflictDoNothing();
      }
    }
  }

  // 2. Remove dummy Mux / Apple test stream URLs across channel_streams
  const allStreamsAfter = await db.select().from(channelStreams);
  const dummyStreamIds = allStreamsAfter
    .filter((s) => isDummyDemoStreamUrl(s.streamUrl))
    .map((s) => s.id);
  if (dummyStreamIds.length > 0) {
    await db.delete(channelStreams).where(inArray(channelStreams.id, dummyStreamIds));
  }

  // 3. Identify dummy channels & dummy VOD contents + snapshot hero slider rows BEFORE deletes
  // (Deleting channels/contents triggers FK `onDelete: 'set null'` on heroSliderItems/heroSlides,
  //  so we MUST evaluate hero references prior to deleting parent channels/contents.)
  const [remainingStreams, allContents, existingSliderItems, existingLegacySlides, sliders] =
    await Promise.all([
      db.select().from(channelStreams),
      db.select().from(contents),
      db.select().from(heroSliderItems),
      db.select().from(heroSlides),
      db.select().from(pageHeroSliders),
    ]);

  const channelsWithRealStreams = new Set(remainingStreams.map((s) => s.channelId));
  const deletedChannelIds = new Set<number>();
  const deletedChannelSlugs = new Set<string>(SYNTHETIC_DUMMY_CHANNEL_SLUGS);

  for (const ch of allChannels) {
    if (
      SYNTHETIC_DUMMY_CHANNEL_SLUGS.has(ch.slug) &&
      !channelsWithRealStreams.has(ch.id)
    ) {
      deletedChannelIds.add(ch.id);
      deletedChannelSlugs.add(ch.slug);
    }
  }

  const dummyContents = allContents.filter((c) => isDummyDemoStreamUrl(c.hlsUrl));
  const dummyContentIds = dummyContents.map((c) => c.id);
  const dummyContentIdSet = new Set(dummyContentIds);
  const dummyContentSlugs = new Set<string>(KNOWN_DUMMY_CONTENT_SLUGS);
  for (const dc of dummyContents) {
    dummyContentSlugs.add(dc.slug);
  }

  const referencesDeletedTarget = (row: {
    channelId: number | null;
    contentId: number | null;
    ctaLink: string;
    title: string;
  }) => {
    if (row.channelId && deletedChannelIds.has(row.channelId)) return true;
    if (row.contentId && dummyContentIdSet.has(row.contentId)) return true;
    if (KNOWN_DUMMY_HERO_TITLES.has(row.title)) return true;
    const link = row.ctaLink || '';
    for (const slug of dummyContentSlugs) {
      if (link === `/title/${slug}` || link.includes(`/title/${slug}?`)) return true;
    }
    for (const slug of deletedChannelSlugs) {
      if (link.includes(`channel=${slug}`)) return true;
    }
    return false;
  };

  const dummySliderItemIds = existingSliderItems
    .filter((item) => referencesDeletedTarget(item))
    .map((item) => item.id);
  if (dummySliderItemIds.length > 0) {
    await db
      .delete(heroSliderItems)
      .where(inArray(heroSliderItems.id, dummySliderItemIds));
  }

  const dummyLegacyIds = existingLegacySlides
    .filter((s) => referencesDeletedTarget(s))
    .map((s) => s.id);
  if (dummyLegacyIds.length > 0) {
    await db.delete(heroSlides).where(inArray(heroSlides.id, dummyLegacyIds));
  }

  // 4. Now safely delete synthetic dummy channels and dummy VOD contents
  if (deletedChannelIds.size > 0) {
    await db
      .delete(channels)
      .where(inArray(channels.id, Array.from(deletedChannelIds)));
  }

  if (dummyContentIds.length > 0) {
    await db.delete(contents).where(inArray(contents.id, dummyContentIds));
  }

  // 5. Seed fresh hero slides using real Bangla dramas and real Live TV channels if empty
  const sliderIdByPage = new Map(sliders.map((s) => [s.pageKey, s.id]));
  const remainingRealDramas = allContents
    .filter((c) => !dummyContentIdSet.has(c.id))
    .slice(0, 3);
  const starJalsha = channelBySlug.get('star-jalsha');
  const zeeBangla = channelBySlug.get('zee-bangla-hd');
  const tSports = channelBySlug.get('t-sports-hd');
  const starSports1 = channelBySlug.get('star-sports-1-hd');

  const remainingHomeItems = await db
    .select()
    .from(heroSliderItems)
    .where(eq(heroSliderItems.pageKey, 'home'));
  if (remainingHomeItems.length === 0) {
    const homeSliderId = sliderIdByPage.get('home') ?? null;
    const homeSlidesToInsert: Array<typeof heroSliderItems.$inferInsert> = [];
    if (remainingRealDramas[0]) {
      homeSlidesToInsert.push({
        sliderId: homeSliderId,
        pageKey: 'home',
        title: remainingRealDramas[0].title,
        subtitle:
          remainingRealDramas[0].synopsis ||
          'Featured Bangla drama streaming now in full adaptive HD.',
        badgeText: 'Featured Drama',
        categoryLabel: 'Bangla Drama',
        languageLabel: 'Bangla',
        imageUrl:
          remainingRealDramas[0].backdropUrl ||
          '/src/assets/images/hero_bangla_cinema_river_1794754860005.jpg',
        ctaLabel: 'Watch Now',
        ctaLink: `/title/${remainingRealDramas[0].slug}`,
        secondaryCtaLabel: 'All Dramas',
        secondaryCtaLink: '/drama',
        contentId: remainingRealDramas[0].id,
        sortOrder: 1,
        isActive: true,
      });
    }
    if (tSports) {
      homeSlidesToInsert.push({
        sliderId: homeSliderId,
        pageKey: 'home',
        title: 'T Sports Live',
        subtitle: 'Live cricket, football coverage, and studio sports broadcasts.',
        badgeText: 'LIVE SPORTS',
        categoryLabel: 'Sports Channels',
        languageLabel: 'Bangla',
        imageUrl: '/src/assets/images/hero_continental_cup_1794748094316.jpg',
        ctaLabel: 'Watch Live',
        ctaLink: `/live-tv?channel=${tSports.slug}`,
        secondaryCtaLabel: 'All Channels',
        secondaryCtaLink: '/live-tv',
        channelId: tSports.id,
        sortOrder: 2,
        isActive: true,
      });
    }
    if (starJalsha) {
      homeSlidesToInsert.push({
        sliderId: homeSliderId,
        pageKey: 'home',
        title: 'Star Jalsha Live',
        subtitle: 'Nonstop Bangla prime-time serials, reality shows, and cinema specials.',
        badgeText: 'LIVE TV',
        categoryLabel: 'Bangla Channels',
        languageLabel: 'Bangla',
        imageUrl: '/src/assets/images/hero_solstice_harbor_1794748094409.jpg',
        ctaLabel: 'Watch Live',
        ctaLink: `/live-tv?channel=${starJalsha.slug}`,
        secondaryCtaLabel: 'Live Guide',
        secondaryCtaLink: '/live-tv',
        channelId: starJalsha.id,
        sortOrder: 3,
        isActive: true,
      });
    }
    if (homeSlidesToInsert.length > 0) {
      await db.insert(heroSliderItems).values(homeSlidesToInsert);
    }
  }

  const remainingLiveItems = await db
    .select()
    .from(heroSliderItems)
    .where(eq(heroSliderItems.pageKey, 'live_tv'));
  if (remainingLiveItems.length === 0) {
    const liveSliderId = sliderIdByPage.get('live_tv') ?? null;
    const liveSlidesToInsert: Array<typeof heroSliderItems.$inferInsert> = [];
    if (starJalsha) {
      liveSlidesToInsert.push({
        sliderId: liveSliderId,
        pageKey: 'live_tv',
        title: 'Star Jalsha Live',
        subtitle: '24/7 Bangla prime-time entertainment with multi-source failover.',
        badgeText: 'LIVE NOW',
        categoryLabel: 'Bangla Channels',
        languageLabel: 'Bangla',
        imageUrl: '/src/assets/images/hero_bangla_cinema_river_1794754860005.jpg',
        ctaLabel: 'Watch Live',
        ctaLink: `/live-tv?channel=${starJalsha.slug}`,
        secondaryCtaLabel: 'Channel Guide',
        secondaryCtaLink: '/live-tv',
        channelId: starJalsha.id,
        sortOrder: 1,
        isActive: true,
      });
    }
    if (tSports) {
      liveSlidesToInsert.push({
        sliderId: liveSliderId,
        pageKey: 'live_tv',
        title: 'T Sports HD Live',
        subtitle: 'Live championship cricket, football, and studio analysis.',
        badgeText: 'LIVE SPORTS',
        categoryLabel: 'Sports Channels',
        languageLabel: 'Bangla',
        imageUrl: '/src/assets/images/hero_continental_cup_1794748094316.jpg',
        ctaLabel: 'Watch Live',
        ctaLink: `/live-tv?channel=${tSports.slug}`,
        secondaryCtaLabel: 'All Channels',
        secondaryCtaLink: '/live-tv',
        channelId: tSports.id,
        sortOrder: 2,
        isActive: true,
      });
    }
    if (zeeBangla) {
      liveSlidesToInsert.push({
        sliderId: liveSliderId,
        pageKey: 'live_tv',
        title: 'Zee Bangla HD Live',
        subtitle: 'Popular Bangla family dramas, music competitions, and weekend films.',
        badgeText: 'LIVE TV',
        categoryLabel: 'Bangla Channels',
        languageLabel: 'Bangla',
        imageUrl: '/src/assets/images/hero_solstice_harbor_1794748094409.jpg',
        ctaLabel: 'Watch Live',
        ctaLink: `/live-tv?channel=${zeeBangla.slug}`,
        secondaryCtaLabel: 'Bangla Hub',
        secondaryCtaLink: '/drama',
        channelId: zeeBangla.id,
        sortOrder: 3,
        isActive: true,
      });
    }
    if (liveSlidesToInsert.length > 0) {
      await db.insert(heroSliderItems).values(liveSlidesToInsert);
    }
  }

  const remainingDramaItems = await db
    .select()
    .from(heroSliderItems)
    .where(eq(heroSliderItems.pageKey, 'drama'));
  if (remainingDramaItems.length === 0 && remainingRealDramas[0]) {
    await db.insert(heroSliderItems).values({
      sliderId: sliderIdByPage.get('drama') ?? null,
      pageKey: 'drama',
      title: remainingRealDramas[0].title,
      subtitle:
        remainingRealDramas[0].synopsis ||
        'Popular Bangla television drama streaming in adaptive HD.',
      badgeText: 'Bangla Drama',
      categoryLabel: 'Bangla Drama',
      languageLabel: 'Bangla',
      imageUrl:
        remainingRealDramas[0].backdropUrl ||
        '/src/assets/images/hero_bangla_cinema_river_1794754860005.jpg',
      ctaLabel: 'Watch Drama',
      ctaLink: `/title/${remainingRealDramas[0].slug}`,
      secondaryCtaLabel: 'More Info',
      secondaryCtaLink: `/title/${remainingRealDramas[0].slug}`,
      contentId: remainingRealDramas[0].id,
      sortOrder: 1,
      isActive: true,
    });
  }

  const remainingSportsItems = await db
    .select()
    .from(heroSliderItems)
    .where(eq(heroSliderItems.pageKey, 'sports'));
  const featuredSportsChannel = tSports || starSports1;
  if (remainingSportsItems.length === 0 && featuredSportsChannel) {
    await db.insert(heroSliderItems).values({
      sliderId: sliderIdByPage.get('sports') ?? null,
      pageKey: 'sports',
      title: `${featuredSportsChannel.name} Live`,
      subtitle: 'Live cricket, football coverage, and studio broadcasts in adaptive HD.',
      badgeText: 'LIVE SPORTS',
      categoryLabel: 'Sports Channels',
      languageLabel: featuredSportsChannel.language || 'English',
      imageUrl: '/src/assets/images/hero_continental_cup_1794748094316.jpg',
      ctaLabel: 'Watch Live',
      ctaLink: `/live-tv?channel=${featuredSportsChannel.slug}`,
      secondaryCtaLabel: 'All Live TV',
      secondaryCtaLink: '/live-tv',
      channelId: featuredSportsChannel.id,
      sortOrder: 1,
      isActive: true,
    });
  }

  const remainingLegacySlides = await db.select().from(heroSlides);
  if (remainingLegacySlides.length === 0 && remainingRealDramas[0]) {
    await db.insert(heroSlides).values({
      title: remainingRealDramas[0].title,
      subtitle:
        remainingRealDramas[0].synopsis ||
        'Featured Bangla drama streaming now in full adaptive HD.',
      badgeText: 'Featured Drama',
      imageUrl:
        remainingRealDramas[0].backdropUrl ||
        '/src/assets/images/hero_bangla_cinema_river_1794754860005.jpg',
      ctaLabel: 'Watch Now',
      ctaLink: `/title/${remainingRealDramas[0].slug}`,
      contentId: remainingRealDramas[0].id,
      sortOrder: 1,
      isActive: true,
    });
  }

  await db
    .insert(systemSettings)
    .values({
      key: USER_CUSTOM_CLEANUP_KEY,
      value: 'true',
      category: 'system',
      description:
        'Adds 9 user primary channel stream URLs and removes all synthetic Mux/Apple dummy channels and VOD items',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: 'true', updatedAt: new Date() },
    });

  console.log(
    `[Seed] User custom streams & dummy cleanup complete: +${customStreamsAdded} new primary streams, removed ${dummyStreamIds.length} dummy streams, ${deletedChannelIds.size} dummy channels, ${dummyContentIds.length} dummy VOD items, ${dummySliderItemIds.length} dummy hero slides.`
  );
}

