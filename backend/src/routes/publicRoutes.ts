import { Router } from 'express';
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../../database/index.ts';
import {
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
  favorites,
  heroSliderItems,
  heroSlides,
  homepageSectionItems,
  homepageSections,
  navigationItems,
  packages,
  pageHeroSliders,
  seasons,
  sitePages,
  streamHealthLogs,
  systemSettings,
  watchHistory,
} from '../../../database/schema/index.ts';
import { type AuthRequest, optionalAuth } from '../middleware/auth.ts';
import { appCache } from '../services/cache.ts';
import { recomputeChannelHealth } from '../services/hlsMonitor.ts';

const router = Router();

async function hydrateChannels(channelRows: Array<typeof channels.$inferSelect>) {
  if (channelRows.length === 0) return [];
  const channelIds = channelRows.map((c) => c.id);

  const [streamRows, assignmentRows, allCats, placementRows] = await Promise.all([
    db
      .select()
      .from(channelStreams)
      .where(inArray(channelStreams.channelId, channelIds))
      .orderBy(asc(channelStreams.priority), asc(channelStreams.id)),
    db
      .select()
      .from(channelCategoryAssignments)
      .where(inArray(channelCategoryAssignments.channelId, channelIds)),
    db.select().from(channelCategories).orderBy(asc(channelCategories.sortOrder)),
    db
      .select()
      .from(channelPlacements)
      .where(inArray(channelPlacements.channelId, channelIds))
      .orderBy(asc(channelPlacements.sortOrder), asc(channelPlacements.id)),
  ]);

  const catById = new Map(allCats.map((c) => [c.id, c]));

  return channelRows.map((ch) => {
    const chStreams = streamRows.filter((s) => s.channelId === ch.id && s.isActive);
    const chCats = assignmentRows
      .filter((a) => a.channelId === ch.id)
      .map((a) => catById.get(a.categoryId))
      .filter(Boolean);

    const normalizedPlacements = placementRows
      .filter((p) => p.channelId === ch.id)
      .map((p) => p.placementKey);
    const mergedPlacements = Array.from(
      new Set([...normalizedPlacements, ...(ch.placements || [])])
    );

    return {
      ...ch,
      placements: mergedPlacements,
      placementOrderMap: Object.fromEntries(
        placementRows
          .filter((p) => p.channelId === ch.id)
          .map((p) => [p.placementKey, p.sortOrder])
      ),
      categories: chCats,
      streams: chStreams,
    };
  });
}

async function hydrateContents(contentRows: Array<typeof contents.$inferSelect>) {
  if (contentRows.length === 0) return [];
  const ids = contentRows.map((c) => c.id);

  const [assignments, allCats, seasonRows, placementRows] = await Promise.all([
    db
      .select()
      .from(contentCategoryAssignments)
      .where(inArray(contentCategoryAssignments.contentId, ids)),
    db.select().from(contentCategories).orderBy(asc(contentCategories.sortOrder)),
    db.select().from(seasons).where(inArray(seasons.contentId, ids)),
    db
      .select()
      .from(contentPlacements)
      .where(inArray(contentPlacements.contentId, ids))
      .orderBy(asc(contentPlacements.sortOrder), asc(contentPlacements.id)),
  ]);

  const catById = new Map(allCats.map((c) => [c.id, c]));

  return contentRows.map((item) => {
    const normalizedPlacements = placementRows
      .filter((p) => p.contentId === item.id)
      .map((p) => p.placementKey);
    const mergedPlacements = Array.from(
      new Set([...normalizedPlacements, ...(item.placements || [])])
    );

    return {
      ...item,
      placements: mergedPlacements,
      placementOrderMap: Object.fromEntries(
        placementRows
          .filter((p) => p.contentId === item.id)
          .map((p) => [p.placementKey, p.sortOrder])
      ),
      categories: assignments
        .filter((a) => a.contentId === item.id)
        .map((a) => catById.get(a.categoryId))
        .filter(Boolean),
      seasonCount: seasonRows.filter((s) => s.contentId === item.id).length,
    };
  });
}

