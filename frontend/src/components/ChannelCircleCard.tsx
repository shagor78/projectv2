import React, { useState } from 'react';
import { Tv } from 'lucide-react';
import { LiveChannel } from '../types/platform.ts';

interface ChannelCircleCardProps {
  channel: LiveChannel;
  isActive?: boolean;
  onSelect: (channel: LiveChannel) => void;
}

export function ChannelCircleCard({
  channel,
  isActive = false,
  onSelect,
}: ChannelCircleCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onSelect(channel)}
      title={`${channel.name} · CH ${channel.channelNumber}`}
      className="tv-focusable group flex w-28 shrink-0 flex-col items-center rounded-xl text-center focus:outline-none sm:w-32"
    >
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-xl bg-white shadow-sm transition-all duration-200 ${
          isActive
            ? 'ring-[2.5px] ring-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.35)] scale-[1.03]'
            : 'ring-1 ring-white/15 group-hover:scale-[1.04] group-hover:ring-2 group-hover:ring-rose-500/80'
        }`}
      >
        {!imgError && channel.logoUrl ? (
          <img
            src={channel.logoUrl}
            alt={channel.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgError(true)}
            className={`h-full w-full object-contain ${
              channel.logoUrl.startsWith('data:image/svg+xml') ? 'p-0' : 'p-2'
            }`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 text-slate-600">
            <Tv className="h-7 w-7 text-slate-500" />
          </div>
        )}
      </div>

      <span
        className={`mt-2 w-full truncate text-xs font-medium transition-colors ${
          isActive ? 'font-semibold text-rose-400' : 'text-slate-300 group-hover:text-white'
        }`}
      >
        {channel.name}
      </span>
    </button>
  );
}
