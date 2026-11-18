import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { useSiteConfig } from '../../context/SiteConfigContext.tsx';
import { apiFetch } from '../../services/api.ts';
import { NavigationItemRecord } from '../../types/platform.ts';

export function AdminNavigationManagement() {
  const { refreshSiteConfig } = useSiteConfig();
  const [items, setItems] = useState<NavigationItemRecord[]>([]);
  const [locationFilter, setLocationFilter] = useState<'all' | 'header' | 'footer' | 'footer_membership'>('header');
  const [editing, setEditing] = useState<NavigationItemRecord | null>(null);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [location, setLocation] = useState<'header' | 'footer' | 'footer_membership'>('header');
  const [badgeText, setBadgeText] = useState('');
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const d = await apiFetch<{ items: NavigationItemRecord[] }>('/api/admin/navigation');
      setItems(d.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load navigation menu');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setLabel('');
    setUrl('');
    setLocation(locationFilter === 'all' ? 'header' : locationFilter);
    setBadgeText('');
    setOpenInNewTab(false);
    setIsVisible(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        label,
        url,
        location,
        badgeText: badgeText.trim() || null,
        openInNewTab,
        isVisible,
        sortOrder: editing ? editing.sortOrder : items.filter((i) => i.location === location).length + 1,
      };
      if (editing) {
        await apiFetch(`/api/admin/navigation/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/navigation', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      await load();
      await refreshSiteConfig();
    } catch (err: any) {
      setError(err?.message || 'Failed to save navigation link');
    }
  };

  const visibleItems = items.filter((i) => locationFilter === 'all' || i.location === locationFilter);

  const moveItem = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= visibleItems.length) return;
    const reordered = [...visibleItems];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    await apiFetch('/api/admin/navigation/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds: reordered.map((r) => r.id) }),
    });
    await load();
    await refreshSiteConfig();
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>
      )}

      {/* Location Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'header' as const, label: 'Header Menu' },
          { key: 'footer' as const, label: 'Footer Platform Links' },
          { key: 'footer_membership' as const, label: 'Footer Membership & Legal' },
          { key: 'all' as const, label: 'All Locations' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setLocationFilter(tab.key);
              if (tab.key !== 'all') setLocation(tab.key);
            }}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              locationFilter === tab.key
                ? 'bg-amber-500 text-slate-950'
                : 'border border-white/15 bg-[#10141E] text-slate-300 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Add / Edit Navigation Form */}
      <form
        onSubmit={handleSave}
        className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-[#10141E] p-4 md:grid-cols-12"
      >
        <input
          type="text"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Menu Label (e.g. FAQ, Live TV)"
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-3"
        />
        <input
          type="text"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL (/live-tv, /page/faq, https://...)"
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 font-mono-num text-xs text-white md:col-span-3"
        />
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value as any)}
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
        >
          <option value="header">Header</option>
          <option value="footer">Footer Platform</option>
          <option value="footer_membership">Footer Membership</option>
        </select>
        <input
          type="text"
          value={badgeText}
          onChange={(e) => setBadgeText(e.target.value)}
          placeholder="Badge (optional)"
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
        />
        <div className="flex items-center gap-2 md:col-span-2">
          <button
            type="submit"
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400"
          >
            {editing ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{editing ? 'Update' : 'Add Link'}</span>
          </button>
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="h-10 rounded-lg border border-white/15 px-3 text-xs text-slate-300"
            >
              Cancel
            </button>
          )}
        </div>
        <div className="flex items-center gap-5 text-xs text-slate-300 md:col-span-12">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="accent-amber-500"
            />
            <span>Visible in Storefront</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={openInNewTab}
              onChange={(e) => setOpenInNewTab(e.target.checked)}
              className="accent-amber-500"
            />
            <span>Open in New Tab</span>
          </label>
        </div>
      </form>

      {/* Menu Items Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-slate-400">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Label</th>
              <th className="p-3">Target URL</th>
              <th className="p-3">Location</th>
              <th className="p-3">Visibility</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visibleItems.map((item, idx) => (
              <tr key={item.id} className="hover:bg-white/[0.02]">
                <td className="p-3">
                  {locationFilter !== 'all' ? (
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, -1)}
                        className="rounded p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === visibleItems.length - 1}
                        onClick={() => moveItem(idx, 1)}
                        className="rounded p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-mono-num text-slate-500">#{item.sortOrder}</span>
                  )}
                </td>
                <td className="p-3 font-semibold text-white">
                  {item.label}
                  {item.badgeText && (
                    <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                      {item.badgeText}
                    </span>
                  )}
                </td>
                <td className="p-3 font-mono-num text-amber-300">{item.url}</td>
                <td className="p-3 capitalize text-slate-300">{item.location.replace('_', ' ')}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/navigation/${item.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ isVisible: !item.isVisible }),
                      });
                      await load();
                      await refreshSiteConfig();
                    }}
                    className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                      item.isVisible
                        ? 'border-emerald-500/40 text-emerald-400'
                        : 'border-white/15 text-slate-400'
                    }`}
                  >
                    {item.isVisible ? 'Visible' : 'Hidden'}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(item);
                        setLabel(item.label);
                        setUrl(item.url);
                        setLocation(item.location);
                        setBadgeText(item.badgeText || '');
                        setOpenInNewTab(item.openInNewTab);
                        setIsVisible(item.isVisible);
                      }}
                      className="rounded border border-white/15 px-2.5 py-1 text-white hover:bg-white/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/navigation/${item.id}`, { method: 'DELETE' });
                        await load();
                        await refreshSiteConfig();
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
    </div>
  );
}