async function loadPageHeroSlider(pageKey: string) {
  const cacheKey = `hero:${pageKey}`;
  const cached = appCache.get<{ slider: any; slides: any[] }>(cacheKey);
  if (cached) return cached;

  const [sliderRow] = await db
    .select()
    .from(pageHeroSliders)
    .where(eq(pageHeroSliders.pageKey, pageKey));

  const slider = sliderRow || {
    id: 0,
    pageKey,
    name: `${pageKey} Hero Slider`,
    autoplay: true,
    slideDurationMs: 6500,
    isActive: true,
  };

  if (sliderRow && !sliderRow.isActive) {
    const result = { slider, slides: [] };
    appCache.set(cacheKey, result, 30);
    return result;
  }

  const rawItems = await db
    .select()
    .from(heroSliderItems)
    .where(and(eq(heroSliderItems.pageKey, pageKey), eq(heroSliderItems.isActive, true)))
    .orderBy(asc(heroSliderItems.sortOrder), asc(heroSliderItems.id));

  const now = Date.now();
  const scheduled = rawItems.filter((item) => {
    if (item.startsAt && new Date(item.startsAt).getTime() > now) return false;
    if (item.endsAt && new Date(item.endsAt).getTime() < now) return false;
    return true;
  });

  let finalItems: any[] = scheduled;
  if (finalItems.length === 0 && pageKey === 'home') {
    const legacy = await db
      .select()
      .from(heroSlides)
      .where(eq(heroSlides.isActive, true))
      .orderBy(asc(heroSlides.sortOrder), asc(heroSlides.id));
    finalItems = legacy.map((s) => ({
      ...s,
      pageKey: 'home',
      categoryLabel: s.badgeText || 'Featured',
      languageLabel: '',
      tabletImageUrl: '',
      mobileImageUrl: '',
      secondaryCtaLabel: '',
      secondaryCtaLink: '',
    }));
  }

  const channelIds = Array.from(
    new Set(finalItems.map((s) => s.channelId).filter((id): id is number => Boolean(id)))
  );
  const contentIds = Array.from(
    new Set(finalItems.map((s) => s.contentId).filter((id): id is number => Boolean(id)))
  );

  const [linkedChannels, linkedContents] = await Promise.all([
    channelIds.length
      ? db.select().from(channels).where(inArray(channels.id, channelIds))
      : Promise.resolve([]),
    contentIds.length
      ? db.select().from(contents).where(inArray(contents.id, contentIds))
      : Promise.resolve([]),
  ]);

  const chById = new Map(linkedChannels.map((c) => [c.id, c]));
  const coById = new Map(linkedContents.map((c) => [c.id, c]));

  const hydratedSlides = finalItems.map((slide) => {
    const ch = slide.channelId ? chById.get(slide.channelId) : null;
    const co = slide.contentId ? coById.get(slide.contentId) : null;
    return {
      ...slide,
      channelSlug: ch?.slug || null,
      channelLogoUrl: ch?.logoUrl || null,
      channelNumber: ch?.channelNumber || null,
      contentSlug: co?.slug || null,
      contentType: co?.contentType || null,
      categoryLabel: slide.categoryLabel || (ch ? 'Live TV' : co?.contentType || ''),
      languageLabel: slide.languageLabel || ch?.language || co?.language || '',
    };
  });

  const payload = { slider, slides: hydratedSlides };
  appCache.set(cacheKey, payload, 30);
  return payload;
}

router.get('/hero-sliders/:pageKey', async (req, res) => {
  try {
    const pageKey = String(req.params.pageKey || 'home').trim();
    const data = await loadPageHeroSlider(pageKey);
    res.json(data);
  } catch (err) {
    console.error('/api/hero-sliders/:pageKey error:', err);
    res.status(500).json({ error: 'Failed to load hero slider' });
  }
});

