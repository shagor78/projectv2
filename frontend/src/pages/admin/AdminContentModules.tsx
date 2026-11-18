import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Layers, Plus, Trash2, Upload } from 'lucide-react';
import { apiFetch } from '../../services/api.ts';
import { ContentCategory, ContentItem } from '../../types/platform.ts';

const PAGE_SIZE = 12;

export function AdminContentSection({
  contentType,
}: {
  contentType: 'movie' | 'drama' | 'series' | 'sports';
}) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentItem | null>(null);
  const [seasonModalItem, setSeasonModalItem] = useState<ContentItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Content form state
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [backdropUrl, setBackdropUrl] = useState('');
  const [hlsUrl, setHlsUrl] = useState('');
  const [releaseDate, setReleaseDate] = useState('2026-11-01');
  const [releaseYear, setReleaseYear] = useState('2026');
  const [durationMinutes, setDurationMinutes] = useState('110');
  const [rating, setRating] = useState('PG-13');
  const [language, setLanguage] = useState('English');
  const [country, setCountry] = useState('International');
  const [director, setDirector] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isRecentlyAdded, setIsRecentlyAdded] = useState(true);
  const [isPublished, setIsPublished] = useState(true);
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([]);
  const [placementsText, setPlacementsText] = useState('recently_added');

  // Season/Episode creation state
  const [newSeasonNum, setNewSeasonNum] = useState('1');
  const [newSeasonTitle, setNewSeasonTitle] = useState('Season 1');
  const [epSeasonId, setEpSeasonId] = useState<number>(0);
  const [epNum, setEpNum] = useState('1');
  const [epTitle, setEpTitle] = useState('');
  const [epHls, setEpHls] = useState('');

  const load = () => {
    setError(null);
    Promise.all([
      apiFetch(`/api/admin/contents?type=${contentType}`),
      apiFetch('/api/admin/content-categories'),
    ])
      .then(([cData, catData]) => {
        const loaded: ContentItem[] = cData.contents || [];
        setItems(loaded);
        setCategories(catData.categories || []);
        if (seasonModalItem) {
          const refreshed = loaded.find((x) => x.id === seasonModalItem.id);
          if (refreshed) setSeasonModalItem(refreshed);
        }
      })
      .catch((err) => setError(err?.message || 'Failed to load catalog items'));
  };

  useEffect(() => {
    setPage(1);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setSynopsis('');
    setPosterUrl('/src/assets/images/poster_midnight_meridian_1794748095273.jpg');
    setBackdropUrl('/src/assets/images/hero_midnight_meridian_1794748093840.jpg');
    setHlsUrl('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
    setReleaseDate('2026-11-15');
    setReleaseYear('2026');
    setDurationMinutes('115');
    setRating('PG-13');
    setLanguage('English');
    setCountry('International');
    setDirector('');
    setTagsText('hd, premiere');
    setIsFeatured(false);
    setIsRecentlyAdded(true);
    setIsPublished(true);
    setSelectedCatIds([]);
    setPlacementsText('recently_added');
    setModalOpen(true);
  };

  const openEdit = (item: ContentItem) => {
    setEditing(item);
    setTitle(item.title);
    setSynopsis(item.synopsis);
    setPosterUrl(item.posterUrl);
    setBackdropUrl(item.backdropUrl);
    setHlsUrl(item.hlsUrl || '');
    setReleaseDate(item.releaseDate || '2026-01-01');
    setReleaseYear(String(item.releaseYear));
    setDurationMinutes(String(item.durationMinutes));
    setRating(item.rating);
    setLanguage(item.language || 'English');
    setCountry(item.country || 'International');
    setDirector(item.director || '');
    setTagsText((item.tags || []).join(', '));
    setIsFeatured(item.isFeatured);
    setIsRecentlyAdded(item.isRecentlyAdded !== false);
    setIsPublished(item.isPublished);
    setSelectedCatIds(item.categoryIds || []);
    setPlacementsText((item.placements || []).join(', '));
    setModalOpen(true);
  };

  const uploadImage = async (file: File, setter: (url: string) => void) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiFetch('/api/admin/upload', { method: 'POST', body: fd });
    setter(res.url);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title,
      contentType,
      synopsis,
      posterUrl,
      backdropUrl,
      hlsUrl,
      releaseDate,
      releaseYear: Number(releaseYear),
      durationMinutes: Number(durationMinutes),
      rating,
      language,
      country,
      director,
      tags: tagsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      isFeatured,
      isRecentlyAdded,
      isPublished,
      categoryIds: selectedCatIds,
      placements: placementsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (editing) {
      await apiFetch(`/api/admin/contents/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/api/admin/contents', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    setModalOpen(false);
    load();
  };

  const filtered = items.filter((i) => {
    const matchesSearch =
      !search.trim() ||
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      (i.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'published' && i.isPublished) ||
      (statusFilter === 'draft' && !i.isPublished);
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const labelTitle =
    contentType === 'movie'
      ? 'Movie'
      : contentType === 'drama'
      ? 'Drama'
      : contentType === 'series'
      ? 'Web Series'
      : 'Sports Event';

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={load} className="rounded bg-white/10 px-2.5 py-1 text-white">
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={`Search ${labelTitle.toLowerCase()} titles or tags...`}
            className="h-10 w-full rounded-lg border border-white/10 bg-[#10141E] px-3 text-sm text-white sm:w-72"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-white/10 bg-[#10141E] px-3 text-xs text-white"
          >
            <option value="all">All Status ({items.length})</option>
            <option value="published">Published</option>
            <option value="draft">Draft / Hidden</option>
          </select>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" />
          <span>Add {labelTitle}</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-slate-400">
            <tr>
              <th className="p-3">Title</th>
              <th className="p-3">Release</th>
              <th className="p-3">Tags & Placements</th>
              {(contentType === 'drama' || contentType === 'series') && <th className="p-3">Seasons</th>}
              <th className="p-3">Views</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paged.map((item) => (
              <tr key={item.id} className="hover:bg-white/[0.02]">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      className="h-12 w-9 rounded object-cover border border-white/10"
                    />
                    <div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.rating} · {item.durationMinutes}m · {item.language}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-3 font-mono-num text-slate-300">{item.releaseDate}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {(item.tags || []).slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300"
                      >
                        #{t}
                      </span>
                    ))}
                    {(item.placements || []).map((p) => (
                      <span key={p} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
                {(contentType === 'drama' || contentType === 'series') && (
                  <td className="p-3 font-mono-num text-amber-300">
                    {item.seasons?.length || 0} Seasons
                  </td>
                )}
                <td className="p-3 font-mono-num text-slate-300">{item.viewCount}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/contents/${item.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ isPublished: !item.isPublished }),
                      });
                      load();
                    }}
                    className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                      item.isPublished
                        ? 'border-emerald-500/40 text-emerald-400'
                        : 'border-white/15 text-slate-400'
                    }`}
                  >
                    {item.isPublished ? 'Published' : 'Draft'}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    {(contentType === 'drama' || contentType === 'series') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSeasonModalItem(item);
                          setEpSeasonId(item.seasons?.[0]?.id || 0);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-amber-300 hover:bg-amber-500/20"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>Episodes</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="rounded border border-white/15 px-2.5 py-1 text-white hover:bg-white/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="rounded border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 items-center gap-1 rounded border border-white/15 px-2.5 text-white disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>
            <span className="font-mono-num text-white">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 items-center gap-1 rounded border border-white/15 px-2.5 text-white disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-white">Delete {labelTitle}?</h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently remove <span className="font-semibold text-white">{deleteTarget.title}</span>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-9 rounded-lg border border-white/15 px-4 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await apiFetch(`/api/admin/contents/${deleteTarget.id}`, { method: 'DELETE' });
                  setDeleteTarget(null);
                  load();
                }}
                className="h-9 rounded-lg bg-red-500 px-4 text-xs font-bold text-white hover:bg-red-400"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Content Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleSave}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-white">
              {editing ? `Edit ${labelTitle}: ${editing.title}` : `Create ${labelTitle}`}
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-slate-300">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300">Director / Broadcaster</label>
                <input
                  type="text"
                  value={director}
                  onChange={(e) => setDirector(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-sm text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-300">Release Date</label>
                <input
                  type="date"
                  value={releaseDate}
                  onChange={(e) => {
                    setReleaseDate(e.target.value);
                    setReleaseYear(e.target.value.slice(0, 4));
                  }}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 font-mono-num text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300">Duration (min)</label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 font-mono-num text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300">Rating</label>
                <input
                  type="text"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300">HLS Playback URL (.m3u8)</label>
              <input
                type="url"
                value={hlsUrl}
                onChange={(e) => setHlsUrl(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 font-mono-num text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-slate-300">Poster URL / Upload</label>
                <div className="mt-1 flex gap-2 items-center">
                  {posterUrl && (
                    <img src={posterUrl} alt="" className="h-10 w-8 rounded border border-white/10 object-cover" />
                  )}
                  <input
                    type="text"
                    value={posterUrl}
                    onChange={(e) => setPosterUrl(e.target.value)}
                    className="h-10 flex-1 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                  />
                  <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 text-xs text-white">
                    <Upload className="h-3.5 w-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(f, setPosterUrl);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300">Backdrop URL / Upload</label>
                <div className="mt-1 flex gap-2 items-center">
                  {backdropUrl && (
                    <img src={backdropUrl} alt="" className="h-10 w-16 rounded border border-white/10 object-cover" />
                  )}
                  <input
                    type="text"
                    value={backdropUrl}
                    onChange={(e) => setBackdropUrl(e.target.value)}
                    className="h-10 flex-1 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                  />
                  <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 text-xs text-white">
                    <Upload className="h-3.5 w-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(f, setBackdropUrl);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300">Categories</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {categories.map((c) => {
                  const checked = selectedCatIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${
                        checked
                          ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                          : 'border-white/10 bg-[#0A0D14] text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedCatIds((prev) =>
                            checked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          )
                        }
                        className="accent-amber-500"
                      />
                      <span>{c.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-slate-300">
                  Tags (comma-separated: noir, 4k, premiere)
                </label>
                <input
                  type="text"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300">
                  Placements (comma-separated: trending, recently_added)
                </label>
                <input
                  type="text"
                  value={placementsText}
                  onChange={(e) => setPlacementsText(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300">Synopsis</label>
              <textarea
                rows={3}
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#0A0D14] p-3 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300">Language</label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="English, Bangla, Hindi, Korean"
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300">Country / Region</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Bangladesh, India, South Korea, USA..."
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="accent-amber-500"
                />
                Published
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="accent-amber-500"
                />
                Featured
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isRecentlyAdded}
                  onChange={(e) => setIsRecentlyAdded(e.target.checked)}
                  className="accent-amber-500"
                />
                Recently Added
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-9 rounded-lg border border-white/15 px-4 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded-lg bg-amber-500 px-5 text-xs font-bold text-slate-950"
              >
                Save {labelTitle}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Seasons & Episodes Manager Modal */}
      {seasonModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-lg font-bold text-white">
                Seasons & Episodes — {seasonModalItem.title}
              </h3>
              <button
                type="button"
                onClick={() => setSeasonModalItem(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch(`/api/admin/contents/${seasonModalItem.id}/seasons`, {
                  method: 'POST',
                  body: JSON.stringify({
                    seasonNumber: Number(newSeasonNum),
                    title: newSeasonTitle,
                  }),
                });
                load();
              }}
              className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#0A0D14] p-3"
            >
              <input
                type="number"
                min={1}
                value={newSeasonNum}
                onChange={(e) => setNewSeasonNum(e.target.value)}
                placeholder="Season #"
                className="h-9 w-24 rounded-lg border border-white/15 bg-[#10141E] px-2.5 font-mono-num text-xs text-white"
              />
              <input
                type="text"
                value={newSeasonTitle}
                onChange={(e) => setNewSeasonTitle(e.target.value)}
                placeholder="Season Title"
                className="h-9 flex-1 rounded-lg border border-white/15 bg-[#10141E] px-3 text-xs text-white"
              />
              <button
                type="submit"
                className="h-9 rounded-lg bg-amber-500 px-4 text-xs font-bold text-slate-950"
              >
                Add Season
              </button>
            </form>

            {(seasonModalItem.seasons || []).length > 0 && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const sid = epSeasonId || seasonModalItem.seasons![0].id;
                  await apiFetch(`/api/admin/seasons/${sid}/episodes`, {
                    method: 'POST',
                    body: JSON.stringify({
                      episodeNumber: Number(epNum),
                      title: epTitle,
                      hlsUrl: epHls || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                    }),
                  });
                  setEpTitle('');
                  setEpHls('');
                  load();
                }}
                className="grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-[#0A0D14] p-3 sm:grid-cols-12"
              >
                <select
                  value={epSeasonId || seasonModalItem.seasons![0]?.id}
                  onChange={(e) => setEpSeasonId(Number(e.target.value))}
                  className="h-9 rounded-lg border border-white/15 bg-[#10141E] px-2 text-xs text-white sm:col-span-3"
                >
                  {(seasonModalItem.seasons || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={epNum}
                  onChange={(e) => setEpNum(e.target.value)}
                  placeholder="Ep #"
                  className="h-9 rounded-lg border border-white/15 bg-[#10141E] px-2 font-mono-num text-xs text-white sm:col-span-1"
                />
                <input
                  type="text"
                  required
                  value={epTitle}
                  onChange={(e) => setEpTitle(e.target.value)}
                  placeholder="Episode Title"
                  className="h-9 rounded-lg border border-white/15 bg-[#10141E] px-3 text-xs text-white sm:col-span-3"
                />
                <input
                  type="url"
                  value={epHls}
                  onChange={(e) => setEpHls(e.target.value)}
                  placeholder="HLS .m3u8 URL"
                  className="h-9 rounded-lg border border-white/15 bg-[#10141E] px-3 text-xs text-white sm:col-span-3"
                />
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-white/15 text-xs font-bold text-white hover:bg-white/25 sm:col-span-2"
                >
                  Add Ep
                </button>
              </form>
            )}

            <div className="space-y-4">
              {(seasonModalItem.seasons || []).map((s) => (
                <div key={s.id} className="rounded-xl border border-white/10 bg-[#0A0D14] p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-sm font-bold text-white">
                      {s.title} (Season {s.seasonNumber})
                    </h4>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/seasons/${s.id}`, { method: 'DELETE' });
                        load();
                      }}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Delete Season
                    </button>
                  </div>
                  <div className="mt-3 divide-y divide-white/5 text-xs">
                    {(s.episodes || []).map((ep) => (
                      <div key={ep.id} className="flex items-center justify-between py-2">
                        <div>
                          <span className="font-mono-num text-amber-400">E{ep.episodeNumber}</span>{' '}
                          <span className="font-semibold text-white">{ep.title}</span>
                          <p className="font-mono-num text-[11px] text-slate-500">{ep.hlsUrl}</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/episodes/${ep.id}`, { method: 'DELETE' });
                            load();
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
