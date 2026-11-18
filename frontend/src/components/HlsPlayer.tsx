import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  AlertTriangle,
  Captions,
  ChevronLeft,
  ChevronRight,
  Languages,
  Maximize,
  Minimize,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { apiFetch, formatTimecode } from '../services/api.ts';
import { ChannelStream } from '../types/platform.ts';

interface HlsPlayerProps {
  title: string;
  subtitle?: string;
  posterUrl?: string;
  isLive?: boolean;
  hlsUrl?: string;
  streams?: ChannelStream[];
  channelId?: number;
  contentId?: number;
  episodeId?: number;
  initialTimeSeconds?: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onBack?: () => void;
  autoPlayNext?: boolean;
  remoteOsd?: {
    digits: string;
    notice: string | null;
    previewName?: string | null;
  };
}

export function HlsPlayer({
  title,
  subtitle,
  posterUrl,
  isLive = false,
  hlsUrl,
  streams,
  channelId,
  contentId,
  episodeId,
  initialTimeSeconds = 0,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onBack,
  autoPlayNext = true,
  remoteOsd,
}: HlsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const orderedStreams: ChannelStream[] =
    streams && streams.length > 0
      ? [...streams].sort((a, b) => a.priority - b.priority)
      : hlsUrl
      ? [
          {
            id: 0,
            channelId: channelId || 0,
            label: 'Primary Adaptive HLS',
            streamUrl: hlsUrl,
            priority: 1,
            isActive: true,
            healthStatus: 'healthy',
            responseTimeMs: null,
            lastHttpStatus: null,
            lastError: null,
            lastCheckedAt: null,
            consecutiveFailures: 0,
          },
        ]
      : [];

  const [streamIndex, setStreamIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const [qualityLevels, setQualityLevels] = useState<Array<{ index: number; label: string }>>([]);
  const [activeQuality, setActiveQuality] = useState<number>(-1);
  const [audioTracks, setAudioTracks] = useState<Array<{ index: number; label: string }>>([]);
  const [activeAudio, setActiveAudio] = useState<number>(0);
  const [subtitleTracks, setSubtitleTracks] = useState<Array<{ index: number; label: string }>>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<number>(-1);
  const [settingsMenu, setSettingsMenu] = useState<'none' | 'quality' | 'audio' | 'subs' | 'source'>('none');
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);

  const activeStream = orderedStreams[streamIndex];
  const streamSignature = orderedStreams.map((s) => `${s.id}:${s.streamUrl}`).join('|');

  useEffect(() => {
    setStreamIndex(0);
    setFatalError(null);
    setStatusMessage(null);
    setNextCountdown(null);
  }, [streamSignature, episodeId, contentId]);

  const triggerFailover = (reason: string) => {
    const failedStream = orderedStreams[streamIndex];
    const nextIdx = streamIndex + 1;

    if (channelId && failedStream && failedStream.id > 0) {
      apiFetch(`/api/channels/${channelId}/streams/${failedStream.id}/failover-report`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          nextStreamId: orderedStreams[nextIdx]?.id ?? null,
        }),
      }).catch(() => {});
    }

    if (nextIdx < orderedStreams.length) {
      setStatusMessage(
        `Source "${failedStream.label}" interrupted. Failing over to "${orderedStreams[nextIdx].label}"...`
      );
      setStreamIndex(nextIdx);
    } else {
      setFatalError('All configured HLS stream sources are currently unavailable.');
      setBuffering(false);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeStream?.streamUrl) {
      setBuffering(false);
      return;
    }

    setBuffering(true);
    setFatalError(null);
    setQualityLevels([]);
    setAudioTracks([]);
    setSubtitleTracks([]);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let mediaRecoverAttempts = 0;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: isLive,
        maxBufferLength: isLive ? 18 : 30,
        manifestLoadingMaxRetry: 1,
        levelLoadingMaxRetry: 2,
        fragLoadingMaxRetry: 2,
      });
      hlsRef.current = hls;

      hls.loadSource(activeStream.streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const levels = data.levels.map((lvl, idx) => ({
          index: idx,
          label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)} kbps`,
        }));
        setQualityLevels(levels);
        setActiveQuality(-1);

        if (!isLive && initialTimeSeconds > 5 && Number.isFinite(initialTimeSeconds)) {
          video.currentTime = initialTimeSeconds;
        }
        setBuffering(false);
        setStatusMessage(null);
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
        setAudioTracks(
          data.audioTracks.map((t, idx) => ({
            index: idx,
            label: t.name || t.lang || `Audio ${idx + 1}`,
          }))
        );
        setActiveAudio(hls.audioTrack);
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
        setSubtitleTracks(
          data.subtitleTracks.map((t, idx) => ({
            index: idx,
            label: t.name || t.lang || `Track ${idx + 1}`,
          }))
        );
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoverAttempts < 2) {
          mediaRecoverAttempts += 1;
          setStatusMessage('Recovering media pipeline...');
          hls.recoverMediaError();
          return;
        }
        triggerFailover(`Fatal ${data.type}: ${data.details}`);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = activeStream.streamUrl;
      video.addEventListener(
        'loadedmetadata',
        () => {
          if (!isLive && initialTimeSeconds > 5) {
            video.currentTime = initialTimeSeconds;
          }
          setBuffering(false);
          video.play().catch(() => {});
        },
        { once: true }
      );
    } else {
      setFatalError('HLS playback is not supported in this browser.');
      setBuffering(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStream?.streamUrl, streamIndex]);

  useEffect(() => {
    if (!contentId && !channelId) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      apiFetch('/api/watch-history', {
        method: 'POST',
        body: JSON.stringify({
          contentId: contentId || null,
          episodeId: episodeId || null,
          channelId: channelId || null,
          positionSeconds: Math.floor(video.currentTime || 0),
          durationSeconds: Math.floor(video.duration || 0),
        }),
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [contentId, episodeId, channelId]);

  useEffect(() => {
    if (nextCountdown === null) return;
    if (nextCountdown <= 0) {
      setNextCountdown(null);
      onNext?.();
      return;
    }
    const timer = setTimeout(() => setNextCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [nextCountdown, onNext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const video = videoRef.current;
    if (!video) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    } else if (e.key === 'ArrowRight') {
      if (!isLive) video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
      else onNext?.();
    } else if (e.key === 'ArrowLeft') {
      if (!isLive) video.currentTime = Math.max(0, video.currentTime - 10);
      else onPrevious?.();
    } else if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    } else if (e.key === 'Escape' || e.key === 'Backspace') {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      } else if (onBack) {
        e.preventDefault();
        onBack();
      }
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (val: number) => {
    const video = videoRef.current;
    setVolume(val);
    if (video) {
      video.volume = val;
      video.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const selectQuality = (lvlIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = lvlIndex;
      setActiveQuality(lvlIndex);
    }
    setSettingsMenu('none');
  };

  const selectAudio = (idx: number) => {
    if (hlsRef.current) {
      hlsRef.current.audioTrack = idx;
      setActiveAudio(idx);
    }
    setSettingsMenu('none');
  };

  const selectSubtitle = (idx: number) => {
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = idx;
      hlsRef.current.subtitleDisplay = idx >= 0;
      setActiveSubtitle(idx);
    }
    setSettingsMenu('none');
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="tv-focusable group relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
    >
      <video
        ref={videoRef}
        poster={posterUrl}
        playsInline
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => {
          if (!isLive && hasNext && autoPlayNext) {
            setNextCountdown(6);
          }
        }}
        onError={() => {
          if (orderedStreams.length > 0 && !fatalError) {
            triggerFailover('HTML5 Video element decode/network error');
          }
        }}
        className="h-full w-full cursor-pointer object-contain"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/80 via-black/30 to-transparent p-4">
        <div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Live
              </span>
            )}
            <h2 className="font-display text-base font-bold text-white sm:text-lg">{title}</h2>
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-slate-300">{subtitle}</p>}
        </div>

        {activeStream && (
          <div className="hidden sm:flex items-center gap-2 rounded-md bg-black/60 px-2.5 py-1 text-xs text-slate-300 backdrop-blur-sm">
            <span>{activeStream.label}</span>
            {orderedStreams.length > 1 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num text-amber-300">
                  Source {streamIndex + 1}/{orderedStreams.length}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {isFullscreen && remoteOsd && (remoteOsd.digits || remoteOsd.notice) && (
        <div className="pointer-events-none absolute right-5 top-16 z-30 min-w-[200px] rounded-2xl border border-pink-500/40 bg-[#0D1018]/90 px-4 py-3 shadow-2xl backdrop-blur-md">
          {remoteOsd.digits ? (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-pink-400">
                Remote Tune
              </span>
              <p className="font-mono-num text-2xl font-extrabold tracking-wider text-white">
                CH {remoteOsd.digits}
              </p>
              <p className="truncate text-xs text-slate-300">
                {remoteOsd.previewName || 'Searching channel number...'}
              </p>
            </div>
          ) : (
            <p className="font-mono-num text-sm font-bold text-white">{remoteOsd.notice}</p>
          )}
        </div>
      )}

      {orderedStreams.length === 0 && !fatalError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0D14]/95 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <p className="mt-3 font-display text-base font-bold text-white">
            Stream URL Pending
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            This channel logo is ready. Add its HLS (.m3u8) stream URL in the Admin Console to start live playback.
          </p>
        </div>
      )}

      {(buffering || statusMessage) && orderedStreams.length > 0 && !fatalError && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/40 px-4 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
          {statusMessage && (
            <p className="mt-3 max-w-md rounded-lg bg-black/80 px-3 py-1.5 text-xs font-medium text-amber-200">
              {statusMessage}
            </p>
          )}
        </div>
      )}

      {fatalError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-red-400" />
          <p className="mt-3 max-w-md text-sm font-medium text-white">{fatalError}</p>
          <button
            type="button"
            onClick={() => {
              setFatalError(null);
              setStreamIndex(0);
            }}
            className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
          >
            Retry Primary Stream
          </button>
        </div>
      )}

      {nextCountdown !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Up Next</p>
          <p className="mt-1 font-display text-xl font-bold text-white">
            Starting next episode in {nextCountdown}s
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setNextCountdown(null);
                onNext?.();
              }}
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
            >
              Play Next Now
            </button>
            <button
              type="button"
              onClick={() => setNextCountdown(null)}
              className="rounded-lg border border-white/20 px-4 py-2 text-xs font-medium text-white hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 pb-3 pt-8 transition-opacity">
        {!isLive && (
          <div className="mb-2 flex items-center gap-3">
            <span className="font-mono-num text-xs text-slate-300">{formatTimecode(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={Math.min(currentTime, duration || 100)}
              onChange={(e) => {
                const t = Number(e.target.value);
                if (videoRef.current) videoRef.current.currentTime = t;
                setCurrentTime(t);
              }}
              aria-label="Seek video timeline"
              className="h-1 flex-1 cursor-pointer accent-amber-400"
            />
            <span className="font-mono-num text-xs text-slate-400">{formatTimecode(duration)}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {hasPrevious && onPrevious && (
              <button
                type="button"
                onClick={onPrevious}
                aria-label={isLive ? 'Previous channel' : 'Previous episode'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10"
              >
                {isLive ? <ChevronLeft className="h-5 w-5" /> : <SkipBack className="h-4 w-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400"
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
            </button>

            {hasNext && onNext && (
              <button
                type="button"
                onClick={onNext}
                aria-label={isLive ? 'Next channel' : 'Next episode'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10"
              >
                {isLive ? <ChevronRight className="h-5 w-5" /> : <SkipForward className="h-4 w-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              aria-label="Volume"
              className="hidden w-20 cursor-pointer accent-amber-400 sm:block"
            />
          </div>

          <div className="relative flex items-center gap-1.5">
            {orderedStreams.length > 1 && (
              <button
                type="button"
                onClick={() => setSettingsMenu(settingsMenu === 'source' ? 'none' : 'source')}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-xs font-medium text-white hover:bg-white/20"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sources ({orderedStreams.length})</span>
              </button>
            )}

            {audioTracks.length > 1 && (
              <button
                type="button"
                onClick={() => setSettingsMenu(settingsMenu === 'audio' ? 'none' : 'audio')}
                aria-label="Audio tracks"
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs font-medium text-white hover:bg-white/20"
              >
                <Languages className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Audio</span>
              </button>
            )}

            {subtitleTracks.length > 0 && (
              <button
                type="button"
                onClick={() => setSettingsMenu(settingsMenu === 'subs' ? 'none' : 'subs')}
                aria-label="Subtitles"
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs font-medium text-white hover:bg-white/20"
              >
                <Captions className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">CC</span>
              </button>
            )}

            {qualityLevels.length > 0 && (
              <button
                type="button"
                onClick={() => setSettingsMenu(settingsMenu === 'quality' ? 'none' : 'quality')}
                aria-label="Quality selection"
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs font-medium text-white hover:bg-white/20"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="font-mono-num">
                  {activeQuality === -1
                    ? 'Auto'
                    : qualityLevels.find((q) => q.index === activeQuality)?.label || 'Auto'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>

            {settingsMenu !== 'none' && (
              <div className="absolute bottom-11 right-0 z-30 w-56 rounded-xl border border-white/15 bg-[#0F131C]/95 p-1.5 shadow-2xl backdrop-blur-md">
                {settingsMenu === 'quality' && (
                  <>
                    <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Video Quality
                    </div>
                    <button
                      type="button"
                      onClick={() => selectQuality(-1)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs ${
                        activeQuality === -1 ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      Auto (Adaptive ABR)
                    </button>
                    {qualityLevels.map((lvl) => (
                      <button
                        key={lvl.index}
                        type="button"
                        onClick={() => selectQuality(lvl.index)}
                        className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-mono-num ${
                          activeQuality === lvl.index
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </>
                )}

                {settingsMenu === 'audio' && (
                  <>
                    <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Audio Language
                    </div>
                    {audioTracks.map((t) => (
                      <button
                        key={t.index}
                        type="button"
                        onClick={() => selectAudio(t.index)}
                        className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs ${
                          activeAudio === t.index ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </>
                )}

                {settingsMenu === 'subs' && (
                  <>
                    <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Subtitles / CC
                    </div>
                    <button
                      type="button"
                      onClick={() => selectSubtitle(-1)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs ${
                        activeSubtitle === -1 ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      Off
                    </button>
                    {subtitleTracks.map((t) => (
                      <button
                        key={t.index}
                        type="button"
                        onClick={() => selectSubtitle(t.index)}
                        className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs ${
                          activeSubtitle === t.index
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </>
                )}

                {settingsMenu === 'source' && (
                  <>
                    <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Failover Stream Priority
                    </div>
                    {orderedStreams.map((s, idx) => (
                      <button
                        key={s.id || idx}
                        type="button"
                        onClick={() => {
                          setStreamIndex(idx);
                          setSettingsMenu('none');
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${
                          streamIndex === idx
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        <span className="truncate">{s.label}</span>
                        <span className="font-mono-num text-[10px] opacity-80">P{s.priority}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
