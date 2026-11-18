import React, { useState } from 'react';
import { Crown, Heart, Tv } from 'lucide-react';
import { LiveChannel } from '../types/platform.ts';

interface LiveChannelCardProps {
  channel: LiveChannel;
  isActive?: boolean;
  isFavorited?: boolean;
  onSelect: (channel: LiveChannel) => void;
  onToggleFavorite?: (channelId: number) => void;
}

export function LiveChannelCard({
  channel,
  isActive = false,
  isFavorited = false,
  onSelect,
  onToggleFavorite,
}: LiveChannelCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="group relative flex flex-col items-center">
      <button
        type="button"
        onClick={() => onSelect(channel)}
        title={`${channel.name} · CH ${channel.channelNumber} (${channel.language})`}
        aria-label={`Watch channel ${channel.channelNumber} ${channel.name} live`}
        className="tv-focusable flex w-full flex-col items-center rounded-2xl p-1 text-center focus:outline-none"
      >
        <div className="relative mx-auto aspect-square w-full max-w-[104px]">
          <div
            className={`h-full w-full overflow-hidden rounded-full bg-white shadow-md transition-all duration-300 ease-out ${
              isActive
                ? 'ring-[3px] ring-pink-500 shadow-[0_0_24px_rgba(236,72,153,0.45)] scale-105'
                : 'ring-2 ring-white/20 group-hover:scale-105 group-hover:ring-pink-400 group-hover:shadow-[0_0_20px_rgba(147,51,234,0.35)]'
            }`}
          >
            {!imgError && channel.logoUrl ? (
              <img
                src={channel.logoUrl}
                alt={channel.name}
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
                onError={() => setImgError(true)}
                className={`h-full w-full object-contain ${
                  channel.logoUrl.startsWith('data:image/svg+xml') ||
                  channel.logoUrl.includes('/assets/aistudio/')
                    ? 'p-1.5'
                    : 'p-2.5'
                }`}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 px-2 text-slate-700">
                <Tv className="h-6 w-6 text-slate-500" />
                <span className="mt-1 max-w-full truncate text-[10px] font-bold">
                  {channel.name}
                </span>
              </div>
            )}
          </div>

          {channel.isFeatured && (
            <span
              title="Premium Channel"
              aria-label="Premium Channel"
              className="absolute -right-0.5 -top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-white ring-2 ring-[#0A0A0D] shadow-md"
            >
              <Crown className="h-2.5 w-2.5 fill-current" />
            </span>
          )}

          {isActive && (
            <span className="absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white ring-2 ring-[#0A0A0D] shadow">
              LIVE
            </span>
          )}
        </div>

        <span
          className={`mt-2.5 w-full truncate text-xs font-medium transition-colors ${
            isActive ? 'font-semibold text-pink-400' : 'text-slate-200 group-hover:text-white'
          }`}
        >
          {channel.name}
        </span>
        <span className="font-mono-num text-[10px] text-slate-500">
          CH {channel.channelNumber}
        </span>
      </button>

      {onToggleFavorite && (
        <button
          type="button"
          aria-label={
            isFavorited ? `Remove ${channel.name} from favorites` : `Save ${channel.name} to favorites`
          }
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(channel.id);
          }}
          className={`tv-focusable absolute left-1 top-1 z-10 rounded-full p-1.5 shadow-md transition-opacity ${
            isFavorited
              ? 'bg-pink-600 text-white opacity-100'
              : 'bg-black/75 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/90'
          }`}
        >
          <Heart className={`h-3 w-3 ${isFavorited ? 'fill-current' : ''}`} />
        </button>
      )}
    </div>
  );
}
