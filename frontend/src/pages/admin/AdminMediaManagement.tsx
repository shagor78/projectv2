import React, { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw, Replace, Trash2, Upload } from 'lucide-react';
import { apiFetch } from '../../services/api.ts';
import { MediaAssetItem } from '../../types/platform.ts';
import { matchesClientSearch } from '../../utils/search.ts';

export function AdminMediaManagement() {
  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'uploads' | 'builtin' | 'unused'>('all');
  const [search, setSearch] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<MediaAssetItem | null>(null);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MediaAssetItem | null>(null);
  const [forceDelete, setForceDelete] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    apiFetch<{ assets: MediaAssetItem[] }>('/api/admin/media')
      .then((d) => setAssets(d.assets || []))
      .catch((err) => setError(err?.message || 'Failed to scan media library'));
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setStatusMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch<{ url: string }>('/api/admin/upload', { method: 'POST', body: fd });
      setStatusMsg(`Uploaded ${res.url}`);
      load();
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceTarget || !newUrlInput.trim()) return;
    setError(null);
    try {
      const res = await apiFetch<{ replacedRefs: number }>('/api/admin/media/replace', {
        method: 'POST',
        body: JSON.stringify({ oldUrl: replaceTarget.url, newUrl: newUrlInput.trim() }),
      });
      setStatusMsg(`Replaced ${res.replacedRefs} database references from ${replaceTarget.filename}`);
      setReplaceTarget(null);
      setNewUrlInput('');
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to replace media references');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await apiFetch(
        `/api/admin/media/${encodeURIComponent(deleteTarget.filename)}?force=${forceDelete ? 'true' : 'false'}`,
        { method: 'DELETE' }
      );
      setStatusMsg(`Deleted ${deleteTarget.filename}`);
      setDeleteTarget(null);
      setForceDelete(false);
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete file');
    }
  };

  const filtered = assets.filter((a) => {
    const matchesSearch = matchesClientSearch(search, a.filename, [a.source, a.usedBy || []]);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'uploads' && a.source === 'uploads') ||
      (filter === 'builtin' && a.source === 'builtin') ||
      (filter === 'unused' && a.usedBy.length === 0);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>
      )}
      {statusMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          {statusMsg}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter images or references..."
            className="h-10 w-64 rounded-lg border border-white/10 bg-[#10141E] px-3 text-xs text-white"
          />
          {(['all', 'uploads', 'builtin', 'unused'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize ${
                filter === f
                  ? 'bg-amber-500 text-slate-950'
                  : 'border border-white/10 bg-[#10141E] text-slate-300 hover:bg-white/5'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/15 bg-[#10141E] px-3 text-xs text-slate-200 hover:bg-white/5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Rescan</span>
          </button>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400">
            <Upload className="h-4 w-4" />
            <span>{uploading ? 'Uploading...' : 'Upload New Asset'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((asset) => (
          <div
            key={asset.url}
            className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#10141E]"
          >
            <div className="relative h-40 bg-black/50">
              <img src={asset.url} alt={asset.filename} className="h-full w-full object-cover" />
              <span
                className={`absolute left-2 top-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                  asset.source === 'uploads'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900/85 text-slate-200 border border-white/15'
                }`}
              >
                {asset.source}
              </span>
              <span className="absolute right-2 top-2 rounded bg-black/75 px-2 py-0.5 font-mono-num text-[10px] text-slate-300">
                {(asset.sizeBytes / 1024).toFixed(1)} KB
              </span>
            </div>

            <div className="flex flex-1 flex-col justify-between p-3.5 space-y-3">
              <div>
                <p className="truncate font-mono-num text-xs font-semibold text-white">{asset.filename}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {asset.usedBy.length > 0 ? (
                    <span className="text-emerald-400 font-medium">
                      Used by {asset.usedBy.length} item(s): {asset.usedBy.slice(0, 2).join(', ')}
                    </span>
                  ) : (
                    <span className="text-slate-500">Unused in catalog</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(asset.url);
                    setCopiedUrl(asset.url);
                    setTimeout(() => setCopiedUrl(null), 1500);
                  }}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded border border-white/15 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  {copiedUrl === asset.url ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedUrl === asset.url ? 'Copied' : 'Copy URL'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplaceTarget(asset);
                    setNewUrlInput(asset.url);
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded border border-amber-400/40 bg-amber-500/10 px-2.5 text-[11px] text-amber-300 hover:bg-amber-500/20"
                  title="Replace references in DB"
                >
                  <Replace className="h-3 w-3" />
                  <span>Replace</span>
                </button>
                {asset.source === 'uploads' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(asset);
                      setForceDelete(asset.usedBy.length === 0);
                    }}
                    className="inline-flex h-8 items-center justify-center rounded border border-red-500/30 px-2 text-red-400 hover:bg-red-500/10"
                    title="Delete uploaded file"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Replace Asset URL Across DB Modal */}
      {replaceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleReplace}
            className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-white">Replace Image URL Across Catalog</h3>
            <p className="text-xs text-slate-400">
              Old URL: <span className="font-mono-num text-amber-300">{replaceTarget.url}</span>
            </p>
            <div>
              <label className="block text-xs text-slate-300">New Image URL</label>
              <input
                type="text"
                required
                value={newUrlInput}
                onChange={(e) => setNewUrlInput(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 font-mono-num text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReplaceTarget(null)}
                className="h-9 rounded-lg border border-white/15 px-4 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded-lg bg-amber-500 px-5 text-xs font-bold text-slate-950"
              >
                Update DB References
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete File Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-white">Delete Uploaded File?</h3>
            <p className="text-xs text-slate-300">
              File: <span className="font-mono-num text-white">{deleteTarget.filename}</span>
            </p>
            {deleteTarget.usedBy.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-2">
                <p>Currently referenced by {deleteTarget.usedBy.length} item(s):</p>
                <p className="text-[11px] text-amber-100">{deleteTarget.usedBy.join(', ')}</p>
                <label className="flex items-center gap-2 font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={forceDelete}
                    onChange={(e) => setForceDelete(e.target.checked)}
                    className="accent-amber-500"
                  />
                  <span>Force delete anyway</span>
                </label>
              </div>
            )}
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
                disabled={deleteTarget.usedBy.length > 0 && !forceDelete}
                onClick={handleDelete}
                className="h-9 rounded-lg bg-red-500 px-4 text-xs font-bold text-white disabled:opacity-40"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
