import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronUp, Heart, Play, Radio, Signal, Trophy } from 'lucide-react';
import { HeroSlider } from '../components/HeroSlider.tsx';
import { HlsPlayer } from '../components/HlsPlayer.tsx';
import { LiveChannelCard } from '../components/LiveChannelCard.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import { ContentItem, HeroSlide, LiveChannel, PageHeroSlider } from '../types/platform.ts';

interface SportsPageProps {
  navigate: (path: string) => void;
}

function isSportsChannel(ch: LiveChannel): boolean {
  const hasSportsCategory = (ch.categories || []).some(
    (c) =>
      c.slug === 'sports-channels' ||
      c.slug === 'sports-live' ||
      /sport/i.test(c.slug) ||
      /sport/i.test(c.name)
  );
  if (hasSportsCategory) return true;

  const hasSportsPlacement = (ch.placements || []).some(
    (p) => p === 'sports_bar' || p === 'sports_spotlight' || /sport/i.test(p)
  );
  if (hasSportsPlacement) return true;

  return /\b(sport|sports|cricket|football|soccer|espn|tsports|gtv|ten\s*\d*|eurosport|bein|arena|motorsport)\b/i.test(
    `${ch.name} ${ch.description || ''}`
  );
}

type ActiveStreamState =
  | { kind: 'channel'; channel: LiveChannel }
  | { kind: 'match'; match: ContentItem }
  | null;

