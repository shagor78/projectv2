import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ChevronRight, ChevronUp, Heart, Radio, Search, Signal, Tv } from 'lucide-react';
import { HeroSlider } from '../components/HeroSlider.tsx';
import { HlsPlayer } from '../components/HlsPlayer.tsx';
import { LiveChannelCard } from '../components/LiveChannelCard.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import { ChannelCategory, HeroSlide, LiveChannel, PageHeroSlider } from '../types/platform.ts';
import { matchesClientSearch } from '../utils/search.ts';

interface LiveTvPageProps {
  initialChannelSlug?: string;
  navigate: (path: string) => void;
}

interface LiveTvSectionGroup {
  key: string;
  title: string;
  channels: LiveChannel[];
  initialLimit: number;
}

const ORDERED_CATEGORY_SPECS: Array<{
  key: string;
  title: string;
  initialLimit: number;
  match: (ch: LiveChannel, catMap: Map<string, ChannelCategory>) => boolean;
}> = [
  {
    key: 'all-channels',
    title: 'All Channels',
    initialLimit: 20,
    match: () => true,
  },
  {
    key: 'bangla-channels',
    title: 'Bangla Channels',
    initialLimit: 10,
    match: (ch) =>
      (ch.language || '').toLowerCase() === 'bangla' ||
      ch.categories.some((c) => c.slug === 'bangla-channels'),
  },
  {
    key: 'hindi-channels',
    title: 'Hindi Channels',
    initialLimit: 10,
    match: (ch) =>
      (ch.language || '').toLowerCase() === 'hindi' ||
      ch.categories.some((c) => c.slug === 'hindi-channels'),
  },
  {
    key: 'news-channels',
    title: 'News Channels',
    initialLimit: 10,
    match: (ch) =>
      ch.categories.some((c) => c.slug === 'news-channels' || c.slug === 'news-world') ||
      /\bnews\b/i.test(ch.name),
  },
  {
    key: 'english-channels',
    title: 'English Channels',
    initialLimit: 10,
    match: (ch) =>
      (ch.language || '').toLowerCase().includes('english') ||
      ch.categories.some((c) => c.slug === 'english-channels'),
  },
  {
    key: 'kids-channels',
    title: 'Kids Channels',
    initialLimit: 10,
    match: (ch) =>
      ch.categories.some((c) => c.slug === 'kids-channels' || c.slug === 'kids-family') ||
      /\b(kids|toon|junior)\b/i.test(ch.name),
  },
  {
    key: 'religious-channels',
    title: 'Religion Channels',
    initialLimit: 10,
    match: (ch) =>
      ch.categories.some((c) => c.slug === 'religious-channels') ||
      /\b(peace|religion|heritage|quran|islamic|gospel)\b/i.test(ch.name),
  },
];

const EXPANDED_BATCH_SIZE = 60;

