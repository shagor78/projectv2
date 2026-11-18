import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, Film, Search, Trophy } from 'lucide-react';
import { HeroSlider } from '../components/HeroSlider.tsx';
import { PosterCard } from '../components/PosterCard.tsx';
import { apiFetch } from '../services/api.ts';
import {
  ContentCategory,
  ContentItem,
  HeroSlide,
  PageHeroSlider,
} from '../types/platform.ts';
import { WidescreenContentRail } from './HomePage.tsx';

interface CatalogPageProps {
  contentType: 'movie' | 'drama' | 'series' | 'sports';
  navigate: (path: string) => void;
}

const SECTION_META: Record<
  CatalogPageProps['contentType'],
  { pageKey: string; title: string; subtitle: string }
> = {
  drama: {
    pageKey: 'drama',
    title: 'Bangla Drama',
    subtitle: 'Full collection of Bangla Natok, Eid Specials, Comedy, and Emotional Dramas.',
  },
  movie: {
    pageKey: 'movies',
    title: 'Movies',
    subtitle: 'Feature films, premiere thrillers, and cinema hits in adaptive HD & 4K.',
  },
  series: {
    pageKey: 'series',
    title: 'Web Series',
    subtitle: 'Original multi-season thrillers, mysteries, and investigative series.',
  },
  sports: {
    pageKey: 'sports',
    title: 'Sports',
    subtitle: 'Arena broadcasts, motorsport sprints, and full-match replays.',
  },
};

const DRAMA_PAGE_SIZE = 50;