export function SportsPage({ navigate }: SportsPageProps) {
  const { user } = useAuth();
  const [heroSlider, setHeroSlider] = useState<PageHeroSlider | null>(null);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [sportsChannels, setSportsChannels] = useState<LiveChannel[]>([]);
  const [liveMatches, setLiveMatches] = useState<ContentItem[]>([]);
  const [activeStream, setActiveStream] = useState<ActiveStreamState>(null);
  const [favoriteChannelIds, setFavoriteChannelIds] = useState<Set<number>>(new Set());
  const [favoriteContentIds, setFavoriteContentIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch('/api/channels?includeHidden=true'),
      apiFetch('/api/contents?type=sports'),
      apiFetch('/api/hero-sliders/sports').catch(() => ({ slider: null, slides: [] })),
    ])
      .then(([channelRes, contentRes, heroRes]) => {
        if (cancelled) return;
        const allChannels: LiveChannel[] = channelRes.channels || [];
        const matchedChannels = allChannels
          .filter(isSportsChannel)
          .sort((a, b) => a.channelNumber - b.channelNumber);
        setSportsChannels(matchedChannels);
        setLiveMatches(contentRes.items || []);
        setHeroSlider(heroRes.slider || null);
        setHeroSlides(heroRes.slides || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load sports section');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  useEffect(() => {
    if (!user) {
      setFavoriteChannelIds(new Set());
      setFavoriteContentIds(new Set());
      return;
    }
    apiFetch('/api/favorites')
      .then((data) => {
        const chIds = new Set<number>();
        const coIds = new Set<number>();
        for (const row of data.favorites || []) {
          if (row.favorite?.channelId) chIds.add(Number(row.favorite.channelId));
          if (row.favorite?.contentId) coIds.add(Number(row.favorite.contentId));
        }
        setFavoriteChannelIds(chIds);
        setFavoriteContentIds(coIds);
      })
      .catch(() => {});
  }, [user?.id]);

  const effectiveHeroSlides = useMemo<HeroSlide[]>(() => {
    if (heroSlides.length > 0) return heroSlides;
    return liveMatches.slice(0, 4).map((item, idx) => ({
      id: item.id,
      pageKey: 'sports',
      title: item.title,
      subtitle: item.synopsis,
      badgeText: 'Live Sports',
      categoryLabel: 'Live Sports',
      languageLabel: item.language,
      imageUrl: item.backdropUrl || item.posterUrl,
      ctaLabel: 'Watch Live',
      ctaLink: `/title/${item.slug}`,
      secondaryCtaLabel: '',
      secondaryCtaLink: '',
      contentId: item.id,
      channelId: null,
      sortOrder: idx + 1,
      isActive: true,
    }));
  }, [heroSlides, liveMatches]);

  const scrollToPlayer = useCallback(() => {
    setTimeout(() => {
      playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }, []);

  const playChannel = useCallback(
    (ch: LiveChannel) => {
      setActiveStream({ kind: 'channel', channel: ch });
      scrollToPlayer();
    },
    [scrollToPlayer]
  );

  const playMatch = useCallback(
    (match: ContentItem) => {
      if (match.hlsUrl) {
        setActiveStream({ kind: 'match', match });
        scrollToPlayer();
      } else {
        navigate(`/title/${match.slug}`);
      }
    },
    [navigate, scrollToPlayer]
  );

  const handleHeroWatchLiveChannel = (channelSlug: string) => {
    const found = sportsChannels.find((c) => c.slug === channelSlug);
    if (found) {
      playChannel(found);
    } else {
      navigate(`/live-tv?channel=${channelSlug}`);
    }
  };

  const toggleFavoriteChannel = async (channelId: number) => {
    if (!user) {
      navigate('/login');
      return;
    }
    const res = await apiFetch('/api/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({ channelId }),
    });
    setFavoriteChannelIds((prev) => {
      const next = new Set(prev);
      if (res.favorited) next.add(channelId);
      else next.delete(channelId);
      return next;
    });
  };

  const toggleFavoriteMatch = async (contentId: number) => {
    if (!user) {
      navigate('/login');
      return;
    }
    const res = await apiFetch('/api/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({ contentId }),
    });
    setFavoriteContentIds((prev) => {
      const next = new Set(prev);
      if (res.favorited) next.add(contentId);
      else next.delete(contentId);
      return next;
    });
  };

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
        <p className="mt-3 font-display text-xl font-bold text-white">Failed to Load Sports</p>
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

  const activeChannelIdx =
    activeStream?.kind === 'channel'
      ? sportsChannels.findIndex((c) => c.id === activeStream.channel.id)
      : -1;

  const activeMatchIdx =
    activeStream?.kind === 'match'
      ? liveMatches.findIndex((m) => m.id === activeStream.match.id)
      : -1;

  return (
    <div className="pb-16">
      {!loading && effectiveHeroSlides.length > 0 && (
        <HeroSlider
          slides={effectiveHeroSlides}
          slider={heroSlider}
          navigate={(path) => {
            if (path.startsWith('/title/')) {
              const slug = decodeURIComponent(path.slice('/title/'.length));
              const matched = liveMatches.find((m) => m.slug === slug);
              if (matched) {
                playMatch(matched);
                return;
              }
            }
            navigate(path);
          }}
          onWatchLiveChannel={handleHeroWatchLiveChannel}
          heightClass="h-[62vh] min-h-[420px] max-h-[640px]"
        />
      )}

      <div
        ref={playerRef}
        className={`w-full space-y-12 px-4 sm:px-6 lg:px-8 ${
          !loading && effectiveHeroSlides.length > 0 ? 'pt-8' : 'pt-24'
        }`}
      >
        {activeStream && (
          <section className="rounded-2xl border border-white/10 bg-[#11131A] p-4 sm:p-5">
            {activeStream.kind === 'channel' ? (
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <HlsPlayer
                    title={activeStream.channel.name}
                    subtitle={`CH ${activeStream.channel.channelNumber} · ${activeStream.channel.country} · ${activeStream.channel.language}`}
                    isLive
                    channelId={activeStream.channel.id}
                    streams={activeStream.channel.streams}
                    hasPrevious={activeChannelIdx > 0}
                    hasNext={activeChannelIdx >= 0 && activeChannelIdx < sportsChannels.length - 1}
                    onBack={() => setActiveStream(null)}
                    onPrevious={() => {
                      if (activeChannelIdx > 0) {
                        playChannel(sportsChannels[activeChannelIdx - 1]);
                      }
                    }}
                    onNext={() => {
                      if (activeChannelIdx >= 0 && activeChannelIdx < sportsChannels.length - 1) {
                        playChannel(sportsChannels[activeChannelIdx + 1]);
                      }
                    }}
                  />
                </div>

                <div className="flex flex-col justify-between space-y-4 lg:col-span-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pink-400">
                        <Radio className="h-3.5 w-3.5" />
                        <span>Live Sports Channel</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveStream(null)}
                        className="tv-focusable inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:text-white"
                      >
                        <span>Minimize</span>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3.5">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white p-1.5 ring-2 ring-pink-500/70">
                        <img
                          src={activeStream.channel.logoUrl}
                          alt={activeStream.channel.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono-num text-xs font-semibold text-slate-400">
                          CH {activeStream.channel.channelNumber} · {activeStream.channel.language}
                        </p>
                        <h2 className="truncate font-display text-xl font-bold text-white">
                          {activeStream.channel.name}
                        </h2>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-slate-300">
                      {activeStream.channel.description}
                    </p>

                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-slate-300">
                      {activeStream.channel.streams.length > 0 ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
                            <Signal className="h-3.5 w-3.5" />
                            <span>Multi-Source Failover Active</span>
                          </span>
                          <span className="font-mono-num text-slate-400">
                            {activeStream.channel.streams.length} HLS Sources
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1.5 font-medium text-amber-400">
                            <Signal className="h-3.5 w-3.5" />
                            <span>Stream URL Pending Configuration</span>
                          </span>
                          <span className="font-mono-num text-slate-400">
                            0 HLS Sources
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={activeChannelIdx <= 0}
                      onClick={() => {
                        if (activeChannelIdx > 0) playChannel(sportsChannels[activeChannelIdx - 1]);
                      }}
                      className="tv-focusable h-10 flex-1 rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                    >
                      Prev Channel
                    </button>
                    <button
                      type="button"
                      disabled={activeChannelIdx < 0 || activeChannelIdx >= sportsChannels.length - 1}
                      onClick={() => {
                        if (activeChannelIdx >= 0 && activeChannelIdx < sportsChannels.length - 1) {
                          playChannel(sportsChannels[activeChannelIdx + 1]);
                        }
                      }}
                      className="tv-focusable h-10 flex-1 rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                    >
                      Next Channel
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavoriteChannel(activeStream.channel.id)}
                      aria-label="Toggle favorite channel"
                      className={`tv-focusable inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                        favoriteChannelIds.has(activeStream.channel.id)
                          ? 'border-pink-500/60 bg-pink-500/20 text-pink-300'
                          : 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          favoriteChannelIds.has(activeStream.channel.id) ? 'fill-current' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <HlsPlayer
                    title={activeStream.match.title}
                    subtitle={`Live Sports · ${activeStream.match.language} · ${activeStream.match.releaseYear}`}
                    posterUrl={activeStream.match.backdropUrl || activeStream.match.posterUrl}
                    hlsUrl={activeStream.match.hlsUrl}
                    isLive
                    contentId={activeStream.match.id}
                    hasPrevious={activeMatchIdx > 0}
                    hasNext={activeMatchIdx >= 0 && activeMatchIdx < liveMatches.length - 1}
                    onBack={() => setActiveStream(null)}
                    onPrevious={() => {
                      if (activeMatchIdx > 0) playMatch(liveMatches[activeMatchIdx - 1]);
                    }}
                    onNext={() => {
                      if (activeMatchIdx >= 0 && activeMatchIdx < liveMatches.length - 1) {
                        playMatch(liveMatches[activeMatchIdx + 1]);
                      }
                    }}
                  />
                </div>

                <div className="flex flex-col justify-between space-y-4 lg:col-span-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-400">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                        <span>Live Sports Match</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveStream(null)}
                        className="tv-focusable inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:text-white"
                      >
                        <span>Minimize</span>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <h2 className="font-display text-xl font-bold text-white">
                      {activeStream.match.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                      <span>{activeStream.match.releaseYear}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeStream.match.language}</span>
                      {activeStream.match.rating && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="rounded border border-white/20 px-1.5 py-0.5 text-[10px]">
                            {activeStream.match.rating}
                          </span>
                        </>
                      )}
                    </div>

                    {activeStream.match.synopsis && (
                      <p className="text-sm leading-relaxed text-slate-300">
                        {activeStream.match.synopsis}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={activeMatchIdx <= 0}
                      onClick={() => {
                        if (activeMatchIdx > 0) playMatch(liveMatches[activeMatchIdx - 1]);
                      }}
                      className="tv-focusable h-10 flex-1 rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                    >
                      Prev Match
                    </button>
                    <button
                      type="button"
                      disabled={activeMatchIdx < 0 || activeMatchIdx >= liveMatches.length - 1}
                      onClick={() => {
                        if (activeMatchIdx >= 0 && activeMatchIdx < liveMatches.length - 1) {
                          playMatch(liveMatches[activeMatchIdx + 1]);
                        }
                      }}
                      className="tv-focusable h-10 flex-1 rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                    >
                      Next Match
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavoriteMatch(activeStream.match.id)}
                      aria-label="Toggle favorite match"
                      className={`tv-focusable inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                        favoriteContentIds.has(activeStream.match.id)
                          ? 'border-pink-500/60 bg-pink-500/20 text-pink-300'
                          : 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          favoriteContentIds.has(activeStream.match.id) ? 'fill-current' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Category 1: All Sports Channel */}
        <section>
          <div className="mb-5 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-5 w-[3px] rounded-full bg-gradient-to-b from-[#9333EA] to-[#EC4899]"
            />
            <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
              All Sports Channel
            </h2>
            {!loading && (
              <span className="font-mono-num text-xs text-slate-400">
                ({sportsChannels.length})
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center space-y-2">
                  <div className="skeleton-shimmer aspect-square w-full max-w-[104px] rounded-full" />
                  <div className="skeleton-shimmer h-3 w-16 rounded" />
                </div>
              ))}
            </div>
          ) : sportsChannels.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#12141C]/60 px-4 py-8 text-center text-sm text-slate-400">
              No sports TV channels available yet.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
              {sportsChannels.map((ch) => (
                <LiveChannelCard
                  key={ch.id}
                  channel={ch}
                  isActive={activeStream?.kind === 'channel' && activeStream.channel.id === ch.id}
                  isFavorited={favoriteChannelIds.has(ch.id)}
                  onToggleFavorite={toggleFavoriteChannel}
                  onSelect={playChannel}
                />
              ))}
            </div>
          )}
        </section>

        {/* Category 2: Live Sports */}
        <section>
          <div className="mb-5 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-5 w-[3px] rounded-full bg-gradient-to-b from-[#9333EA] to-[#EC4899]"
            />
            <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
              Live Sports
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
              <span>LIVE</span>
            </span>
            {!loading && (
              <span className="font-mono-num text-xs text-slate-400">
                ({liveMatches.length})
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer aspect-video rounded-lg" />
              ))}
            </div>
          ) : liveMatches.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#12141C] py-14 text-center">
              <Trophy className="mx-auto h-10 w-10 text-slate-500" />
              <p className="mt-3 font-display text-lg font-semibold text-white">
                No Live Sports Matches Available
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Check back soon for upcoming live games and tournaments.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
              {liveMatches.map((match) => {
                const isActive =
                  activeStream?.kind === 'match' && activeStream.match.id === match.id;
                const imageSrc = match.backdropUrl || match.posterUrl;
                return (
                  <button
                    key={match.id}
                    type="button"
                    onClick={() => playMatch(match)}
                    title={`Watch ${match.title} live`}
                    className="tv-focusable group relative flex w-full flex-col rounded-lg text-left focus:outline-none"
                  >
                    <div
                      className={`relative aspect-video w-full overflow-hidden rounded-lg bg-[#141720] transition-all duration-200 ${
                        isActive
                          ? 'ring-2 ring-pink-500 shadow-[0_0_24px_rgba(236,72,153,0.35)]'
                          : 'ring-1 ring-white/10 group-hover:ring-pink-500/70'
                      }`}
                    >
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={match.title}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          className="block h-full w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#181C28] to-[#0B0D13]">
                          <Trophy className="h-8 w-8 text-slate-500" />
                        </div>
                      )}

                      <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded bg-rose-600/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        <span>{isActive ? 'PLAYING' : 'LIVE'}</span>
                      </span>

                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-950 shadow-xl">
                          <Play className="ml-0.5 h-5 w-5 fill-current" />
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 px-0.5">
                      <p
                        className={`line-clamp-1 text-sm font-semibold transition-colors ${
                          isActive
                            ? 'text-pink-400'
                            : 'text-slate-100 group-hover:text-pink-300'
                        }`}
                      >
                        {match.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-400">
                        <span>{match.releaseYear}</span>
                        <span aria-hidden="true">·</span>
                        <span>{match.language || 'English'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-rose-400 font-medium">Live Sports</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
