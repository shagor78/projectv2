import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2, Upload } from 'lucide-react';
import { apiFetch } from '../../services/api.ts';
import { SitePageRecord, SitePageSection } from '../../types/platform.ts';
import { matchesClientSearch } from '../../utils/search.ts';

export function AdminPageManagement({ navigate }: { navigate: (path: string) => void }) {
  const [pages, setPages] = useState<SitePageRecord[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SitePageRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SitePageRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Page fields
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [heroHeading, setHeroHeading] = useState('');
  const [heroBody, setHeroBody] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');
  const [sections, setSections] = useState<SitePageSection[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setError(null);
    apiFetch<{ pages: SitePageRecord[] }>('/api/admin/pages')
      .then((d) => setPages(d.pages || []))
      .catch((err) => setError(err?.message || 'Failed to load CMS pages'));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setSlug('');
    setSubtitle('');
    setMetaTitle('');
    setMetaDescription('');
    setHeroHeading('');
    setHeroBody('');
    setHeroImageUrl('');
    setIsPublished(true);
    setSortOrder(String(pages.length + 1));
    setSections([
      {
        id: `sec_${Date.now()}`,
        heading: 'Overview',
        body: '',
        sortOrder: 1,
        isVisible: true,
      },
    ]);
    setModalOpen(true);
  };

  const openEdit = (p: SitePageRecord) => {
    setEditing(p);
    setTitle(p.title);
    setSlug(p.slug);
    setSubtitle(p.subtitle || '');
    setMetaTitle(p.metaTitle || '');
    setMetaDescription(p.metaDescription || '');
    setHeroHeading(p.heroHeading || '');
    setHeroBody(p.heroBody || '');
    setHeroImageUrl(p.heroImageUrl || '');
    setIsPublished(p.isPublished);
    setSortOrder(String(p.sortOrder || 0));
    setSections(Array.isArray(p.sectionsJson) ? p.sectionsJson : []);
    setModalOpen(true);
  };

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      {
        id: `sec_${Date.now()}_${prev.length + 1}`,
        heading: 'New Section',
        body: '',
        ctaLabel: '',
        ctaUrl: '',
        sortOrder: prev.length + 1,
        isVisible: true,
      },
    ]);
  };

  const updateSection = (idx: number, patch: Partial<SitePageSection>) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSections(next.map((s, i) => ({ ...s, sortOrder: i + 1 })));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        slug: slug.trim() || undefined,
        subtitle,
        metaTitle: metaTitle || title,
        metaDescription,
        heroHeading: heroHeading || title,
        heroBody,
        heroImageUrl,
        isPublished,
        sortOrder: Number(sortOrder || 0),
        sectionsJson: sections.map((s, i) => ({ ...s, sortOrder: i + 1 })),
      };
      if (editing) {
        await apiFetch(`/api/admin/pages/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/pages', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save CMS page');
    } finally {
      setSaving(false);
    }
  };

  const filtered = pages.filter((p) =>
    matchesClientSearch(search, p.title, [p.slug, p.subtitle])
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search CMS pages by title or slug..."
          className="h-10 w-full rounded-lg border border-white/10 bg-[#10141E] px-3 text-sm text-white sm:w-80"
        />
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" />
          <span>Create Page</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-slate-400">
            <tr>
              <th className="p-3">Page Title</th>
              <th className="p-3">Slug Route</th>
              <th className="p-3">Sections</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02]">
                <td className="p-3">
                  <p className="font-semibold text-white">{p.title}</p>
                  <p className="truncate max-w-xs text-[11px] text-slate-400">{p.subtitle || p.metaTitle}</p>
                </td>
                <td className="p-3 font-mono-num text-amber-300">/page/{p.slug}</td>
                <td className="p-3 font-mono-num text-slate-300">
                  {Array.isArray(p.sectionsJson) ? p.sectionsJson.length : 0} blocks
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/pages/${p.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ isPublished: !p.isPublished }),
                      });
                      load();
                    }}
                    className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                      p.isPublished
                        ? 'border-emerald-500/40 text-emerald-400'
                        : 'border-white/15 text-slate-400'
                    }`}
                  >
                    {p.isPublished ? 'Published' : 'Draft'}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/page/${p.slug}`)}
                      className="inline-flex items-center gap-1 rounded border border-white/15 px-2.5 py-1 text-slate-200 hover:bg-white/10"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="rounded border border-white/15 px-2.5 py-1 text-white hover:bg-white/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
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

      {/* Create / Edit Page Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleSave}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-white">
              {editing ? `Edit CMS Page: ${editing.title}` : 'Create CMS Page'}
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-slate-300">Page Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300">URL Slug (e.g. faq, privacy-policy)</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="auto-generated-from-title"
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 font-mono-num text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-slate-300">Hero Heading</label>
                <input
                  type="text"
                  value={heroHeading}
                  onChange={(e) => setHeroHeading(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300">Subtitle</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300">Hero Lead Text</label>
              <textarea
                rows={2}
                value={heroBody}
                onChange={(e) => setHeroBody(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#0A0D14] p-3 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300">Hero Banner Image URL / Upload (Optional)</label>
              <div className="mt-1 flex items-center gap-2">
                {heroImageUrl && (
                  <img src={heroImageUrl} alt="" className="h-10 w-16 rounded border border-white/10 object-cover" />
                )}
                <input
                  type="text"
                  value={heroImageUrl}
                  onChange={(e) => setHeroImageUrl(e.target.value)}
                  className="h-10 flex-1 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                />
                <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 text-xs text-white">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const fd = new FormData();
                      fd.append('file', f);
                      const res = await apiFetch('/api/admin/upload', { method: 'POST', body: fd });
                      setHeroImageUrl(res.url);
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-slate-300">SEO Meta Title</label>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300">SEO Meta Description</label>
                <input
                  type="text"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                />
              </div>
            </div>

            {/* Dynamic Sections Builder */}
            <div className="rounded-xl border border-white/10 bg-[#0A0D14] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-amber-300">
                  Page Content Sections ({sections.length})
                </h4>
                <button
                  type="button"
                  onClick={addSection}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Section</span>
                </button>
              </div>

              {sections.map((sec, idx) => (
                <div key={sec.id} className="rounded-lg border border-white/10 bg-[#10141E] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-num text-[11px] font-bold text-amber-400">
                      Section #{idx + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <label className="flex items-center gap-1 text-[11px] text-slate-300 mr-2">
                        <input
                          type="checkbox"
                          checked={sec.isVisible}
                          onChange={(e) => updateSection(idx, { isVisible: e.target.checked })}
                          className="accent-amber-500"
                        />
                        Visible
                      </label>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSection(idx, -1)}
                        className="rounded p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === sections.length - 1}
                        onClick={() => moveSection(idx, 1)}
                        className="rounded p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSections((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded p-1 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={sec.heading}
                    onChange={(e) => updateSection(idx, { heading: e.target.value })}
                    placeholder="Section Heading"
                    className="h-9 w-full rounded border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                  />
                  <textarea
                    rows={3}
                    value={sec.body}
                    onChange={(e) => updateSection(idx, { body: e.target.value })}
                    placeholder="Section paragraph content..."
                    className="w-full rounded border border-white/15 bg-[#0A0D14] p-2.5 text-xs text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={sec.ctaLabel || ''}
                      onChange={(e) => updateSection(idx, { ctaLabel: e.target.value })}
                      placeholder="CTA Label (optional)"
                      className="h-8 rounded border border-white/15 bg-[#0A0D14] px-2.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={sec.ctaUrl || ''}
                      onChange={(e) => updateSection(idx, { ctaUrl: e.target.value })}
                      placeholder="CTA Link (/plans)"
                      className="h-8 rounded border border-white/15 bg-[#0A0D14] px-2.5 text-xs text-white"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>Published on Storefront</span>
              </label>

              <div className="flex gap-2">
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
                  {saving ? 'Saving...' : 'Save Page'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-white">Delete CMS Page?</h3>
            <p className="text-xs text-slate-300">
              Delete <span className="font-semibold text-white">{deleteTarget.title}</span> (/page/{deleteTarget.slug})?
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
                  await apiFetch(`/api/admin/pages/${deleteTarget.id}`, { method: 'DELETE' });
                  setDeleteTarget(null);
                  load();
                }}
                className="h-9 rounded-lg bg-red-500 px-4 text-xs font-bold text-white"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
