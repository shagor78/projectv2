import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react';
import { apiFetch } from '../services/api.ts';
import { SitePageRecord } from '../types/platform.ts';

interface CmsPageProps {
  slug: string;
  navigate: (path: string) => void;
}

export function CmsPage({ slug, navigate }: CmsPageProps) {
  const [page, setPage] = useState<SitePageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<{ page: SitePageRecord }>(`/api/pages/${encodeURIComponent(slug)}`)
      .then((res) => {
        setPage(res.page);
        if (res.page.metaTitle) {
          document.title = res.page.metaTitle;
        }
      })
      .catch((err) => setError(err?.message || 'Page not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-12 sm:px-6 lg:px-8">
        <div className="skeleton-shimmer h-64 rounded-2xl" />
        <div className="skeleton-shimmer h-40 rounded-2xl" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <FileText className="mx-auto h-10 w-10 text-slate-500" />
        <h1 className="mt-3 font-display text-2xl font-bold text-white">Page Not Found</h1>
        <p className="mt-2 text-sm text-slate-400">{error || 'This page is currently unavailable.'}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-5 rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] px-6 py-2.5 text-sm font-semibold text-white"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const visibleSections = (page.sectionsJson || [])
    .filter((s) => s.isVisible !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Storefront</span>
      </button>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#10141E]">
        {page.heroImageUrl && (
          <div className="relative h-56 w-full sm:h-72">
            <img
              src={page.heroImageUrl}
              alt={page.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#10141E] via-[#10141E]/50 to-transparent" />
          </div>
        )}
        <div className="p-6 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pink-400">
            VEXORA Information
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-white sm:text-4xl">
            {page.heroHeading || page.title}
          </h1>
          {(page.heroBody || page.subtitle) && (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
              {page.heroBody || page.subtitle}
            </p>
          )}
        </div>
      </div>

      {visibleSections.length > 0 && (
        <div className="mt-8 space-y-6">
          {visibleSections.map((sec) => (
            <section
              key={sec.id}
              className="rounded-2xl border border-white/10 bg-[#10141E] p-6 sm:p-8"
            >
              <h2 className="font-display text-xl font-bold text-white">{sec.heading}</h2>
              {sec.body && (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                  {sec.body}
                </p>
              )}
              {sec.ctaLabel && sec.ctaUrl && (
                <button
                  type="button"
                  onClick={() => navigate(sec.ctaUrl!)}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] px-5 py-2 text-xs font-semibold text-white hover:brightness-110"
                >
                  <span>{sec.ctaLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
