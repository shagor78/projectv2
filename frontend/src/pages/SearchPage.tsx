import React, { useEffect, useState } from 'react';
import { AlertCircle, Search as SearchIcon } from 'lucide-react';
import { PosterCard } from '../components/PosterCard.tsx';
import { apiFetch } from '../services/api.ts';
import { ContentItem } from '../types/platform.ts';

interface SearchPageProps {
  initialQuery: string;
  navigate: (path: string) => void;
}

export function SearchPage({ initialQuery, navigate }: SearchPageProps) {
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<'all' | 'movies' | 'drama' | 'series' | 'sports'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    movies: ContentItem[];
    drama: ContentItem[];
    series: ContentItem[];
    sports: ContentItem[];
  }>({ movies: [], drama: [], series: [], sports: [] });

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults({ movies: [], drama: [], series: [], sports: [] });
      setError(null);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      apiFetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((data) => {
          setResults({
            movies: data.movies || [],
            drama: data.drama || [],
            series: data.series || [],
            sports: data.sports || [],
          });
        })
        .catch((err) => {
          setError(err?.message || 'Search request failed');
        })
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  const totalCount =
    results.movies.length +
    results.drama.length +
    results.series.length +
    results.sports.length;

  const combinedVod = [
    ...(tab === 'all' || tab === 'movies' ? results.movies : []),
    ...(tab === 'all' || tab === 'drama' ? results.drama : []),
    ...(tab === 'all' || tab === 'series' ? results.series : []),
    ...(tab === 'all' || tab === 'sports' ? results.sports : []),
  ];

  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-white">Search Catalog</h1>
        <div className="relative mt-4">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, drama, web series, sports..."
            autoFocus
            className="h-12 w-full rounded-full border border-white/15 bg-[#12141C] pl-12 pr-5 text-base text-white placeholder-slate-400 focus:border-pink-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        {[
          { key: 'all', label: `All (${totalCount})` },
          { key: 'movies', label: `Movies (${results.movies.length})` },
          { key: 'drama', label: `Drama (${results.drama.length})` },
          { key: 'series', label: `Web Series (${results.series.length})` },
          { key: 'sports', label: `Sports (${results.sports.length})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key as any)}
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
          Start typing to search across movies, dramas, web series, and sports.
        </p>
      ) : totalCount === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#12141C] p-12 text-center">
          <p className="font-display text-lg font-semibold text-white">No matches for "{query}"</p>
          <p className="mt-1 text-sm text-slate-400">
            Try a different keyword, title, or director.
          </p>
        </div>
      ) : (
        <section>
          <h2 className="mb-4 font-display text-lg font-bold text-white">Matching Titles</h2>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
            {combinedVod.map((item) => (
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
    </div>
  );
}
