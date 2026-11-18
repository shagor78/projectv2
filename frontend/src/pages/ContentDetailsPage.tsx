import React, { useEffect, useMemo, useState } from 'react';
import { Check, Play, Plus } from 'lucide-react';
import { HlsPlayer } from '../components/HlsPlayer.tsx';
import { PosterCard } from '../components/PosterCard.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, formatDuration } from '../services/api.ts';
import { ContentItem, EpisodeItem, SeasonItem } from '../types/platform.ts';

interface ContentDetailsPageProps {
  slug: string;
  navigate: (path: string) => void;
}

export function ContentDetailsPage({ slug, navigate }: ContentDetailsPageProps) {
  const { user } = useAuth();
  const [content, setContent] = useState<ContentItem | null>(null);
  const [seasons, setSeasons] = useState<SeasonItem[]>([]);
  const [related, setRelated] = useState<ContentItem[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<EpisodeItem | null>(null);
  const [isPlayingInline, setIsPlayingInline] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setIsPlayingInline(false);
    setActiveEpisode(null);
    apiFetch(`/api/contents/${slug}`)
      .then((data) => {
        if (cancelled) return;
        setContent(data.content);
        const sList: SeasonItem[] = data.seasons || [];
        setSeasons(sList);
        if (sList.length > 0) {
          setSelectedSeasonId(sList[0].id);
          if (sList[0].episodes?.length > 0) {
            setActiveEpisode(sList[0].episodes[0]);
          }
        }
        setRelated(data.related || []);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Content not found');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, reloadNonce]);

  useEffect(() => {
    if (!user || !content) return;
    apiFetch('/api/favorites')
      .then((data) => {
        const found = (data.favorites || []).some(
          (f: any) => f.favorite.contentId === content.id
        );
        setIsFavorited(found);
      })
      .catch(() => {});

    apiFetch('/api/watch-history')
      .then((data) => {
        const match = (data.history || []).find(
          (h: any) => h.history.contentId === content.id && !h.history.completed
        );
        if (match) {
          setResumeSeconds(match.history.positionSeconds || 0);
        }
      })
      .catch(() => {});
  }, [user, content]);

  const allEpisodesFlat = useMemo(() => {
    return seasons.flatMap((s) => s.episodes || []);
  }, [seasons]);

  const currentEpisodeIdx = activeEpisode
    ? allEpisodesFlat.findIndex((e) => e.id === activeEpisode.id)
    : -1;

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) || seasons[0];

  const handleToggleFavorite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!content) return;
    const res = await apiFetch('/api/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({ contentId: content.id }),
    });
    setIsFavorited(Boolean(res.favorited));
  };

  if (loading) {
    return (
      <div className="space-y-8 pb-16">
        <div className="skeleton-shimmer h-[76vh] min-h-[500px] w-full" />
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer aspect-video rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="mx-auto max-w-lg px-4 py-32 text-center">
        <p className="font-display text-xl font-bold text-white">Title Not Available</p>
        <p className="mt-2 text-sm text-slate-400">{error}</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const playableHlsUrl = activeEpisode ? activeEpisode.hlsUrl : content.hlsUrl;
  const typeLabel =
    content.contentType === 'series'
      ? 'Web Series'
      : content.contentType.charAt(0).toUpperCase() + content.contentType.slice(1);

  return (
    <div className="pb-16">
      {isPlayingInline && playableHlsUrl ? (
        <div className="w-full px-4 pt-24 pb-8 sm:px-6 lg:px-8">
          <HlsPlayer
            title={
              activeEpisode
                ? `${content.title} — E${activeEpisode.episodeNumber}: ${activeEpisode.title}`
                : content.title
            }
            subtitle={
              activeEpisode
                ? `${selectedSeason?.title || 'Season'} · ${formatDuration(activeEpisode.durationMinutes)}`
                : `${typeLabel} · ${content.releaseYear}`
            }
            posterUrl={activeEpisode?.thumbnailUrl || content.backdropUrl}
            hlsUrl={playableHlsUrl}
            contentId={content.id}
            episodeId={activeEpisode?.id}
            initialTimeSeconds={resumeSeconds}
            hasPrevious={currentEpisodeIdx > 0}
            hasNext={currentEpisodeIdx >= 0 && currentEpisodeIdx < allEpisodesFlat.length - 1}
            onBack={() => setIsPlayingInline(false)}
            onPrevious={() => {
              if (currentEpisodeIdx > 0) {
                const prevEp = allEpisodesFlat[currentEpisodeIdx - 1];
                setActiveEpisode(prevEp);
                setSelectedSeasonId(prevEp.seasonId);
              }
            }}
            onNext={() => {
              if (currentEpisodeIdx >= 0 && currentEpisodeIdx < allEpisodesFlat.length - 1) {
                const nextEp = allEpisodesFlat[currentEpisodeIdx + 1];
                setActiveEpisode(nextEp);
                setSelectedSeasonId(nextEp.seasonId);
              }
            }}
            autoPlayNext
          />
        </div>
      ) : (
        <section className="relative h-[76vh] min-h-[500px] max-h-[760px] w-full overflow-hidden bg-[#0A0A0D]">
          <img
            src={content.backdropUrl || content.posterUrl}
            alt={content.title}
            referrerPolicy="no-referrer"
            className="block h-full w-full object-cover object-center"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0D]/90 via-[#0A0A0D]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0D] via-[#0A0A0D]/25 to-black/25" />

          <div className="absolute inset-x-0 bottom-0 pb-12 sm:pb-16">
            <div className="w-full px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl space-y-3">
                <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
                  {content.title}
                </h1>

                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-200">
                  <span>{typeLabel}</span>
                  {content.rating && (
                    <>
                      <span aria-hidden="true" className="text-slate-400">
                        •
                      </span>
                      <span className="rounded border border-white/25 px-1.5 py-0.5 text-xs">
                        {content.rating}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true" className="text-slate-400">
                    •
                  </span>
                  <span className="font-mono-num">{content.releaseYear}</span>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPlayingInline(true)}
                    className="tv-focusable inline-flex h-11 items-center gap-2 rounded-full border border-white/75 bg-black/35 px-6 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-black"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Watch Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleFavorite}
                    aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                    title={isFavorited ? 'In Favorites' : 'Add to Favorites'}
                    className={`tv-focusable inline-flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-sm transition-colors ${
                      isFavorited
                        ? 'border-pink-400 bg-pink-500/25 text-pink-200'
                        : 'border-white/60 bg-black/35 text-white hover:border-white hover:bg-white/15'
                    }`}
                  >
                    {isFavorited ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="w-full space-y-12 px-4 pt-8 sm:px-6 lg:px-8">
        {seasons.length > 0 && (
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold text-white">Episodes</h2>
              <div className="flex items-center gap-2">
                {seasons.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSeasonId(s.id)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                      selectedSeason?.id === s.id
                        ? 'bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-white'
                        : 'border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {(selectedSeason?.episodes || []).map((ep) => {
                const isSelected = activeEpisode?.id === ep.id && isPlayingInline;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => {
                      setActiveEpisode(ep);
                      setIsPlayingInline(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`flex items-center gap-4 rounded-xl border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-pink-500/60 bg-pink-500/10'
                        : 'border-white/10 bg-[#121621] hover:border-white/25'
                    }`}
                  >
                    <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-black">
                      <img
                        src={ep.thumbnailUrl || content.backdropUrl}
                        alt={ep.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                        <Play className="h-5 w-5 fill-white text-white" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-num">
                        <span>EP {ep.episodeNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span>{ep.durationMinutes}m</span>
                      </div>
                      <p className="mt-0.5 truncate font-display text-sm font-bold text-white">
                        {ep.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section>
            <h2 className="mb-4 font-display text-xl font-bold text-white">More Like This</h2>
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
              {related.map((item) => (
                <PosterCard
                  key={item.id}
                  item={item}
                  variant="landscape"
                  onSelect={(nextSlug) => navigate(`/title/${nextSlug}`)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