export function CatalogPage({ contentType, navigate }: CatalogPageProps) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [heroSlider, setHeroSlider] = useState<PageHeroSlider | null>(null);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(DRAMA_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const isDramaOnlyBangla = contentType === 'drama';
  const isSeriesDirectGrid = contentType === 'series';
  const showFilterBar = contentType === 'movie';
  const meta = SECTION_META[contentType];

  useEffect(() => {
    let cancelled = false;
    setSelectedCategory('all');
    setSelectedLanguage(isDramaOnlyBangla ? 'Bangla' : 'All');
    setSearchQuery('');
    setVisibleCount(DRAMA_PAGE_SIZE);
    setLoading(true);
    setError(null);
    const contentsEndpoint = isDramaOnlyBangla
      ? '/api/contents?type=drama&language=Bangla'
      : `/api/contents?type=${contentType}`;
    Promise.all([
      apiFetch(contentsEndpoint),
      apiFetch(`/api/hero-sliders/${meta.pageKey}`).catch(() => ({ slider: null, slides: [] })),
    ])
      .then(([contentRes, heroRes]) => {
        if (cancelled) return;
        const rawItems: ContentItem[] = contentRes.items || [];
        const scopedItems = isDramaOnlyBangla
          ? rawItems.filter((item) => (item.language || '').toLowerCase() === 'bangla')
          : rawItems;
        setItems(scopedItems);
        setCategories(contentRes.categories || []);
        setHeroSlider(heroRes.slider || null);
        setHeroSlides(heroRes.slides || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || `Failed to load ${meta.title.toLowerCase()} catalog`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contentType, isDramaOnlyBangla, meta.pageKey, meta.title, reloadNonce]);

  useEffect(() => {
    setVisibleCount(DRAMA_PAGE_SIZE);
  }, [selectedCategory, searchQuery, contentType]);

  const effectiveHeroSlides = useMemo<HeroSlide[]>(() => {
    const banglaSlides = isDramaOnlyBangla
      ? heroSlides.filter((s) => !s.languageLabel || s.languageLabel.toLowerCase() === 'bangla')
      : heroSlides;
    if (banglaSlides.length > 0) return banglaSlides;
    const featured = items.filter((i) => i.isFeatured);
    const pool = (featured.length > 0 ? featured : items).slice(0, 4);
    return pool.map((item, idx) => ({
      id: item.id,
      pageKey: meta.pageKey,
      title: item.title,
      subtitle: item.synopsis,
      badgeText: `${meta.title} Spotlight`,
      categoryLabel: item.categories?.[0]?.name || meta.title,
      languageLabel: item.language,
      imageUrl: item.backdropUrl || item.posterUrl,
      ctaLabel: 'Watch Now',
      ctaLink: `/title/${item.slug}`,
      secondaryCtaLabel: 'More Info',
      secondaryCtaLink: `/title/${item.slug}`,
      contentId: item.id,
      channelId: null,
      sortOrder: idx + 1,
      isActive: true,
    }));
  }, [heroSlides, isDramaOnlyBangla, items, meta.pageKey, meta.title]);

  const availableLanguages = useMemo(
    () => Array.from(new Set(items.map((i) => i.language).filter(Boolean))),
    [items]
  );

  const visibleCategories = useMemo(() => {
    if (!isDramaOnlyBangla) return categories;
    return categories.filter((cat) =>
      items.some((item) => item.categories.some((c) => c.id === cat.id))
    );
  }, [categories, isDramaOnlyBangla, items]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of items) {
      for (const c of item.categories) {
        counts.set(c.id, (counts.get(c.id) || 0) + 1);
      }
    }
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (isDramaOnlyBangla && (item.language || '').toLowerCase() !== 'bangla') {
        return false;
      }
      const catOk =
        selectedCategory === 'all' ||
        item.categories.some((c) => c.slug === selectedCategory);
      const langOk =
        isDramaOnlyBangla ||
        selectedLanguage === 'All' ||
        (item.language || '').toLowerCase() === selectedLanguage.toLowerCase();
      const q = searchQuery.trim().toLowerCase();
      const searchOk =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.synopsis.toLowerCase().includes(q) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(q));
      return catOk && langOk && searchOk;
    });
  }, [items, isDramaOnlyBangla, selectedCategory, selectedLanguage, searchQuery]);

  const showcaseRows = useMemo(() => {
    if (isDramaOnlyBangla || isSeriesDirectGrid || items.length === 0) return [];
    const rows: Array<{ key: string; title: string; catSlug?: string; list: ContentItem[]; ribbon?: boolean }> = [];

    const trending = [...items].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    rows.push({ key: 'trending', title: 'Trending', list: trending, ribbon: false });

    const recent = [...items].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    rows.push({ key: 'recent', title: 'Recently Added', list: recent, ribbon: true });

    for (const cat of categories) {
      const catItems = items.filter((item) => item.categories.some((c) => c.id === cat.id));
      if (catItems.length > 0) {
        rows.push({
          key: `cat-${cat.id}`,
          title: cat.name,
          catSlug: cat.slug,
          list: catItems,
        });
      }
    }

    return rows;
  }, [isDramaOnlyBangla, isSeriesDirectGrid, items, categories]);

  const isFilteredView =
    isDramaOnlyBangla ||
    isSeriesDirectGrid ||
    selectedCategory !== 'all' ||
    selectedLanguage !== 'All' ||
    searchQuery.trim().length > 0;

  const displayedItems = isDramaOnlyBangla ? filtered.slice(0, visibleCount) : filtered;
  const remainingDramaCount = isDramaOnlyBangla ? Math.max(0, filtered.length - displayedItems.length) : 0;

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
        <p className="mt-3 font-display text-xl font-bold text-white">Failed to Load {meta.title}</p>
        <p className="mt-2 text-sm text-slate-400">{error}</p>
        <button
          type="button"
          onClick={() => setReloadNonce((n) => n + 1)}
          className="mt-5 rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] px-6 py-2.5 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="pb-16">
      {!loading && effectiveHeroSlides.length > 0 && (
        <HeroSlider
          slides={effectiveHeroSlides}
          slider={heroSlider}
          navigate={navigate}
          heightClass="h-[68vh] min-h-[450px] max-h-[680px]"
        />
      )}

      <div className="w-full space-y-10 px-4 pt-6 sm:px-6 lg:px-8">
        {showFilterBar && (
          <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`tv-focusable shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-white'
                    : 'border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                All {meta.title} ({items.length})
              </button>
              {visibleCategories.map((cat) => {
                const countForCat = categoryCounts.get(cat.id) || 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={`tv-focusable shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      selectedCategory === cat.slug
                        ? 'bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-white'
                        : 'border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {cat.name} ({countForCat})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {availableLanguages.length > 1 && (
                <select
                  aria-label="Filter by language"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="tv-focusable h-9 rounded-full border border-white/15 bg-[#12141C] px-3.5 text-xs font-medium text-white focus:border-pink-400 focus:outline-none"
                >
                  <option value="All">All Languages</option>
                  {availableLanguages.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              )}

              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${meta.title.toLowerCase()}...`}
                  className="tv-focusable h-9 w-full rounded-full border border-white/15 bg-[#12141C] pl-9 pr-4 text-xs text-white placeholder-slate-400 focus:border-pink-400 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer aspect-video rounded-lg" />
            ))}
          </div>
        ) : isFilteredView ? (
          filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#12141C] py-16 text-center">
              {contentType === 'sports' ? (
                <Trophy className="mx-auto h-10 w-10 text-slate-500" />
              ) : (
                <Film className="mx-auto h-10 w-10 text-slate-500" />
              )}
              <p className="mt-3 font-display text-lg font-semibold text-white">No titles found</p>
              <p className="mt-1 text-sm text-slate-400">
                Try selecting a different genre or search term.
              </p>
            </div>
          ) : (
            <section>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="h-5 w-[3px] rounded-full bg-gradient-to-b from-[#9333EA] to-[#EC4899]"
                    />
                    <h2 className="font-display text-lg font-bold text-white sm:text-xl">
                      {visibleCategories.find((c) => c.slug === selectedCategory)?.name ||
                        (isDramaOnlyBangla
                          ? 'All Bangla Drama'
                          : isSeriesDirectGrid
                            ? 'All Web Series'
                            : `Matching ${meta.title}`)}
                    </h2>
                    <span className="font-mono-num text-xs text-slate-400">
                      ({filtered.length})
                    </span>
                  </div>
                  {isDramaOnlyBangla && (
                    <p className="mt-1 text-xs text-slate-400">
                      Showing {displayedItems.length} of {filtered.length} Bangla Dramas
                    </p>
                  )}
                </div>
                {!isDramaOnlyBangla && !isSeriesDirectGrid ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('all');
                      setSelectedLanguage('All');
                      setSearchQuery('');
                    }}
                    className="inline-flex items-center gap-0.5 text-xs font-medium text-pink-400 hover:text-pink-300"
                  >
                    <span>Back to Rows</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ) : (selectedCategory !== 'all' || searchQuery.trim().length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('all');
                      setSearchQuery('');
                    }}
                    className="inline-flex items-center gap-0.5 text-xs font-medium text-pink-400 hover:text-pink-300"
                  >
                    <span>Show All {meta.title}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
                {displayedItems.map((item) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    variant="landscape"
                    onSelect={(slug) => navigate(`/title/${slug}`)}
                  />
                ))}
              </div>

              {isDramaOnlyBangla && remainingDramaCount > 0 && (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + DRAMA_PAGE_SIZE)}
                    className="tv-focusable rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-pink-500/20 hover:brightness-110 transition-all"
                  >
                    Load {Math.min(DRAMA_PAGE_SIZE, remainingDramaCount)} More Dramas
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleCount(filtered.length)}
                    className="tv-focusable rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
                  >
                    Show All ({remainingDramaCount} remaining)
                  </button>
                </div>
              )}
            </section>
          )
        ) : (
          <div className="space-y-10">
            {showcaseRows.map((row) => (
              <WidescreenContentRail
                key={row.key}
                title={row.title}
                items={row.list}
                showRibbon={row.ribbon}
                onSelect={(slug) => navigate(`/title/${slug}`)}
                onViewAll={row.catSlug ? () => setSelectedCategory(row.catSlug!) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
