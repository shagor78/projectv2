import React, { useState } from 'react';
import { Crown, Film, Play } from 'lucide-react';
import { formatDuration } from '../services/api.ts';
import { ContentItem } from '../types/platform.ts';

interface PosterCardProps {
  item: ContentItem;
  onSelect: (slug: string) => void;
  variant?: 'landscape' | 'poster';
  showRibbon?: boolean;
}

export function PosterCard({
  item,
  onSelect,
  variant = 'landscape',
}: PosterCardProps) {
  const [imgError, setImgError] = useState(false);
  const imageSrc = variant === 'landscape' ? item.backdropUrl || item.posterUrl : item.posterUrl;

  return (
    <button
      type="button"
      onClick={() => onSelect(item.slug)}
      title={item.title}
      className="tv-focusable group relative flex w-full flex-col rounded-lg text-left focus:outline-none"
    >
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-[#141720] ring-1 ring-white/10 transition-all duration-200 group-hover:ring-pink-500/70 group-focus-visible:ring-pink-400 ${
          variant === 'landscape' ? 'aspect-video' : 'aspect-[3/4]'
        }`}
      >
        {!imgError && imageSrc ? (
          <img
            src={imageSrc}
            alt={item.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="block h-full w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#181C28] to-[#0B0D13] p-4 text-center">
            <Film className="h-7 w-7 text-slate-500" />
            <span className="mt-2 line-clamp-2 text-xs font-medium text-slate-400">
              {item.title}
            </span>
          </div>
        )}

        {item.isFeatured && (
          <span
            aria-label="Premium title"
            className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-white shadow-md"
          >
            <Crown className="h-3.5 w-3.5 fill-current" />
          </span>
        )}

        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-950 shadow-xl">
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </span>
        </div>
      </div>

      <div className="mt-2 px-0.5">
        <p className="line-clamp-1 text-sm font-semibold text-slate-100 transition-colors group-hover:text-pink-300">
          {item.title}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-400">
          <span>{item.releaseYear}</span>
          <span aria-hidden="true">·</span>
          <span>{item.language || item.rating}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num">
            {item.seasonCount && item.seasonCount > 0
              ? `${item.seasonCount} ${item.seasonCount === 1 ? 'Season' : 'Seasons'}`
              : formatDuration(item.durationMinutes)}
          </span>
        </div>
      </div>
    </button>
  );
}
