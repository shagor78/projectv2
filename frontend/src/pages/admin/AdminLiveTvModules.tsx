import React, { useEffect, useState } from 'react';
import { GripVertical, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { apiFetch } from '../../services/api.ts';
import { ChannelCategory, LiveChannel } from '../../types/platform.ts';
import { matchesClientSearch } from '../../utils/search.ts';

export function AdminLiveTvSection() {
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LiveChannel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LiveChannel | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [channelNumber, setChannelNumber] = useState('101');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('Global');
  const [language, setLanguage] = useState('English');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [showOnHomepage, setShowOnHomepage] = useState(true);
  const [showOnLiveTv, setShowOnLiveTv] = useState(true);
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([]);
  const [placementsText, setPlacementsText] = useState('homepage_live');
  const [initialStreamUrl, setInitialStreamUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setError(null);
    Promise.all([apiFetch('/api/admin/channels'), apiFetch('/api/admin/channel-categories')])
      .then(([chData, catData]) => {
        setChannels(chData.channels || []);
        setCategories(catData.categories || []);
      })
      .catch((err) => setError(err?.message || 'Failed to load Live TV channels'));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setChannelNumber(String(100 + channels.length + 1));
    setLogoUrl('');
    setDescription('');
    setCountry('Global');
    setLanguage('English');
    setIsFeatured(false);
    setIsPublished(true);
    setShowOnHomepage(true);
    setShowOnLiveTv(true);
    setSelectedCatIds(categories[0] ? [categories[0].id] : []);
    setPlacementsText('homepage_live');
    setInitialStreamUrl('');
    setModalOpen(true);
  };

  const openEdit = (ch: LiveChannel) => {
    setEditing(ch);
    setName(ch.name);
    setChannelNumber(String(ch.channelNumber));
    setLogoUrl(ch.logoUrl);
    setDescription(ch.description || '');
    setCountry(ch.country || 'Global');
    setLanguage(ch.language || 'English');
    setIsFeatured(ch.isFeatured);
    setIsPublished(ch.isPublished);
    setShowOnHomepage(ch.showOnHomepage !== false);
    setShowOnLiveTv(ch.showOnLiveTv !== false);
    setSelectedCatIds(ch.categoryIds || ch.categories?.map((c) => c.id) || []);
    setPlacementsText((ch.placements || []).join(', '));
    setInitialStreamUrl('');
    setModalOpen(true);
  };

  const handleUploadLogo = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch('/api/admin/upload', { method: 'POST', body: fd });
      setLogoUrl(res.url);
    } catch (err: any) {
      setError(err?.message || 'Logo upload failed');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const placements = placementsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload: any = {
        name,
        channelNumber: Number(channelNumber),
        logoUrl,
        description,
        country,
        language,
        isFeatured,
        isPublished,
        showOnHomepage,
        showOnLiveTv,
        categoryIds: selectedCatIds,
        placements,
      };
      if (editing) {
        await apiFetch(`/api/admin/channels/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        if (initialStreamUrl.trim()) {
          await apiFetch(`/api/admin/channels/${editing.id}/streams`, {
            method: 'POST',
            body: JSON.stringify({
              label: `Stream ${(editing.streams?.length || 0) + 1}`,
              streamUrl: initialStreamUrl.trim(),
              priority: (editing.streams?.length || 0) + 1,
            }),
          });
        }
      } else {
        if (initialStreamUrl.trim()) {
          payload.streams = [{ label: 'Primary Stream', streamUrl: initialStreamUrl.trim(), priority: 1 }];
        }
        await apiFetch('/api/admin/channels', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save channel');
    } finally {
      setSaving(false);
    }
  };

  const handleDropReorder = async (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    const list = [...channels];
    const fromIdx = list.findIndex((c) => c.id === dragId);
    const toIdx = list.findIndex((c) => c.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setChannels(list);
    setDragId(null);
    await apiFetch('/api/admin/channels/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds: list.map((c) => c.id) }),
    });
  };

  const filtered = channels.filter((c) =>
    matchesClientSearch(search, c.name, [
      c.channelNumber,
      c.slug,
      c.description,
      c.language,
      c.country,
      ...(c.categories || []).flatMap((cat) => [cat.name, cat.slug]),
      ...(c.streams || []).map((s) => s.label),
    ])
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedChannels = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search channels by name or number..."
            className="h-10 w-full rounded-lg border border-white/10 bg-[#10141E] px-3 text-sm text-white sm:w-72"
          />
          <span className="hidden text-xs text-slate-400 font-mono-num sm:inline">
            {filtered.length} channels
          </span>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" />
          <span>Add Channel</span>
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Drag rows by the grip handle to set manual channel order on the customer storefront.
      </p>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-slate-400">
            <tr>
              <th className="w-10 p-3">Order</th>
              <th className="p-3">Channel</th>
              <th className="p-3">Categories</th>
              <th className="p-3">Tier</th>
              <th className="p-3">Streams</th>
              <th className="p-3">Health</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {pagedChannels.map((ch) => (
              <tr
                key={ch.id}
                draggable
                onDragStart={() => setDragId(ch.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropReorder(ch.id)}
                className="hover:bg-white/[0.02]"
              >
                <td className="p-3 cursor-grab text-slate-500">
                  <GripVertical className="h-4 w-4" />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={ch.logoUrl}
                      alt={ch.name}
                      className="h-9 w-9 rounded-full border border-white/15 bg-white p-0.5 object-contain"
                    />
                    <div>
                      <p className="font-semibold text-white">{ch.name}</p>
                      <p className="font-mono-num text-[11px] text-slate-400">CH {ch.channelNumber}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-slate-300">
                  {ch.categories?.map((c) => c.name).join(', ') || 'Uncategorized'}
                </td>
                <td className="p-3">
                  {ch.isFeatured ? (
                    <span className="rounded-full bg-gradient-to-r from-[#9333EA]/30 to-[#EC4899]/30 border border-pink-500/40 px-2 py-0.5 text-[11px] font-semibold text-pink-200">
                      Premium
                    </span>
                  ) : (
                    <span className="text-slate-400">Free</span>
                  )}
                </td>
                <td className="p-3 font-mono-num">
                  {ch.streams.length > 0 ? (
                    <span className="text-white">{ch.streams.length} URLs</span>
                  ) : (
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                      Pending URL
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <span
                    className={`font-semibold capitalize ${
                      ch.currentHealthStatus === 'healthy'
                        ? 'text-emerald-400'
                        : ch.currentHealthStatus === 'degraded'
                        ? 'text-amber-400'
                        : ch.currentHealthStatus === 'offline'
                        ? 'text-red-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {ch.currentHealthStatus}
                  </span>
                </td>
                <td className="p-3">
                  <span className={ch.isPublished ? 'text-emerald-400' : 'text-slate-500'}>
                    {ch.isPublished ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(ch)}
                      className="rounded border border-white/15 px-2.5 py-1 text-xs text-white hover:bg-white/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(ch)}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length} channels
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-white hover:bg-white/10 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="font-mono-num text-white">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-white hover:bg-white/10 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-white">Delete Live Channel?</h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete <span className="font-semibold text-white">{deleteTarget.name}</span> and all of its HLS stream sources? This cannot be undone.
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
                  await apiFetch(`/api/admin/channels/${deleteTarget.id}`, { method: 'DELETE' });
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleSave}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-white">
              {editing ? `Edit Channel: ${editing.name}` : 'Create Live TV Channel'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300">Channel Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300">Channel Number</label>
                <input
                  type="number"
                  required
                  value={channelNumber}
                  onChange={(e) => setChannelNumber(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 font-mono-num text-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300">Channel Logo URL or Upload</label>
              <div className="mt-1 flex gap-2 items-center">
                {logoUrl && (
                  <img src={logoUrl} alt="" className="h-10 w-10 rounded-lg border border-white/10 object-cover" />
                )}
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="/uploads/... or SVG/image URL"
                  className="h-10 flex-1 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                />
                <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/10">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadLogo(f);
                    }}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300">Categories (Multi-Assignment)</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const checked = selectedCatIds.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer ${
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
                            checked ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                          )
                        }
                        className="accent-amber-500"
                      />
                      <span>{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300">
                Placements (comma-separated, e.g. homepage_live, sports_bar, featured_channels)
              </label>
              <input
                type="text"
                value={placementsText}
                onChange={(e) => setPlacementsText(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#0A0D14] p-3 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300">
                {editing
                  ? `Quick Add HLS Stream URL (.m3u8) — currently ${editing.streams?.length || 0} configured`
                  : 'Initial HLS Stream URL (.m3u8) — add unlimited more in Stream URL Management'}
              </label>
              <input
                type="url"
                value={initialStreamUrl}
                onChange={(e) => setInitialStreamUrl(e.target.value)}
                placeholder="https://.../master.m3u8"
                className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300">Language</label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="English, Bangla, Hindi..."
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Bangladesh, Global, India..."
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
                Premium Channel (Crown Badge)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showOnHomepage}
                  onChange={(e) => setShowOnHomepage(e.target.checked)}
                  className="accent-amber-500"
                />
                Show on Homepage
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showOnLiveTv}
                  onChange={(e) => setShowOnLiveTv(e.target.checked)}
                  className="accent-amber-500"
                />
                Show on Live TV
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-9 rounded-lg border border-white/15 px-4 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 rounded-lg bg-amber-500 px-5 text-xs font-bold text-slate-950"
              >
                {saving ? 'Saving...' : 'Save Channel'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function AdminChannelCategoriesSection() {
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('All');
  const [categoryType, setCategoryType] = useState('genre');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    apiFetch('/api/admin/channel-categories')
      .then((d) => setCategories(d.categories || []))
      .catch((err) => setError(err?.message || 'Failed to load channel categories'));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await apiFetch('/api/admin/channel-categories', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        language,
        categoryType,
        sortOrder: categories.length + 1,
      }),
    });
    setName('');
    setDescription('');
    setLanguage('All');
    load();
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>
      )}
      <form onSubmit={handleCreate} className="flex flex-wrap gap-3 rounded-xl border border-white/10 bg-[#10141E] p-4">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name (e.g. Regional News)"
          className="h-10 flex-1 min-w-[180px] rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-sm text-white"
        />
        <select
          value={categoryType}
          onChange={(e) => setCategoryType(e.target.value)}
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
        >
          <option value="featured">Featured</option>
          <option value="language">Language (Strict)</option>
          <option value="genre">Genre</option>
          <option value="general">General</option>
        </select>
        <input
          type="text"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          placeholder="Language (All, Bangla, Hindi)"
          className="h-10 w-40 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="h-10 flex-1 min-w-[180px] rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-sm text-white"
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-amber-500 px-5 text-xs font-bold text-slate-950"
        >
          Add Category
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-slate-400">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Type</th>
              <th className="p-3">Language</th>
              <th className="p-3">Description</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td className="p-3 font-semibold text-white">{cat.name}</td>
                <td className="p-3 capitalize text-slate-300">{cat.categoryType}</td>
                <td className="p-3 text-amber-300 font-semibold">{cat.language}</td>
                <td className="p-3 text-slate-300">{cat.description}</td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/channel-categories/${cat.id}`, { method: 'DELETE' });
                      load();
                    }}
                    className="rounded border border-red-500/30 px-2.5 py-1 text-red-400 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminStreamManagementSection() {
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<number>(0);
  const [logs, setLogs] = useState<any[]>([]);
  const [label, setLabel] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [priority, setPriority] = useState('1');
  const [testingId, setTestingId] = useState<number | null>(null);
  const [sweepRunning, setSweepRunning] = useState(false);

  const load = () => {
    Promise.all([apiFetch('/api/admin/channels'), apiFetch('/api/admin/stream-health-logs')]).then(
      ([chData, logData]) => {
        const list: LiveChannel[] = chData.channels || [];
        setChannels(list);
        if (!selectedChannelId && list[0]) setSelectedChannelId(list[0].id);
        setLogs(logData.logs || []);
      }
    );
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [channelFilter, setChannelFilter] = useState('');
  const filteredStreamChannels = channels.filter(
    (c) =>
      !channelFilter.trim() ||
      c.name.toLowerCase().includes(channelFilter.toLowerCase()) ||
      String(c.channelNumber).includes(channelFilter)
  );
  const currentChannel =
    channels.find((c) => c.id === selectedChannelId) || filteredStreamChannels[0] || channels[0];

  const handleAddStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChannel || !streamUrl.trim()) return;
    await apiFetch(`/api/admin/channels/${currentChannel.id}/streams`, {
      method: 'POST',
      body: JSON.stringify({
        label: label.trim() || `Stream ${currentChannel.streams.length + 1}`,
        streamUrl: streamUrl.trim(),
        priority: Number(priority || currentChannel.streams.length + 1),
      }),
    });
    setLabel('');
    setStreamUrl('');
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#10141E] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={channelFilter}
            onChange={(e) => {
              const q = e.target.value;
              setChannelFilter(q);
              const firstMatch = channels.find(
                (c) =>
                  !q.trim() ||
                  c.name.toLowerCase().includes(q.toLowerCase()) ||
                  String(c.channelNumber).includes(q)
              );
              if (firstMatch) setSelectedChannelId(firstMatch.id);
            }}
            placeholder="Filter channel..."
            className="h-10 w-48 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
          />
          <label className="text-xs font-semibold text-slate-300">Select Channel:</label>
          <select
            value={currentChannel?.id || ''}
            onChange={(e) => setSelectedChannelId(Number(e.target.value))}
            className="h-10 max-w-xs rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-sm text-white"
          >
            {filteredStreamChannels.map((c) => (
              <option key={c.id} value={c.id}>
                CH {c.channelNumber} — {c.name} ({c.streams.length} streams)
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={sweepRunning}
          onClick={async () => {
            setSweepRunning(true);
            try {
              await apiFetch('/api/admin/streams/check-all', { method: 'POST' });
              load();
            } finally {
              setSweepRunning(false);
            }
          }}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${sweepRunning ? 'animate-spin' : ''}`} />
          <span>{sweepRunning ? 'Probing All HLS Feeds...' : 'Run Full HLS Health Sweep'}</span>
        </button>
      </div>

      {currentChannel && (
        <form
          onSubmit={handleAddStream}
          className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-[#10141E] p-4 md:grid-cols-12"
        >
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Source Label (e.g. CDN Backup 7)"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-3"
          />
          <input
            type="url"
            required
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            placeholder="https://.../playlist.m3u8 (Unlimited streams supported)"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-6"
          />
          <input
            type="number"
            min={1}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            placeholder="Priority"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 font-mono-num text-xs text-white md:col-span-1"
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-white/15 text-xs font-bold text-white hover:bg-white/25 md:col-span-2"
          >
            Add Stream URL
          </button>
        </form>
      )}

      {currentChannel && (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-slate-400">
              <tr>
                <th className="p-3">Priority</th>
                <th className="p-3">Label & HLS Manifest URL</th>
                <th className="p-3">Playable Health</th>
                <th className="p-3">Latency</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {currentChannel.streams.map((s) => (
                <tr key={s.id}>
                  <td className="p-3">
                    <input
                      type="number"
                      min={1}
                      defaultValue={s.priority}
                      onBlur={async (e) => {
                        const nextP = Number(e.target.value);
                        if (nextP !== s.priority) {
                          await apiFetch(`/api/admin/streams/${s.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ priority: nextP }),
                          });
                          load();
                        }
                      }}
                      className="h-8 w-16 rounded border border-white/15 bg-[#0A0D14] px-2 font-mono-num text-white"
                    />
                  </td>
                  <td className="p-3 max-w-md">
                    <p className="font-semibold text-white">{s.label}</p>
                    <p className="truncate font-mono-num text-[11px] text-slate-400">{s.streamUrl}</p>
                    {s.lastError && <p className="mt-0.5 text-[11px] text-red-400">{s.lastError}</p>}
                  </td>
                  <td className="p-3">
                    <span
                      className={`font-semibold capitalize ${
                        s.healthStatus === 'healthy'
                          ? 'text-emerald-400'
                          : s.healthStatus === 'degraded'
                          ? 'text-amber-400'
                          : s.healthStatus === 'offline'
                          ? 'text-red-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {s.healthStatus}
                    </span>
                  </td>
                  <td className="p-3 font-mono-num text-slate-300">
                    {s.responseTimeMs ? `${s.responseTimeMs} ms` : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled={testingId === s.id}
                        onClick={async () => {
                          setTestingId(s.id);
                          try {
                            await apiFetch(`/api/admin/streams/${s.id}/test`, { method: 'POST' });
                            load();
                          } finally {
                            setTestingId(null);
                          }
                        }}
                        className="rounded border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-300 hover:bg-amber-500/20"
                      >
                        {testingId === s.id ? 'Probing...' : 'Test HLS'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/streams/${s.id}`, { method: 'DELETE' });
                          load();
                        }}
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
      )}

      <div className="rounded-xl border border-white/10 bg-[#10141E] p-5">
        <h3 className="border-b border-white/10 pb-3 font-display text-sm font-bold text-white">
          Stream Health & Failover Logs (Hourly Monitor & Manual Probes)
        </h3>
        <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-white/5 text-xs">
          {logs.map((row: any) => (
            <div key={row.log.id} className="flex items-center justify-between gap-4 py-2.5">
              <div className="min-w-0">
                <p className="font-semibold text-white">
                  {row.channelName || `Channel #${row.log.channelId}`} ·{' '}
                  <span className="text-amber-300">{row.streamLabel || `Stream #${row.log.streamId}`}</span> ·{' '}
                  <span className="capitalize">{row.log.eventType.replace('_', ' ')}</span>
                </p>
                <p className="truncate text-slate-400">{row.log.details}</p>
              </div>
              <div className="shrink-0 text-right font-mono-num">
                <p className={row.log.isPlayableHls ? 'text-emerald-400' : 'text-red-400'}>
                  {row.log.previousStatus} → {row.log.newStatus}
                </p>
                <p className="text-[11px] text-slate-500">
                  {row.log.responseTimeMs ? `${row.log.responseTimeMs}ms · ` : ''}
                  {new Date(row.log.checkedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
