import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HeroSlider } from '../components/HeroSlider.tsx';
import { PosterCard } from '../components/PosterCard.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, formatTimecode } from '../services/api.ts';
import {
  ContentItem,
  HeroSlide,
  HomepageSection,
  PageHeroSlider,
} from '../types/platform.ts';

interface HomePageProps {
  navigate: (path: string) => void;
}

export function HomePage({ navigate }: HomePageProps) {
  const { user } = useAuth();
  const [heroSlider, setHeroSlider] = useState<PageHeroSlider | null>(null);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [banglaFilter, setBanglaFilter] = useState<'all' | 'movie' | 'drama' | 'series'>('all');
  const [intlFilter, setIntlFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const sectionsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiFetch('/api/home')
      .then((data) => {
        if (!mounted) return;
        setHeroSlider(data.heroSlider || null);
        setSlides(data.heroSlides || []);
        setSections(data.sections || []);
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || 'Unable to load catalog');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [user?.id, reloadNonce]);

  const handleSectionsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const target = e.target as HTMLElement;
    const currentSection = target.closest('[data-tv-section]');
    if (!currentSection || !sectionsContainerRef.current) return;

    const allSections = Array.from(
      sectionsContainerRef.current.querySelectorAll<HTMLElement>('[data-tv-section]')
    );
    const idx = allSections.indexOf(currentSection as HTMLElement);
    if (idx < 0) return;

    const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < allSections.length) {
      const focusable = allSections[nextIdx].querySelector<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex="0"]'
      );
      if (focusable) {
        e.preventDefault();
        focusable.focus();
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-10 pb-12">
        <div className="skeleton-shimmer h-[74vh] min-h-[470px] w-full" />
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer aspect-video rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <p className="font-display text-xl font-bold text-white">Catalog Unavailable</p>
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
      <HeroSlider slides={slides} slider={heroSlider} navigate={navigate} />

      <div
        ref={sectionsContainerRef}
        onKeyDown={handleSectionsKeyDown}
        className="mt-8 w-full space-y-11 px-4 sm:px-6 lg:px-8"
      >
        {sections.map((section: any) => {
          if (section.sectionType === 'live_channels' || section.sectionType === 'news_channels') {
            return null;
          }

          if (section.sectionType === 'continue_watching') {
            const cwItems = section.items || [];
            if (cwItems.length === 0) return null;
            return (
              <section key={section.id} data-tv-section>
                <div className="mb-3.5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
                        {section.title}
                      </h2>
                      <button
                        type="button"
                        onClick={() => navigate(section.viewAllLink || '/history')}
                        className="tv-focusable inline-flex items-center gap-0.5 text-xs font-medium text-slate-300 hover:text-white"
                      >
                        <span>View All</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {section.subtitle && (
                      <p className="mt-0.5 text-xs text-slate-400">{section.subtitle}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
                  {cwItems.map((row: any) => {
                    const hist = row.history || {};
                    const pct = hist.durationSeconds
                      ? Math.min(100, Math.round((hist.positionSeconds / hist.durationSeconds) * 100))
                      : 25;
                    return (
                      <button
                        key={hist.id || row.id}
                        type="button"
                        onClick={() => navigate(`/title/${row.slug}`)}
                        className="tv-focusable group rounded-lg text-left focus:outline-none"
                      >
                        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#141720] ring-1 ring-white/10 group-hover:ring-pink-500/70">
                          <img
                            src={row.backdropUrl || row.posterUrl}
                            alt={row.title}
                            referrerPolicy="no-referrer"
                            className="block h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                            <div
                              className="h-full bg-gradient-to-r from-[#9333EA] to-[#EC4899]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <p className="mt-2 truncate text-sm font-semibold text-white">
                          {row.title}
                        </p>
                        <p className="mt-0.5 font-mono-num text-xs text-slate-400">
                          Resume at {formatTimecode(hist.positionSeconds || 0)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          }

          if (section.sectionType === 'bangla_entertainment') {
            const banglaItems: ContentItem[] = (section.items || []).filter((item: ContentItem) =>
              banglaFilter === 'all' ? true : item.contentType === banglaFilter
            );
            if ((section.items || []).length === 0) return null;

            return (
              <section key={section.id} data-tv-section>
                <div className="mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
                        {section.title}
                      </h2>
                      <button
                        type="button"
                        onClick={() => navigate(section.viewAllLink || '/drama')}
                        className="tv-focusable inline-flex items-center gap-0.5 text-xs font-medium text-slate-300 hover:text-white"
                      >
                        <span>View All</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {section.subtitle && (
                      <p className="mt-0.5 text-xs text-slate-400">{section.subtitle}</p>
                    )}
                  </div>

                  <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
                    {[
                      { key: 'all', label: 'All Bangla' },
                      { key: 'movie', label: 'Movies' },
                      { key: 'drama', label: 'Drama' },
                      { key: 'series', label: 'Web Series' },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setBanglaFilter(tab.key as any)}
                        className={`tv-focusable shrink-0 rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                          banglaFilter === tab.key
                            ? 'bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-white'
                            : 'border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <WidescreenRailTrack
                  title={section.title}
                  items={banglaItems.length > 0 ? banglaItems : section.items}
                  showRibbon={section.showRecentlyAddedRibbon}
                  onSelect={(slug) => navigate(`/title/${slug}`)}
                />
              </section>
            );
          }

          if (section.sectionType === 'international_entertainment') {
            const allIntl: ContentItem[] = section.items || [];
            if (allIntl.length === 0) return null;
            const availableLangs = Array.from(
              new Set(allIntl.map((i) => i.language).filter(Boolean))
            );
            const filteredIntl =
              intlFilter === 'all'
                ? allIntl
                : allIntl.filter((i) => i.language.toLowerCase() === intlFilter.toLowerCase());

            return (
              <section key={section.id} data-tv-section>
                <div className="mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
                        {section.title}
                      </h2>
                      <button
                        type="button"
                        onClick={() => navigate(section.viewAllLink || '/series')}
                        className="tv-focusable inline-flex items-center gap-0.5 text-xs font-medium text-slate-300 hover:text-white"
                      >
                        <span>View All</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {section.subtitle && (
                      <p className="mt-0.5 text-xs text-slate-400">{section.subtitle}</p>
                    )}
                  </div>

                  <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setIntlFilter('all')}
                      className={`tv-focusable shrink-0 rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                        intlFilter === 'all'
                          ? 'bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-white'
                          : 'border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      All International
                    </button>
                    {availableLangs.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setIntlFilter(lang)}
                        className={`tv-focusable shrink-0 rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                          intlFilter === lang
                            ? 'bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-white'
                            : 'border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <WidescreenRailTrack
                  title={section.title}
                  items={filteredIntl.length > 0 ? filteredIntl : allIntl}
                  showRibbon={section.showRecentlyAddedRibbon}
                  onSelect={(slug) => navigate(`/title/${slug}`)}
                />
              </section>
            );
          }

          const routeMap: Record<string, string> = {
            latest_content: '/movies',
            movies: '/movies',
            drama: '/drama',
            series: '/series',
            sports: '/sports',
            kids_family: '/movies',
            recently_added: '/movies',
          };
          const viewAllTarget = section.viewAllLink || routeMap[section.sectionType];
          const sectionItems: any[] = (section.items || []).filter(
            (i: any) => i.itemKind !== 'channel' && !Array.isArray(i.streams)
          );

          if (sectionItems.length === 0) return null;

          return (
            <div key={section.id} data-tv-section>
              <WidescreenContentRail
                title={section.title}
                subtitle={section.subtitle}
                items={sectionItems as ContentItem[]}
                showRibbon={section.showRecentlyAddedRibbon}
                onSelect={(slug) => navigate(`/title/${slug}`)}
                onViewAll={viewAllTarget ? () => navigate(viewAllTarget) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WidescreenRailTrack({
  title,
  items,
  onSelect,
  showRibbon,
}: {
  title: string;
  items: ContentItem[];
  onSelect: (slug: string) => void;
  showRibbon?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (dir: -1 | 1) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 720, behavior: 'smooth' });
  };

  return (
    <div className="relative group/rail">
      {items.length > 5 && (
        <>
          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            onClick={() => scrollByAmount(-1)}
            className="tv-focusable hidden lg:flex absolute -left-3 top-[38%] z-20 h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/75 text-white opacity-0 shadow-xl backdrop-blur-sm transition-opacity group-hover/rail:opacity-100 hover:bg-white hover:text-black"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            onClick={() => scrollByAmount(1)}
            className="tv-focusable hidden lg:flex absolute -right-3 top-[38%] z-20 h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/75 text-white shadow-xl backdrop-blur-sm transition-all hover:bg-white hover:text-black"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        className="rail-scroll grid auto-cols-[calc((100%-14px)/2)] grid-flow-col gap-3.5 overflow-x-auto pb-2 sm:auto-cols-[calc((100%-28px)/3)] lg:auto-cols-[calc((100%-56px)/5)]"
      >
        {items.map((item) => (
          <PosterCard
            key={item.id}
            item={item}
            variant="landscape"
            showRibbon={showRibbon}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

export function WidescreenContentRail({
  title,
  subtitle,
  items,
  onSelect,
  onViewAll,
  showRibbon,
}: {
  title: string;
  subtitle?: string;
  items: ContentItem[];
  onSelect: (slug: string) => void;
  onViewAll?: () => void;
  showRibbon?: boolean;
}) {
  if (!items || items.length === 0) return null;

  return (
    <section className="relative">
      <div className="mb-3.5 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
              {title}
            </h2>
            {onViewAll && (
              <button
                type="button"
                onClick={onViewAll}
                className="tv-focusable inline-flex items-center gap-0.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
              >
                <span>View All</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>

      <WidescreenRailTrack title={title} items={items} showRibbon={showRibbon} onSelect={onSelect} />
    </section>
  );
}
