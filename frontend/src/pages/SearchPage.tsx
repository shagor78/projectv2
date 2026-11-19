import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Search as SearchIcon } from 'lucide-react';
import { LiveChannelCard } from '../components/LiveChannelCard.tsx';
import { PosterCard } from '../components/PosterCard.tsx';
import { apiFetch } from '../services/api.ts';
import { ContentItem, LiveChannel } from '../types/platform.ts';
import { normalizeClientQuery } from '../utils/search.ts';

interface SearchPageProps {
  initialQuery: string;
  navigate: (path: string) => void;
}

type SearchTab = 'all' | 'channels' | 'movies' | 'drama' | 'series' | 'sports';

const SEARCH_PAGE_SIZE = 25;

export function SearchPage({ initialQuery, navigate }: SearchPageProps) {
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<SearchTab>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    channels: LiveChannel[];
    movies: ContentItem[];
    drama: ContentItem[];
    series: ContentItem[];
    sports: ContentItem[];
  }>({ channels: [], movies: [], drama: [], series: [], sports: [] });

  useEffect(() => {
    setQuery(initialQuery);
    setPage(1);
  }, [initialQuery]);

  useEffect(() => {
    const normalized = normalizeClientQuery(query);
    if (!normalized) {
      setResults({ channels: [], movies: [], drama: [], series: [], sports: [] });
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      apiFetch(`/api/search?q=${encodeURIComponent(query.trim().replace(/\s+/g, ' '))}`)
        .then((data) => {
          if (cancelled) return;
          setResults({
            channels: data.channels || [],
            movies: data.movies || [],
            drama: data.drama || [],
            series: data.series || [],
            sports: data.sports || [],
          });
          setPage(1);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err?.message || 'Search request failed');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const totalCount =
    results.channels.length +
    results.movies.length +
    results.drama.length +
    results.series.length +
    results.sports.length;

  const visibleChannels = useMemo(
    () => (tab === 'all' || tab === 'channels' ? results.channels : []),
    [results.channels, tab]
  );

  const combinedVod = useMemo(
    () => [
      ...(tab === 'all' || tab === 'movies' ? results.movies : []),
      ...(tab === 'all' || tab === 'drama' ? results.drama : []),
      ...(tab === 'all' || tab === 'series' ? results.series : []),
      ...(tab === 'all' || tab === 'sports' ? results.sports : []),
    ],
    [results.movies, results.drama, results.series, results.sports, tab]
  );

  const combinedEntries = useMemo(
    () => [
      ...visibleChannels.map((ch) => ({ kind: 'channel' as const, ch })),
      ...combinedVod.map((item) => ({ kind: 'vod' as const, item })),
    ],
    [visibleChannels, combinedVod]
  );

  const totalPages = Math.max(1, Math.ceil(combinedEntries.length / SEARCH_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedEntries = combinedEntries.slice(
    (safePage - 1) * SEARCH_PAGE_SIZE,
    safePage * SEARCH_PAGE_SIZE
  );
  const pagedChannels = pagedEntries
    .filter((e): e is { kind: 'channel'; ch: LiveChannel } => e.kind === 'channel')
    .map((e) => e.ch);
  const pagedVod = pagedEntries
    .filter((e): e is { kind: 'vod'; item: ContentItem } => e.kind === 'vod')
    .map((e) => e.item);

  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-white">Search Catalog</h1>
        <div className="relative mt-4">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search Live TV channels, movies, drama, web series, sports..."
            autoFocus
            className="h-12 w-full rounded-full border border-white/15 bg-[#12141C] pl-12 pr-5 text-base text-white placeholder-slate-400 focus:border-pink-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        {[
          { key: 'all', label: `All (${totalCount})` },
          { key: 'channels', label: `Live TV (${results.channels.length})` },
          { key: 'movies', label: `Movies (${results.movies.length})` },
          { key: 'drama', label: `Drama (${results.drama.length})` },
          { key: 'series', label: `Web Series (${results.series.length})` },
          { key: 'sports', label: `Sports (${results.sports.length})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key as SearchTab);
              setPage(1);
            }}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.key
                ? 'bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-white'
                : 'border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center text-sm text-red-300">
          <AlertCircle className="mx-auto mb-2 h-6 w-6" />
          {error}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer aspect-video rounded-lg" />
          ))}
        </div>
      ) : !query.trim() ? (
        <p className="text-sm text-slate-400">
          Start typing to search across Live TV channels, movies, dramas, web series, and sports.
        </p>
      ) : combinedEntries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#12141C] p-12 text-center">
          <p className="font-display text-lg font-semibold text-white">
            No matches for "{query.trim()}"
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Try a different channel name, title, category, director, or keyword.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {pagedChannels.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-white">
                  Live TV Channels ({visibleChannels.length})
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                {pagedChannels.map((ch) => (
                  <LiveChannelCard
                    key={ch.id}
                    channel={ch}
                    onSelect={(selected) =>
                      navigate(`/live-tv?channel=${encodeURIComponent(selected.slug)}`)
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {pagedVod.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-lg font-bold text-white">
                Matching Titles ({combinedVod.length})
              </h2>
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
                {pagedVod.map((item) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    variant="landscape"
                    onSelect={(slug) => navigate(`/title/${slug}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-400">
              <span>
                Showing {(safePage - 1) * SEARCH_PAGE_SIZE + 1}–
                {Math.min(safePage * SEARCH_PAGE_SIZE, combinedEntries.length)} of{' '}
                {combinedEntries.length} results
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 text-white hover:bg-white/10 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Prev</span>
                </button>
                <span className="font-mono-num px-2 text-slate-300">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 text-white hover:bg-white/10 disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
