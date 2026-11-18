import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Info, Play, Radio } from 'lucide-react';
import { HeroSlide, PageHeroSlider } from '../types/platform.ts';

interface HeroSliderProps {
  slides: HeroSlide[];
  slider?: Partial<PageHeroSlider> | null;
  navigate: (path: string) => void;
  onWatchLiveChannel?: (channelSlug: string) => void;
  heightClass?: string;
}

export function HeroSlider({
  slides,
  slider,
  navigate,
  onWatchLiveChannel,
  heightClass = 'h-[74vh] min-h-[470px] max-h-[760px]',
}: HeroSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const safeIndex = slides.length > 0 ? activeIndex % slides.length : 0;
  const current = slides[safeIndex];

  useEffect(() => {
    setActiveIndex(0);
  }, [slides.length]);

  const autoplayEnabled = slider?.autoplay !== false;
  const durationMs = Math.max(2500, slider?.slideDurationMs || 6500);

  useEffect(() => {
    if (!autoplayEnabled || paused || slides.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, durationMs);
    return () => clearInterval(timer);
  }, [autoplayEnabled, paused, slides.length, durationMs]);

  if (!slides || slides.length === 0 || !current) return null;

  const isLiveSlide =
    Boolean(current.channelId) ||
    (current.badgeText || '').toUpperCase().includes('LIVE') ||
    (current.ctaLabel || '').toLowerCase().includes('live');

  const handlePrimaryAction = () => {
    if (isLiveSlide && current.channelSlug && onWatchLiveChannel) {
      onWatchLiveChannel(current.channelSlug);
      return;
    }
    navigate(current.ctaLink || (current.channelSlug ? `/live-tv?channel=${current.channelSlug}` : '/movies'));
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={slider?.name || 'Featured spotlight'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' && slides.length > 1) {
          e.preventDefault();
          handlePrev();
        } else if (e.key === 'ArrowRight' && slides.length > 1) {
          e.preventDefault();
          handleNext();
        }
      }}
      className={`group/hero relative w-full overflow-hidden bg-[#0A0A0D] ${heightClass}`}
    >
      <picture className="block h-full w-full">
        {current.mobileImageUrl && <source media="(max-width: 639px)" srcSet={current.mobileImageUrl} />}
        {current.tabletImageUrl && <source media="(max-width: 1023px)" srcSet={current.tabletImageUrl} />}
        <img
          src={current.imageUrl}
          alt={current.title}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-center transition-opacity duration-500"
        />
      </picture>

      <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0D]/95 via-[#0A0A0D]/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0D] via-[#0A0A0D]/25 to-black/40" />

      <div className="absolute inset-0 flex w-full flex-col justify-end px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16">
        <div className="max-w-2xl space-y-3.5">
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.14em]">
            {isLiveSlide ? (
              <span className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold tracking-wider text-white">
                <Radio className="h-3 w-3" />
                <span>LIVE</span>
              </span>
            ) : current.badgeText ? (
              <span className="text-pink-400">{current.badgeText}</span>
            ) : null}

            {(current.categoryLabel || current.languageLabel) && (
              <span className="flex items-center gap-2 text-slate-300 font-medium tracking-wider">
                {current.badgeText || isLiveSlide ? <span aria-hidden="true">·</span> : null}
                {current.categoryLabel && <span>{current.categoryLabel}</span>}
                {current.categoryLabel && current.languageLabel && <span aria-hidden="true">·</span>}
                {current.languageLabel && <span>{current.languageLabel}</span>}
              </span>
            )}
          </div>

          <h1
            className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[52px] lg:leading-[1.08]"
            style={{ textWrap: 'balance' }}
          >
            {current.title}
          </h1>

          {current.subtitle && (
            <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-slate-200/90 sm:text-base">
              {current.subtitle}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="tv-focusable inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] px-6 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 hover:brightness-110 transition-all"
            >
              {isLiveSlide ? <Radio className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
              <span>{current.ctaLabel || (isLiveSlide ? 'Watch Live' : 'Watch Now')}</span>
            </button>

            {current.secondaryCtaLabel && current.secondaryCtaLink && (
              <button
                type="button"
                onClick={() => navigate(current.secondaryCtaLink!)}
                className="tv-focusable inline-flex h-11 items-center gap-2 rounded-full border border-white/40 bg-black/45 px-5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white hover:text-black transition-all"
              >
                <Info className="h-4 w-4" />
                <span>{current.secondaryCtaLabel}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous hero slide"
            className="tv-focusable absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white opacity-70 backdrop-blur-sm transition-all hover:opacity-100 hover:bg-white hover:text-black sm:left-5 lg:opacity-0 lg:group-hover/hero:opacity-100 lg:focus-visible:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next hero slide"
            className="tv-focusable absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white opacity-70 backdrop-blur-sm transition-all hover:opacity-100 hover:bg-white hover:text-black sm:right-5 lg:opacity-0 lg:group-hover/hero:opacity-100 lg:focus-visible:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-6 right-5 z-20 flex items-center gap-1.5 sm:bottom-8 sm:right-10">
          {slides.map((s, idx) => (
            <button
              key={s.id || idx}
              type="button"
              aria-label={`View slide ${idx + 1}: ${s.title}`}
              aria-current={idx === safeIndex ? 'true' : undefined}
              onClick={() => setActiveIndex(idx)}
              className={`tv-focusable h-2 rounded-full transition-all ${
                idx === safeIndex ? 'w-7 bg-white' : 'w-2 bg-white/40 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