function sortByPlacementOrder<T extends { placementOrderMap?: Record<string, number>; sortOrder?: number }>(
  list: T[],
  placementKey: string
): T[] {
  return [...list].sort((a, b) => {
    const ao = a.placementOrderMap?.[placementKey] ?? 9999;
    const bo = b.placementOrderMap?.[placementKey] ?? 9999;
    if (ao !== bo) return ao - bo;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

function compareNewestPublished(a: any, b: any): number {
  const aCreatedMs = new Date(a.createdAt || 0).getTime();
  const bCreatedMs = new Date(b.createdAt || 0).getTime();
  const aDay = Math.floor(aCreatedMs / 86400_000);
  const bDay = Math.floor(bCreatedMs / 86400_000);
  if (aDay !== bDay) return bDay - aDay;

  const aReleaseMs = new Date(a.releaseDate || a.createdAt || 0).getTime();
  const bReleaseMs = new Date(b.releaseDate || b.createdAt || 0).getTime();
  if (aReleaseMs !== bReleaseMs) return bReleaseMs - aReleaseMs;

  if (aCreatedMs !== bCreatedMs) return bCreatedMs - aCreatedMs;
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
}

router.get('/home', optionalAuth, async (req: AuthRequest, res) => {
  try {
    let baseData = appCache.get<{
      heroSlider: any;
      heroSlides: any[];
      sections: Array<typeof homepageSections.$inferSelect>;
      sectionItemRows: Array<typeof homepageSectionItems.$inferSelect>;
      hydratedChannels: any[];
      hydratedContents: any[];
    }>('homepage:base');

    if (!baseData) {
      const [heroData, sections, sectionItemRows, allChannels, allContents] = await Promise.all([
        loadPageHeroSlider('home'),
        db
          .select()
          .from(homepageSections)
          .where(eq(homepageSections.isActive, true))
          .orderBy(asc(homepageSections.sortOrder), asc(homepageSections.id)),
        db
          .select()
          .from(homepageSectionItems)
          .orderBy(asc(homepageSectionItems.sortOrder), asc(homepageSectionItems.id)),
        db
          .select()
          .from(channels)
          .where(eq(channels.isPublished, true))
          .orderBy(asc(channels.sortOrder), asc(channels.channelNumber)),
        db
          .select()
          .from(contents)
          .where(eq(contents.isPublished, true))
          .orderBy(asc(contents.sortOrder), desc(contents.createdAt)),
      ]);

      const [hydratedChannels, hydratedContents] = await Promise.all([
        hydrateChannels(allChannels),
        hydrateContents(allContents),
      ]);

      baseData = {
        heroSlider: heroData.slider,
        heroSlides: heroData.slides,
        sections,
        sectionItemRows,
        hydratedChannels,
        hydratedContents,
      };
      appCache.set('homepage:base', baseData, 30);
    }

    const { heroSlider, heroSlides: resolvedSlides, sections, sectionItemRows, hydratedChannels, hydratedContents } =
      baseData;

    const channelById = new Map(hydratedChannels.map((c) => [c.id, c]));
    const contentById = new Map(hydratedContents.map((c) => [c.id, c]));

    let userContinueWatching: any[] = [];
    const preferredLanguages = new Map<string, number>();
    const preferredCategoryIds = new Map<number, number>();
    const watchedContentIds = new Set<number>();

    if (req.currentUser) {
      const [historyRows, favRows] = await Promise.all([
        db
          .select({
            history: watchHistory,
            content: contents,
            episode: episodes,
          })
          .from(watchHistory)
          .leftJoin(contents, eq(watchHistory.contentId, contents.id))
          .leftJoin(episodes, eq(watchHistory.episodeId, episodes.id))
          .where(eq(watchHistory.userId, req.currentUser.id))
          .orderBy(desc(watchHistory.lastWatchedAt))
          .limit(30),
        db
          .select()
          .from(favorites)
          .where(eq(favorites.userId, req.currentUser.id)),
      ]);

      userContinueWatching = historyRows
        .filter((h) => h.content && !h.history.completed && h.history.positionSeconds > 5)
        .map((h) => ({
          ...h.content,
          history: h.history,
          episode: h.episode,
        }));

      for (const h of historyRows) {
        if (h.content) {
          if (h.history.completed) watchedContentIds.add(h.content.id);
          const lang = (h.content.language || '').toLowerCase();
          if (lang) preferredLanguages.set(lang, (preferredLanguages.get(lang) || 0) + 2);
          const hydrated = contentById.get(h.content.id);
          for (const cat of hydrated?.categories || []) {
            preferredCategoryIds.set(cat.id, (preferredCategoryIds.get(cat.id) || 0) + 2);
          }
        }
      }

      for (const fav of favRows) {
        if (fav.contentId) {
          const hydrated = contentById.get(fav.contentId);
          if (hydrated) {
            const lang = (hydrated.language || '').toLowerCase();
            if (lang) preferredLanguages.set(lang, (preferredLanguages.get(lang) || 0) + 3);
            for (const cat of hydrated.categories || []) {
              preferredCategoryIds.set(cat.id, (preferredCategoryIds.get(cat.id) || 0) + 3);
            }
          }
        }
        if (fav.channelId) {
          const ch = channelById.get(fav.channelId);
          if (ch?.language) {
            const lang = ch.language.toLowerCase();
            preferredLanguages.set(lang, (preferredLanguages.get(lang) || 0) + 2);
          }
        }
      }
    }

    const vodSections = sections.filter(
      (sec) => sec.sectionType !== 'live_channels' && sec.sectionType !== 'news_channels'
    );

    const populatedSections = vodSections.map((sec) => {
      if (sec.sectionType === 'continue_watching') {
        return {
          ...sec,
          items: userContinueWatching.slice(0, sec.maxItems),
        };
      }

      const manualRows = sectionItemRows.filter((r) => r.sectionId === sec.id);
      const manualItems: any[] = [];
      const seenItemKeys = new Set<string>();

      for (const mr of manualRows) {
        if (mr.contentId && contentById.has(mr.contentId)) {
          const co = contentById.get(mr.contentId);
          const k = `co:${co.id}`;
          if (!seenItemKeys.has(k)) {
            seenItemKeys.add(k);
            manualItems.push({ ...co, itemKind: 'content' });
          }
        }
      }

      if (sec.selectionMode === 'manual') {
        return {
          ...sec,
          items: manualItems.slice(0, sec.maxItems),
        };
      }

      let pool = hydratedContents;

      const typeFilter = sec.contentTypeFilter || '';
      if (typeFilter && typeFilter !== 'all') {
        pool = pool.filter((c) => c.contentType === typeFilter);
      } else if (sec.sectionType === 'movies') {
        pool = pool.filter((c) => c.contentType === 'movie');
      } else if (sec.sectionType === 'drama') {
        pool = pool.filter((c) => c.contentType === 'drama');
      } else if (sec.sectionType === 'series') {
        pool = pool.filter((c) => c.contentType === 'series');
      } else if (sec.sectionType === 'sports') {
        pool = pool.filter((c) => c.contentType === 'sports');
      } else if (sec.sectionType === 'bangla_entertainment') {
        pool = pool.filter((c) => (c.language || '').toLowerCase() === 'bangla');
      } else if (sec.sectionType === 'international_entertainment') {
        pool = pool.filter((c) => (c.language || '').toLowerCase() !== 'bangla');
      } else if (sec.sectionType === 'kids_family') {
        pool = pool.filter(
          (c) =>
            c.categories.some((cat: any) => cat.slug === 'kids-family') ||
            c.placements.includes('kids_family') ||
            c.rating === 'U' ||
            c.rating === 'TV-G'
        );
      } else if (sec.sectionType === 'featured') {
        pool = pool.filter((c) => c.isFeatured);
      } else if (sec.sectionType === 'latest_content' || sec.sectionType === 'recently_added') {
        pool = [...pool].sort(compareNewestPublished);
      } else if (sec.sectionType === 'recommended') {
        pool = [...pool].sort((a, b) => {
          const scoreOf = (item: any) => {
            let score = (item.isFeatured ? 2 : 0) + Math.min(2, (item.viewCount || 0) / 1000);
            const langScore = preferredLanguages.get((item.language || '').toLowerCase()) || 0;
            score += langScore;
            for (const cat of item.categories || []) {
              score += preferredCategoryIds.get(cat.id) || 0;
            }
            if (watchedContentIds.has(item.id)) score -= 3;
            return score;
          };
          return scoreOf(b) - scoreOf(a);
        });
      }

      if (sec.categoryFilter) {
        pool = pool.filter((c) => c.categories.some((cat: any) => cat.slug === sec.categoryFilter));
      }

      if (
        sec.languageFilter &&
        sec.languageFilter !== 'All' &&
        sec.languageFilter !== 'International'
      ) {
        pool = pool.filter(
          (c) => (c.language || '').toLowerCase() === sec.languageFilter!.toLowerCase()
        );
      } else if (sec.languageFilter === 'International') {
        pool = pool.filter((c) => (c.language || '').toLowerCase() !== 'bangla');
      }

      if (sec.placementKey) {
        if (sec.placementKey === 'recently_added') {
          pool = [...pool].sort(compareNewestPublished);
        } else if (sec.placementKey === 'trending') {
          const placed = sortByPlacementOrder(
            pool.filter((c) => c.placements.includes('trending')),
            'trending'
          );
          const placedIds = new Set(placed.map((c) => c.id));
          const rest = [...pool]
            .filter((c) => !placedIds.has(c.id))
            .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
          pool = [...placed, ...rest];
        } else {
          const placed = pool.filter((c) => c.placements.includes(sec.placementKey!));
          if (placed.length > 0) {
            pool = sortByPlacementOrder(placed, sec.placementKey);
          }
        }
      }

      const autoCo = pool.filter((c) => !seenItemKeys.has(`co:${c.id}`));
      const combined = sec.selectionMode === 'hybrid' ? [...manualItems, ...autoCo] : autoCo;

      return {
        ...sec,
        items: combined.slice(0, sec.maxItems),
        relatedChannels: [],
      };
    });

    res.json({
      heroSlider,
      heroSlides: resolvedSlides,
      continueWatching: userContinueWatching.slice(0, 10),
      sections: populatedSections,
    });
  } catch (err) {
    console.error('/api/home error:', err);
    res.status(500).json({ error: 'Failed to load homepage feed' });
  }
});

router.get('/channels', async (req, res) => {
  try {
    const categorySlug = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const language = typeof req.query.language === 'string' ? req.query.language.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const placement = typeof req.query.placement === 'string' ? req.query.placement.trim() : '';
    const includeHidden = req.query.includeHidden === 'true';

    const cacheKey = `channels:list:${categorySlug}:${language}:${placement}:${includeHidden}:${search}`;
    const cached = appCache.get<unknown>(cacheKey);
    if (cached) return res.json(cached);

    const [categories, channelRows] = await Promise.all([
      db
        .select()
        .from(channelCategories)
        .where(eq(channelCategories.isActive, true))
        .orderBy(asc(channelCategories.sortOrder), asc(channelCategories.id)),
      db
        .select()
        .from(channels)
        .where(eq(channels.isPublished, true))
        .orderBy(asc(channels.sortOrder), asc(channels.channelNumber)),
    ]);

    let hydrated = await hydrateChannels(channelRows);
    if (!includeHidden) {
      hydrated = hydrated.filter((ch) => ch.showOnLiveTv !== false);
    }

    const availableLanguages = Array.from(
      new Set(hydrated.map((ch) => ch.language).filter((l): l is string => Boolean(l)))
    );

    if (categorySlug && categorySlug !== 'all') {
      const catMeta = categories.find((c) => c.slug === categorySlug);
      if (catMeta?.categoryType === 'language' && catMeta.language && catMeta.language !== 'All') {
        const targetLang = catMeta.language.toLowerCase();
        hydrated = hydrated.filter((ch) => (ch.language || '').toLowerCase() === targetLang);
      } else {
        hydrated = hydrated.filter((ch) =>
          ch.categories.some((c: any) => c.slug === categorySlug)
        );
      }
    }

    if (language && language.toLowerCase() !== 'all') {
      const targetLang = language.toLowerCase();
      hydrated = hydrated.filter((ch) => (ch.language || '').toLowerCase() === targetLang);
    }

    if (placement) {
      hydrated = sortByPlacementOrder(
        hydrated.filter((ch) => ch.placements.includes(placement)),
        placement
      );
    }

    if (search) {
      hydrated = hydrated.filter(
        (ch) =>
          ch.name.toLowerCase().includes(search) ||
          (ch.description || '').toLowerCase().includes(search) ||
          (ch.language || '').toLowerCase().includes(search) ||
          (ch.country || '').toLowerCase().includes(search) ||
          String(ch.channelNumber).includes(search)
      );
    }

    const payload = { categories, languages: availableLanguages, channels: hydrated };
    appCache.set(cacheKey, payload, 30);
    res.json(payload);
  } catch (err) {
    console.error('/api/channels error:', err);
    res.status(500).json({ error: 'Failed to load live channels' });
  }
});

router.get('/channels/:slug', async (req, res) => {
  try {
    const [ch] = await db
      .select()
      .from(channels)
      .where(and(eq(channels.slug, req.params.slug), eq(channels.isPublished, true)));
    if (!ch) return res.status(404).json({ error: 'Channel not found' });

    const [hydrated] = await hydrateChannels([ch]);
    res.json({ channel: hydrated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load channel' });
  }
});

router.post('/channels/:id/streams/:streamId/failover-report', async (req, res) => {
  try {
    const channelId = Number(req.params.id);
    const streamId = Number(req.params.streamId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Player playback error';
    const nextStreamId = req.body?.nextStreamId ? Number(req.body.nextStreamId) : null;

    const [stream] = await db
      .select()
      .from(channelStreams)
      .where(and(eq(channelStreams.id, streamId), eq(channelStreams.channelId, channelId)));

    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    const prevStatus = stream.healthStatus;
    await db
      .update(channelStreams)
      .set({
        healthStatus: 'degraded',
        lastError: reason,
        consecutiveFailures: stream.consecutiveFailures + 1,
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(channelStreams.id, stream.id));

    await db.insert(streamHealthLogs).values({
      channelId,
      streamId,
      eventType: 'player_failover',
      previousStatus: prevStatus,
      newStatus: 'degraded',
      isPlayableHls: false,
      details: nextStreamId ? `${reason} — Player failed over to stream #${nextStreamId}` : reason,
    });

    await recomputeChannelHealth(channelId);
    res.json({ recorded: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log failover report' });
  }
});

router.get('/contents', async (req, res) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : '';
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const language = typeof req.query.language === 'string' ? req.query.language.trim() : '';
    const featured = req.query.featured === 'true';
    const placement = typeof req.query.placement === 'string' ? req.query.placement : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    const cacheKey = `catalog:list:${type}:${category}:${language}:${featured}:${placement}:${search}`;
    const cached = appCache.get<unknown>(cacheKey);
    if (cached) return res.json(cached);

    const conditions = [eq(contents.isPublished, true)];
    if (type && type !== 'all') {
      conditions.push(eq(contents.contentType, type));
    }
    if (featured) {
      conditions.push(eq(contents.isFeatured, true));
    }

    const [categories, rows] = await Promise.all([
      db.select().from(contentCategories).orderBy(asc(contentCategories.sortOrder)),
      db
        .select()
        .from(contents)
        .where(and(...conditions))
        .orderBy(asc(contents.sortOrder), desc(contents.createdAt)),
    ]);

    let hydrated = await hydrateContents(rows);

    if (category && category !== 'all') {
      hydrated = hydrated.filter((item) =>
        item.categories.some((c: any) => c.slug === category)
      );
    }
    if (language && language.toLowerCase() !== 'all') {
      hydrated = hydrated.filter(
        (item) => (item.language || '').toLowerCase() === language.toLowerCase()
      );
    }
    if (placement) {
      hydrated = sortByPlacementOrder(
        hydrated.filter((item) => item.placements.includes(placement)),
        placement
      );
    }
    if (search) {
      hydrated = hydrated.filter(
        (item) =>
          item.title.toLowerCase().includes(search) ||
          item.synopsis.toLowerCase().includes(search) ||
          (item.director || '').toLowerCase().includes(search) ||
          (item.tags || []).some((t: string) => t.toLowerCase().includes(search))
      );
    }

    const filteredCats = type
      ? categories.filter((c) => c.contentType === 'all' || c.contentType === type)
      : categories;

    const payload = { categories: filteredCats, items: hydrated };
    appCache.set(cacheKey, payload, 30);
    res.json(payload);
  } catch (err) {
    console.error('/api/contents error:', err);
    res.status(500).json({ error: 'Failed to fetch content catalog' });
  }
});

router.get('/contents/:slug', async (req, res) => {
  try {
    const [item] = await db
      .select()
      .from(contents)
      .where(and(eq(contents.slug, req.params.slug), eq(contents.isPublished, true)));

    if (!item) return res.status(404).json({ error: 'Content not found' });

    db.update(contents)
      .set({ viewCount: sql`${contents.viewCount} + 1` })
      .where(eq(contents.id, item.id))
      .catch(() => {});

    const [hydratedItem] = await hydrateContents([item]);

    const seasonRows = await db
      .select()
      .from(seasons)
      .where(and(eq(seasons.contentId, item.id), eq(seasons.isPublished, true)))
      .orderBy(asc(seasons.seasonNumber));

    const episodeRows = await db
      .select()
      .from(episodes)
      .where(and(eq(episodes.contentId, item.id), eq(episodes.isPublished, true)))
      .orderBy(asc(episodes.episodeNumber));

    const seasonsWithEpisodes = seasonRows.map((s) => ({
      ...s,
      episodes: episodeRows.filter((e) => e.seasonId === s.id),
    }));

    const relatedRows = await db
      .select()
      .from(contents)
      .where(
        and(
          eq(contents.contentType, item.contentType),
          eq(contents.isPublished, true),
          sql`${contents.id} != ${item.id}`
        )
      )
      .orderBy(desc(contents.isFeatured), desc(contents.viewCount))
      .limit(10);

    const related = await hydrateContents(relatedRows);

    res.json({
      content: hydratedItem,
      seasons: seasonsWithEpisodes,
      related,
    });
  } catch (err) {
    console.error('/api/contents/:slug error:', err);
    res.status(500).json({ error: 'Failed to load content details' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      return res.json({ query: '', channels: [], movies: [], drama: [], series: [], sports: [] });
    }

    const pattern = `%${q}%`;
    const [matchedChannels, matchedContents] = await Promise.all([
      db
        .select()
        .from(channels)
        .where(
          and(
            eq(channels.isPublished, true),
            or(
              ilike(channels.name, pattern),
              ilike(channels.description, pattern),
              ilike(channels.language, pattern)
            )
          )
        )
        .orderBy(asc(channels.sortOrder)),
      db
        .select()
        .from(contents)
        .where(
          and(
            eq(contents.isPublished, true),
            or(
              ilike(contents.title, pattern),
              ilike(contents.synopsis, pattern),
              ilike(contents.director, pattern),
              ilike(contents.language, pattern)
            )
          )
        )
        .orderBy(desc(contents.viewCount)),
    ]);

    const [hydratedChannels, hydratedContents] = await Promise.all([
      hydrateChannels(matchedChannels),
      hydrateContents(matchedContents),
    ]);

    res.json({
      query: q,
      channels: hydratedChannels,
      movies: hydratedContents.filter((c) => c.contentType === 'movie'),
      drama: hydratedContents.filter((c) => c.contentType === 'drama'),
      series: hydratedContents.filter((c) => c.contentType === 'series'),
      sports: hydratedContents.filter((c) => c.contentType === 'sports'),
    });
  } catch (err) {
    console.error('/api/search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/packages', async (_req, res) => {
  try {
    const cached = appCache.get<unknown>('packages:active');
    if (cached) return res.json(cached);

    const rows = await db
      .select()
      .from(packages)
      .where(eq(packages.isActive, true))
      .orderBy(asc(packages.sortOrder));

    const payload = { packages: rows };
    appCache.set('packages:active', payload, 30);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load subscription packages' });
  }
});

router.get('/navigation', async (_req, res) => {
  try {
    const cached = appCache.get<unknown>('navigation:public');
    if (cached) return res.json(cached);

    const rows = await db
      .select()
      .from(navigationItems)
      .where(eq(navigationItems.isVisible, true))
      .orderBy(asc(navigationItems.sortOrder), asc(navigationItems.id));

    const payload = {
      header: rows.filter((r) => r.location === 'header'),
      footer: rows.filter((r) => r.location === 'footer'),
      footerMembership: rows.filter((r) => r.location === 'footer_membership'),
      all: rows,
    };
    appCache.set('navigation:public', payload, 30);
    res.json(payload);
  } catch (err) {
    console.error('/api/navigation error:', err);
    res.status(500).json({ error: 'Failed to load navigation menu' });
  }
});

router.get('/pages', async (_req, res) => {
  try {
    const cached = appCache.get<unknown>('pages:public');
    if (cached) return res.json(cached);

    const rows = await db
      .select()
      .from(sitePages)
      .where(eq(sitePages.isPublished, true))
      .orderBy(asc(sitePages.sortOrder), asc(sitePages.id));

    const payload = { pages: rows };
    appCache.set('pages:public', payload, 30);
    res.json(payload);
  } catch (err) {
    console.error('/api/pages error:', err);
    res.status(500).json({ error: 'Failed to load pages' });
  }
});

router.get('/pages/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const [page] = await db
      .select()
      .from(sitePages)
      .where(and(or(eq(sitePages.slug, slug), eq(sitePages.pageKey, slug)), eq(sitePages.isPublished, true)));

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }
    res.json({ page });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load page' });
  }
});

router.get('/settings/public', async (_req, res) => {
  try {
    const cached = appCache.get<unknown>('settings:public');
    if (cached) return res.json(cached);

    const rows = await db.select().from(systemSettings);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const payload = {
      platformName: map.platform_name === 'VeloStream' ? 'VEXORA' : map.platform_name || 'VEXORA',
      supportEmail: map.support_email || 'support@velostream.tv',
      maintenanceMode: map.maintenance_mode === 'true',
      logoUrl: map.logo_url || '',
      faviconUrl: map.favicon_url || '',
      footerTagline:
        map.footer_tagline ||
        'Commercial OTT cinema, serialized drama, and live IPTV broadcasting with multi-CDN HLS failover.',
      contactPhone: map.contact_phone || '',
      contactAddress: map.contact_address || '',
      seoTitle: map.seo_title || 'VEXORA — OTT & Live IPTV Streaming',
      seoDescription:
        map.seo_description ||
        'Stream Live TV channels with automatic HLS failover, movies, drama, web series, and live sports in adaptive HD and 4K.',
      socialLinks: {
        facebook: map.social_facebook || '',
        youtube: map.social_youtube || '',
        instagram: map.social_instagram || '',
        x: map.social_x || '',
      },
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
    };
    appCache.set('settings:public', payload, 30);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load platform settings' });
  }
});

router.get('/test-hls/invalid-html', (_req, res) => {
  res.status(200).type('text/html').send('<html><body><h1>200 OK but not HLS</h1></body></html>');
});

export default router;