export function LiveTvPage({ initialChannelSlug, navigate }: LiveTvPageProps) {
  const { user } = useAuth();
  const [heroSlider, setHeroSlider] = useState<PageHeroSlider | null>(null);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [expandedLimit, setExpandedLimit] = useState<number>(EXPANDED_BATCH_SIZE);
  const [channelSearch, setChannelSearch] = useState('');
  const [searchLimit, setSearchLimit] = useState<number>(EXPANDED_BATCH_SIZE);
  const [activeChannelSlug, setActiveChannelSlug] = useState<string>(initialChannelSlug || '');
  const [favoriteChannelIds, setFavoriteChannelIds] = useState<Set<number>>(new Set());
  const [showTheater, setShowTheater] = useState(Boolean(initialChannelSlug));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Smart TV numeric remote channel dialer state
  const [remoteDigits, setRemoteDigits] = useState('');
  const [remoteNotice, setRemoteNotice] = useState<string | null>(null);
  const remoteDigitsRef = useRef('');
  const remoteTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const playerSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch('/api/channels'),
      apiFetch('/api/hero-sliders/live_tv').catch(() => ({ slider: null, slides: [] })),
    ])
      .then(([chData, heroData]) => {
        if (cancelled) return;
        setCategories(chData.categories || []);
        const list: LiveChannel[] = [...(chData.channels || [])].sort(
          (a, b) => a.channelNumber - b.channelNumber
        );
        setChannels(list);
        setHeroSlider(heroData.slider || null);
        setHeroSlides(heroData.slides || []);

        if (initialChannelSlug && list.some((c) => c.slug === initialChannelSlug)) {
          setActiveChannelSlug(initialChannelSlug);
          setShowTheater(true);
        } else if (list.length > 0 && !activeChannelSlug) {
          setActiveChannelSlug(list[0].slug);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load Live TV channels');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChannelSlug, reloadNonce]);

  useEffect(() => {
    if (!user) {
      setFavoriteChannelIds(new Set());
      return;
    }
    apiFetch('/api/favorites')
      .then((data) => {
        const ids = new Set<number>(
          (data.favorites || [])
            .filter((f: any) => f.favorite?.channelId)
            .map((f: any) => Number(f.favorite.channelId))
        );
        setFavoriteChannelIds(ids);
      })
      .catch(() => {});
  }, [user?.id]);

  const catBySlug = useMemo(() => {
    return new Map(categories.map((c) => [c.slug, c]));
  }, [categories]);

  const verticalSections = useMemo<LiveTvSectionGroup[]>(() => {
    return ORDERED_CATEGORY_SPECS.map((spec) => ({
      key: spec.key,
      title: spec.title,
      initialLimit: spec.initialLimit,
      channels: channels.filter((ch) => spec.match(ch, catBySlug)),
    }));
  }, [channels, catBySlug]);

  const expandedGroup = useMemo(
    () => (expandedGroupKey ? verticalSections.find((g) => g.key === expandedGroupKey) || null : null),
    [expandedGroupKey, verticalSections]
  );

  const searchedChannels = useMemo(() => {
    if (!channelSearch.trim()) return [];
    return channels.filter((ch) =>
      matchesClientSearch(channelSearch, ch.name, [
        ch.slug,
        ch.description,
        ch.language,
        ch.country,
        ch.channelNumber,
        ...(ch.categories || []).flatMap((c) => [c.name, c.slug]),
        ...(ch.streams || []).map((s) => s.label),
      ])
    );
  }, [channels, channelSearch]);

  const activeChannel =
    channels.find((c) => c.slug === activeChannelSlug) || channels[0] || null;

  const activeIndex = activeChannel
    ? channels.findIndex((c) => c.id === activeChannel.id)
    : -1;

  const handleSelectChannel = useCallback((ch: LiveChannel) => {
    setActiveChannelSlug(ch.slug);
    setShowTheater(true);
    setTimeout(() => {
      playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }, []);

  const openExpandedCategory = (key: string) => {
    setExpandedGroupKey(key);
    setExpandedLimit(EXPANDED_BATCH_SIZE);
    setTimeout(() => {
      playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  const showTimedRemoteNotice = useCallback((msg: string) => {
    setRemoteNotice(msg);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      setRemoteNotice(null);
    }, 1800);
  }, []);

  const commitRemoteDigits = useCallback(
    (digitsStr: string) => {
      if (!digitsStr) return;
      const targetNum = Number(digitsStr);
      const matched = channels.find((c) => c.channelNumber === targetNum);
      remoteDigitsRef.current = '';
      setRemoteDigits('');

      if (matched) {
        handleSelectChannel(matched);
        showTimedRemoteNotice(`CH ${matched.channelNumber} · ${matched.name}`);
      } else {
        showTimedRemoteNotice(`Channel #${digitsStr} not found`);
      }
    },
    [channels, handleSelectChannel, showTimedRemoteNotice]
  );

  // Smart TV remote numeric (0-9) and ChannelUp/ChannelDown key listener
  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        const nextDigits = (remoteDigitsRef.current + e.key).slice(0, 4);
        remoteDigitsRef.current = nextDigits;
        setRemoteDigits(nextDigits);
        setRemoteNotice(null);

        if (remoteTimerRef.current) window.clearTimeout(remoteTimerRef.current);

        const exact = channels.find((c) => c.channelNumber === Number(nextDigits));
        const hasLongerPrefix = channels.some(
          (c) => String(c.channelNumber).startsWith(nextDigits) && String(c.channelNumber) !== nextDigits
        );

        const delay = exact && !hasLongerPrefix ? 350 : 950;
        remoteTimerRef.current = window.setTimeout(() => {
          commitRemoteDigits(remoteDigitsRef.current);
        }, delay);
        return;
      }

      if (remoteDigitsRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          if (remoteTimerRef.current) window.clearTimeout(remoteTimerRef.current);
          commitRemoteDigits(remoteDigitsRef.current);
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          e.stopPropagation();
          const trimmed = remoteDigitsRef.current.slice(0, -1);
          remoteDigitsRef.current = trimmed;
          setRemoteDigits(trimmed);
          if (remoteTimerRef.current) window.clearTimeout(remoteTimerRef.current);
          if (trimmed) {
            remoteTimerRef.current = window.setTimeout(() => {
              commitRemoteDigits(remoteDigitsRef.current);
            }, 950);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          if (remoteTimerRef.current) window.clearTimeout(remoteTimerRef.current);
          remoteDigitsRef.current = '';
          setRemoteDigits('');
          return;
        }
      }

      if (e.key === 'ChannelUp' || e.key === 'PageUp') {
        if (channels.length > 0) {
          e.preventDefault();
          const nextIdx = activeIndex >= 0 ? (activeIndex + 1) % channels.length : 0;
          handleSelectChannel(channels[nextIdx]);
        }
      } else if (e.key === 'ChannelDown' || e.key === 'PageDown') {
        if (channels.length > 0) {
          e.preventDefault();
          const prevIdx =
            activeIndex >= 0 ? (activeIndex - 1 + channels.length) % channels.length : 0;
          handleSelectChannel(channels[prevIdx]);
        }
      }
    };

    window.addEventListener('keydown', onWindowKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onWindowKeyDown, { capture: true });
      if (remoteTimerRef.current) window.clearTimeout(remoteTimerRef.current);
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, [channels, activeIndex, commitRemoteDigits, handleSelectChannel]);

  const remoteMatchedPreview = useMemo(() => {
    if (!remoteDigits) return null;
    return channels.find((c) => c.channelNumber === Number(remoteDigits)) || null;
  }, [channels, remoteDigits]);

  const handleHeroWatchLive = (channelSlug: string) => {
    const found = channels.find((c) => c.slug === channelSlug);
    if (found) {
      handleSelectChannel(found);
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

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
        <p className="mt-3 font-display text-xl font-bold text-white">Live TV Unavailable</p>
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
      {(remoteDigits || remoteNotice) && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-6 top-20 z-50 min-w-[210px] rounded-2xl border border-pink-500/40 bg-[#0D1018]/95 px-4 py-3 shadow-2xl backdrop-blur-md"
        >
          {remoteDigits ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-400">
                  Remote Channel Tune
                </span>
                <span className="font-mono-num text-xs text-slate-400">Enter / Wait</span>
              </div>
              <p className="font-mono-num text-2xl font-extrabold tracking-wider text-white">
                CH {remoteDigits}
              </p>
              <p className="truncate text-xs text-slate-300">
                {remoteMatchedPreview
                  ? `${remoteMatchedPreview.name} · ${remoteMatchedPreview.language}`
                  : 'Searching channel number...'}
              </p>
            </div>
          ) : (
            <p className="font-mono-num text-sm font-bold text-white">{remoteNotice}</p>
          )}
        </div>
      )}

      {heroSlides.length > 0 && (
        <HeroSlider
          slides={heroSlides}
          slider={heroSlider}
          navigate={navigate}
          onWatchLiveChannel={handleHeroWatchLive}
          heightClass="h-[58vh] min-h-[420px] max-h-[600px]"
        />
      )}

      <div
        ref={playerSectionRef}
        className={`w-full px-4 sm:px-6 lg:px-8 ${
          heroSlides.length > 0 ? 'pt-6' : 'pt-24'
        }`}
      >
        {!loading && activeChannel && showTheater && (
          <section className="mb-10 rounded-2xl border border-white/10 bg-[#11131A] p-4 sm:p-5">
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <HlsPlayer
                  title={activeChannel.name}
                  subtitle={`CH ${activeChannel.channelNumber} · ${activeChannel.country} · ${activeChannel.language}`}
                  isLive
                  channelId={activeChannel.id}
                  streams={activeChannel.streams}
                  remoteOsd={{
                    digits: remoteDigits,
                    notice: remoteNotice,
                    previewName: remoteMatchedPreview
                      ? `${remoteMatchedPreview.name} · ${remoteMatchedPreview.language}`
                      : null,
                  }}
                  hasPrevious={activeIndex > 0}
                  hasNext={activeIndex >= 0 && activeIndex < channels.length - 1}
                  onBack={() => setShowTheater(false)}
                  onPrevious={() => {
                    if (activeIndex > 0) {
                      setActiveChannelSlug(channels[activeIndex - 1].slug);
                    }
                  }}
                  onNext={() => {
                    if (activeIndex >= 0 && activeIndex < channels.length - 1) {
                      setActiveChannelSlug(channels[activeIndex + 1].slug);
                    }
                  }}
                />
              </div>

              <div className="flex flex-col justify-between space-y-4 lg:col-span-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pink-400">
                      <Radio className="h-3.5 w-3.5" />
                      <span>Now Playing Live</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTheater(false)}
                      className="tv-focusable inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:text-white"
                    >
                      <span>Minimize</span>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white p-1.5 ring-2 ring-pink-500/70">
                      <img
                        src={activeChannel.logoUrl}
                        alt={activeChannel.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono-num text-xs font-semibold text-slate-400">
                        CH {activeChannel.channelNumber} · {activeChannel.language} · {activeChannel.country}
                      </p>
                      <h2 className="truncate font-display text-xl font-bold text-white">
                        {activeChannel.name}
                      </h2>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-slate-300">
                    {activeChannel.description}
                  </p>

                  <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      {activeChannel.streams.length > 0 ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
                            <Signal className="h-3.5 w-3.5" />
                            <span>Multi-Source Failover Active</span>
                          </span>
                          <span className="font-mono-num text-slate-400">
                            {activeChannel.streams.length} HLS Sources
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
                    <p className="text-[11px] text-slate-400">
                      Press 0–9 on Smart TV remote or keyboard to tune by channel number, Arrow Left/Right to switch, and F for fullscreen.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={activeIndex <= 0}
                    onClick={() => {
                      if (activeIndex > 0) setActiveChannelSlug(channels[activeIndex - 1].slug);
                    }}
                    className="tv-focusable h-10 flex-1 rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                  >
                    Prev Channel
                  </button>
                  <button
                    type="button"
                    disabled={activeIndex < 0 || activeIndex >= channels.length - 1}
                    onClick={() => {
                      if (activeIndex >= 0 && activeIndex < channels.length - 1) {
                        setActiveChannelSlug(channels[activeIndex + 1].slug);
                      }
                    }}
                    className="tv-focusable h-10 flex-1 rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                  >
                    Next Channel
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavoriteChannel(activeChannel.id)}
                    aria-label="Toggle favorite channel"
                    className={`tv-focusable inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                      favoriteChannelIds.has(activeChannel.id)
                        ? 'border-pink-500/60 bg-pink-500/20 text-pink-300'
                        : 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        favoriteChannelIds.has(activeChannel.id) ? 'fill-current' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-5 w-[3px] rounded-full bg-gradient-to-b from-[#9333EA] to-[#EC4899]" />
            <h1 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
              Live TV Channels
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={channelSearch}
                onChange={(e) => {
                  setChannelSearch(e.target.value);
                  setSearchLimit(EXPANDED_BATCH_SIZE);
                }}
                placeholder="Search channels, category, language..."
                className="tv-focusable h-9 w-full rounded-full border border-white/15 bg-[#12141C] pl-9 pr-4 text-xs text-white placeholder-slate-400 focus:border-pink-400 focus:outline-none"
              />
            </div>
            <span className="hidden text-xs text-slate-400 lg:inline">
              Press 0–9 on Smart TV remote to tune channel number
            </span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-10">
            {Array.from({ length: 3 }).map((_, rowIdx) => (
              <div key={rowIdx} className="space-y-4">
                <div className="skeleton-shimmer h-6 w-44 rounded" />
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center space-y-2">
                      <div className="skeleton-shimmer aspect-square w-full max-w-[104px] rounded-full" />
                      <div className="skeleton-shimmer h-3 w-16 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#12141C] py-16 text-center">
            <Tv className="mx-auto h-10 w-10 text-slate-500" />
            <p className="mt-3 font-display text-lg font-semibold text-white">
              No Live Channels Published
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Publish channels in the Admin Console to make them available here.
            </p>
          </div>
        ) : channelSearch.trim() ? (
          <section>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-gradient-to-b from-[#9333EA] to-[#EC4899]" />
                <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
                  Matching Channels
                </h2>
                <span className="font-mono-num text-xs text-slate-400">
                  ({searchedChannels.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setChannelSearch('');
                  setSearchLimit(EXPANDED_BATCH_SIZE);
                }}
                className="text-xs font-medium text-pink-400 hover:text-pink-300"
              >
                Clear Search
              </button>
            </div>

            {searchedChannels.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#12141C] py-12 text-center text-sm text-slate-400">
                No Live TV channels match "{channelSearch.trim()}". Try another channel name, category, language, or number.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                  {searchedChannels.slice(0, searchLimit).map((ch) => (
                    <LiveChannelCard
                      key={ch.id}
                      channel={ch}
                      isActive={activeChannel?.id === ch.id}
                      isFavorited={favoriteChannelIds.has(ch.id)}
                      onToggleFavorite={toggleFavoriteChannel}
                      onSelect={handleSelectChannel}
                    />
                  ))}
                </div>
                {searchedChannels.length > searchLimit && (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSearchLimit((prev) => prev + EXPANDED_BATCH_SIZE)}
                      className="tv-focusable rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-pink-500/20 hover:brightness-110 transition-all"
                    >
                      Load {Math.min(EXPANDED_BATCH_SIZE, searchedChannels.length - searchLimit)} More Channels
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchLimit(searchedChannels.length)}
                      className="tv-focusable rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
                    >
                      Show All ({searchedChannels.length - searchLimit} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        ) : expandedGroup ? (
          <section>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setExpandedGroupKey(null)}
                  className="tv-focusable inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-pink-500/50 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>All Categories</span>
                </button>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-gradient-to-b from-[#9333EA] to-[#EC4899]" />
                  <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
                    {expandedGroup.title}
                  </h2>
                  <span className="font-mono-num text-xs text-slate-400">
                    ({expandedGroup.channels.length})
                  </span>
                </div>
              </div>
            </div>

            {expandedGroup.channels.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#12141C] py-12 text-center text-sm text-slate-400">
                No channels assigned to {expandedGroup.title} yet.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                  {expandedGroup.channels.slice(0, expandedLimit).map((ch) => (
                    <LiveChannelCard
                      key={ch.id}
                      channel={ch}
                      isActive={activeChannel?.id === ch.id}
                      isFavorited={favoriteChannelIds.has(ch.id)}
                      onToggleFavorite={toggleFavoriteChannel}
                      onSelect={handleSelectChannel}
                    />
                  ))}
                </div>

                {expandedGroup.channels.length > expandedLimit && (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedLimit((prev) => prev + EXPANDED_BATCH_SIZE)}
                      className="tv-focusable rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-pink-500/20 hover:brightness-110 transition-all"
                    >
                      Load {Math.min(EXPANDED_BATCH_SIZE, expandedGroup.channels.length - expandedLimit)} More Channels
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedLimit(expandedGroup.channels.length)}
                      className="tv-focusable rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
                    >
                      Show All ({expandedGroup.channels.length - expandedLimit} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        ) : (
          <div className="space-y-10">
            {verticalSections.map((group) => {
              const previewList = group.channels.slice(0, group.initialLimit);
              return (
                <section key={group.key}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-gradient-to-b from-[#9333EA] to-[#EC4899]" />
                      <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
                        {group.title}
                      </h2>
                      <span className="font-mono-num text-xs text-slate-400">
                        ({group.channels.length})
                      </span>
                    </div>

                    {group.channels.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openExpandedCategory(group.key)}
                        className="tv-focusable inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3.5 py-1 text-xs font-semibold text-slate-200 transition-colors hover:border-pink-500/50 hover:text-white"
                      >
                        <span>View All</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {previewList.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-[#12141C]/60 px-4 py-6 text-xs text-slate-400">
                      No channels in {group.title} yet. Assign channels to this category in the Admin Console.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                      {previewList.map((ch) => (
                        <LiveChannelCard
                          key={`${group.key}-${ch.id}`}
                          channel={ch}
                          isActive={activeChannel?.id === ch.id}
                          isFavorited={favoriteChannelIds.has(ch.id)}
                          onToggleFavorite={toggleFavoriteChannel}
                          onSelect={handleSelectChannel}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
