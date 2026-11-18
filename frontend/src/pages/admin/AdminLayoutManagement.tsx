import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  Eye,
  FolderTree,
  GripVertical,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { HeroSlider } from '../../components/HeroSlider.tsx';
import { apiFetch } from '../../services/api.ts';
import {
  ChannelCategory,
  ContentItem,
  HeroSlide,
  HomepageSection,
  LiveChannel,
  PageHeroSlider,
} from '../../types/platform.ts';

type LayoutTab = 'homepage' | 'hero' | 'categories' | 'placements';

const PAGE_SLIDER_KEYS: Array<{ key: string; label: string }> = [
  { key: 'home', label: 'Home Page' },
  { key: 'live_tv', label: 'Live TV Page' },
  { key: 'movies', label: 'Movies Page' },
  { key: 'drama', label: 'Drama Page' },
  { key: 'series', label: 'Web Series Page' },
  { key: 'sports', label: 'Sports Page' },
];

const PLACEMENT_KEYS: Array<{ key: string; label: string; defaultTarget: 'channel' | 'content' }> = [
  { key: 'homepage_live', label: 'Homepage Live TV Highlights', defaultTarget: 'channel' },
  { key: 'popular_channels', label: 'Popular Live Channels', defaultTarget: 'channel' },
  { key: 'news_desk', label: 'News Channels Section', defaultTarget: 'channel' },
  { key: 'sports_bar', label: 'Sports Live Channels', defaultTarget: 'channel' },
  { key: 'trending', label: 'Trending Movies / VOD', defaultTarget: 'content' },
  { key: 'recently_added', label: 'Latest / Recently Added', defaultTarget: 'content' },
  { key: 'bangla_entertainment', label: 'Bangla Entertainment', defaultTarget: 'content' },
  { key: 'international_entertainment', label: 'International Entertainment', defaultTarget: 'content' },
  { key: 'kids_family', label: 'Kids & Family', defaultTarget: 'content' },
];

export function AdminLayoutManagement({ initialTab = 'homepage' }: { initialTab?: LayoutTab }) {
  const [activeTab, setActiveTab] = useState<LayoutTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        {[
          { key: 'homepage' as LayoutTab, label: 'Homepage Builder', icon: LayoutGrid },
          { key: 'hero' as LayoutTab, label: 'Hero Slider Manager', icon: ImageIcon },
          { key: 'categories' as LayoutTab, label: 'Live TV Category Manager', icon: FolderTree },
          { key: 'placements' as LayoutTab, label: 'Content & Channel Placements', icon: Layers },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-amber-500 text-slate-950'
                : 'border border-white/10 bg-[#10141E] text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'homepage' && <HomepageBuilderTab />}
      {activeTab === 'hero' && <HeroSliderManagerTab />}
      {activeTab === 'categories' && <LiveTvCategoryManagerTab />}
      {activeTab === 'placements' && <PlacementManagerTab />}
    </div>
  );
}

function HomepageBuilderTab() {
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [allChannels, setAllChannels] = useState<LiveChannel[]>([]);
  const [allContents, setAllContents] = useState<ContentItem[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [editingSec, setEditingSec] = useState<HomepageSection | null>(null);
  const [itemsModalSec, setItemsModalSec] = useState<HomepageSection | null>(null);
  const [previewData, setPreviewData] = useState<any[] | null>(null);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [sectionType, setSectionType] = useState<string>('movies');
  const [layoutStyle, setLayoutStyle] = useState<string>('rail');
  const [selectionMode, setSelectionMode] = useState<string>('auto');
  const [placementKey, setPlacementKey] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [viewAllLink, setViewAllLink] = useState('');
  const [maxItems, setMaxItems] = useState('10');
  const [showRibbon, setShowRibbon] = useState(false);

  const [assignedDraft, setAssignedDraft] = useState<
    Array<{ contentId?: number | null; channelId?: number | null; label: string; kind: string }>
  >([]);
  const [itemSearch, setItemSearch] = useState('');

  const load = () => {
    Promise.all([
      apiFetch('/api/admin/homepage-sections'),
      apiFetch('/api/admin/channels'),
      apiFetch('/api/admin/contents'),
    ]).then(([secData, chData, coData]) => {
      setSections(secData.sections || []);
      setAllChannels(chData.channels || []);
      setAllContents(coData.contents || []);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingSec(null);
    setTitle('');
    setSubtitle('');
    setSectionType('movies');
    setLayoutStyle('rail');
    setSelectionMode('auto');
    setPlacementKey('');
    setCategoryFilter('');
    setLanguageFilter('');
    setContentTypeFilter('');
    setViewAllLink('');
    setMaxItems('10');
    setShowRibbon(false);
  };

  const startEdit = (sec: HomepageSection) => {
    setEditingSec(sec);
    setTitle(sec.title);
    setSubtitle(sec.subtitle || '');
    setSectionType(sec.sectionType);
    setLayoutStyle(sec.layoutStyle || 'rail');
    setSelectionMode(sec.selectionMode || 'auto');
    setPlacementKey(sec.placementKey || '');
    setCategoryFilter(sec.categoryFilter || '');
    setLanguageFilter(sec.languageFilter || '');
    setContentTypeFilter(sec.contentTypeFilter || '');
    setViewAllLink(sec.viewAllLink || '');
    setMaxItems(String(sec.maxItems || 10));
    setShowRibbon(Boolean(sec.showRecentlyAddedRibbon));
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title,
      subtitle,
      sectionType,
      layoutStyle,
      selectionMode,
      placementKey,
      categoryFilter,
      languageFilter,
      contentTypeFilter,
      viewAllLink,
      showRecentlyAddedRibbon: showRibbon,
      maxItems: Number(maxItems || 10),
    };
    if (editingSec) {
      await apiFetch(`/api/admin/homepage-sections/${editingSec.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/api/admin/homepage-sections', {
        method: 'POST',
        body: JSON.stringify({ ...payload, sortOrder: sections.length + 1 }),
      });
    }
    resetForm();
    load();
  };

  const handleDrop = async (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    const list = [...sections];
    const from = list.findIndex((s) => s.id === dragId);
    const to = list.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setSections(list);
    setDragId(null);
    await apiFetch('/api/admin/homepage-sections/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds: list.map((s) => s.id) }),
    });
  };

  const openItemsModal = (sec: HomepageSection) => {
    setItemsModalSec(sec);
    setItemSearch('');
    const chMap = new Map(allChannels.map((c) => [c.id, c]));
    const coMap = new Map(allContents.map((c) => [c.id, c]));
    const draft = (sec.assignedItems || [])
      .map((a) => {
        if (a.channelId && chMap.has(a.channelId)) {
          const ch = chMap.get(a.channelId)!;
          return { channelId: ch.id, label: `CH ${ch.channelNumber} · ${ch.name}`, kind: 'Live Channel' };
        }
        if (a.contentId && coMap.has(a.contentId)) {
          const co = coMap.get(a.contentId)!;
          return { contentId: co.id, label: `${co.title} (${co.language})`, kind: co.contentType };
        }
        return null;
      })
      .filter(Boolean) as Array<{ contentId?: number | null; channelId?: number | null; label: string; kind: string }>;
    setAssignedDraft(draft);
  };

  const handleSaveAssignedItems = async () => {
    if (!itemsModalSec) return;
    await apiFetch(`/api/admin/homepage-sections/${itemsModalSec.id}/items`, {
      method: 'PUT',
      body: JSON.stringify({
        items: assignedDraft.map((d) => ({
          contentId: d.contentId || null,
          channelId: d.channelId || null,
        })),
      }),
    });
    setItemsModalSec(null);
    load();
  };

  const loadLivePreview = async () => {
    const res = await apiFetch('/api/home');
    setPreviewData(res.sections || []);
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSaveSection}
        className="space-y-3 rounded-xl border border-white/10 bg-[#10141E] p-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-white">
            {editingSec ? `Editing Section: ${editingSec.title}` : 'Create Homepage Section'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadLivePreview}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/10"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Preview Live Feed</span>
            </button>
            {editingSec && (
              <button
                type="button"
                onClick={resetForm}
                className="h-8 rounded-lg border border-white/15 px-3 text-xs text-slate-300"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Section Title (e.g. Weekend Blockbusters)"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-3"
          />
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Subtitle / Tagline"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-3"
          />
          <select
            value={sectionType}
            onChange={(e) => setSectionType(e.target.value)}
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-3"
          >
            <option value="continue_watching">Continue Watching</option>
            <option value="latest_content">Latest Content (All Types)</option>
            <option value="live_channels">Live TV Channels</option>
            <option value="news_channels">News Channels (Strict)</option>
            <option value="movies">Movies</option>
            <option value="drama">Drama</option>
            <option value="series">Web Series</option>
            <option value="sports">Sports</option>
            <option value="bangla_entertainment">Bangla Entertainment</option>
            <option value="international_entertainment">International Entertainment</option>
            <option value="kids_family">Kids & Family</option>
            <option value="recommended">Recommended For You</option>
            <option value="recently_added">Recently Added</option>
            <option value="featured">Featured Picks</option>
            <option value="custom">Custom Dynamic Section</option>
          </select>
          <select
            value={selectionMode}
            onChange={(e) => setSelectionMode(e.target.value)}
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-3"
          >
            <option value="auto">Mode: Auto Query</option>
            <option value="manual">Mode: Manual Picked Only</option>
            <option value="hybrid">Mode: Manual First + Auto Fill</option>
          </select>

          <select
            value={layoutStyle}
            onChange={(e) => setLayoutStyle(e.target.value)}
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
          >
            <option value="rail">Layout: 5-Card VOD Rail</option>
            <option value="channel_cards">Layout: IPTV Channel Cards</option>
            <option value="circle_rail">Layout: Circular Discs</option>
            <option value="continue_watching">Layout: Continue Watching</option>
          </select>
          <input
            type="text"
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            placeholder="Language Filter (Bangla, English, Hindi...)"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-3"
          />
          <input
            type="text"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            placeholder="Category Slug Filter (optional)"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
          />
          <input
            type="text"
            value={placementKey}
            onChange={(e) => setPlacementKey(e.target.value)}
            placeholder="Placement Key (trending...)"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
          />
          <input
            type="text"
            value={viewAllLink}
            onChange={(e) => setViewAllLink(e.target.value)}
            placeholder="View All Link (/movies)"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
          />
          <input
            type="number"
            min={1}
            max={30}
            value={maxItems}
            onChange={(e) => setMaxItems(e.target.value)}
            title="Max items"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 font-mono-num text-xs text-white md:col-span-1"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={showRibbon}
              onChange={(e) => setShowRibbon(e.target.checked)}
              className="accent-amber-500"
            />
            <span>Force "Recently Added" Bottom Ribbon on Cards</span>
          </label>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-5 text-xs font-bold text-slate-950 hover:bg-amber-400"
          >
            {editingSec ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{editingSec ? 'Save Section Changes' : 'Add Section'}</span>
          </button>
        </div>
      </form>

      <p className="text-xs text-slate-400">
        Drag rows to reorder Homepage sections, toggle visibility, or assign manual items. All changes invalidate storefront cache immediately.
      </p>

      <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-[#10141E]">
        {sections.map((sec) => (
          <div
            key={sec.id}
            draggable
            onDragStart={() => setDragId(sec.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(sec.id)}
            className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-500" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-display text-sm font-bold text-white">{sec.title}</p>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono-num text-[10px] text-slate-300">
                    {sec.selectionMode || 'auto'}
                  </span>
                  {sec.languageFilter && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                      {sec.languageFilter}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-400">
                  Type: {sec.sectionType.replace(/_/g, ' ')} · Layout: {sec.layoutStyle || 'rail'} · Max{' '}
                  {sec.maxItems} items · Manual Items: {sec.assignedItems?.length || 0}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openItemsModal(sec)}
                className="rounded border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
              >
                Assign Items ({sec.assignedItems?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => startEdit(sec)}
                className="rounded border border-white/15 px-2.5 py-1 text-xs text-white hover:bg-white/10"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={async () => {
                  await apiFetch(`/api/admin/homepage-sections/${sec.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ isActive: !sec.isActive }),
                  });
                  load();
                }}
                className={`rounded border px-2.5 py-1 text-xs font-semibold ${
                  sec.isActive
                    ? 'border-emerald-500/40 text-emerald-400'
                    : 'border-white/15 text-slate-400'
                }`}
              >
                {sec.isActive ? 'Visible' : 'Hidden'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await apiFetch(`/api/admin/homepage-sections/${sec.id}`, { method: 'DELETE' });
                  load();
                }}
                className="rounded border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-lg font-bold text-white">
                Homepage Live Feed Preview ({previewData.length} Active Sections)
              </h3>
              <button type="button" onClick={() => setPreviewData(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {previewData.map((sec: any, idx: number) => (
                <div key={sec.id} className="rounded-xl border border-white/10 bg-[#0A0D14] p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-sm font-bold text-white">
                      {idx + 1}. {sec.title}
                    </p>
                    <span className="font-mono-num text-xs text-amber-300">
                      {sec.items?.length || 0} resolved items
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {(sec.items || []).map((i: any) => i.title || i.name).join(' · ') || 'No items (hidden when empty)'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {itemsModalSec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Manual Items — {itemsModalSec.title}
                </h3>
                <p className="text-xs text-slate-400">
                  Selection Mode: <span className="text-amber-300 font-semibold">{itemsModalSec.selectionMode || 'auto'}</span> (Switch mode to "Manual" or "Hybrid" to display assigned order)
                </p>
              </div>
              <button type="button" onClick={() => setItemsModalSec(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-white/10 bg-[#0A0D14] p-3">
                <input
                  type="search"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search channels or VOD titles..."
                  className="h-9 w-full rounded-lg border border-white/15 bg-[#10141E] px-3 text-xs text-white"
                />
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  {allChannels
                    .filter((ch) => !itemSearch.trim() || ch.name.toLowerCase().includes(itemSearch.toLowerCase()))
                    .map((ch) => {
                      const exists = assignedDraft.some((d) => d.channelId === ch.id);
                      return (
                        <button
                          key={`ch-${ch.id}`}
                          type="button"
                          disabled={exists}
                          onClick={() =>
                            setAssignedDraft((prev) => [
                              ...prev,
                              { channelId: ch.id, label: `CH ${ch.channelNumber} · ${ch.name}`, kind: 'Live Channel' },
                            ])
                          }
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-200 hover:bg-white/5 disabled:opacity-40"
                        >
                          <span className="truncate">
                            [Live] CH {ch.channelNumber} · {ch.name} ({ch.language})
                          </span>
                          <span className="text-amber-400 font-semibold">{exists ? 'Added' : '+ Add'}</span>
                        </button>
                      );
                    })}
                  {allContents
                    .filter((co) => !itemSearch.trim() || co.title.toLowerCase().includes(itemSearch.toLowerCase()))
                    .map((co) => {
                      const exists = assignedDraft.some((d) => d.contentId === co.id);
                      return (
                        <button
                          key={`co-${co.id}`}
                          type="button"
                          disabled={exists}
                          onClick={() =>
                            setAssignedDraft((prev) => [
                              ...prev,
                              { contentId: co.id, label: `${co.title} (${co.language})`, kind: co.contentType },
                            ])
                          }
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-200 hover:bg-white/5 disabled:opacity-40"
                        >
                          <span className="truncate">
                            [{co.contentType}] {co.title} ({co.language})
                          </span>
                          <span className="text-amber-400 font-semibold">{exists ? 'Added' : '+ Add'}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-white/10 bg-[#0A0D14] p-3">
                <p className="text-xs font-semibold text-slate-300">
                  Assigned Order ({assignedDraft.length})
                </p>
                <div className="max-h-72 space-y-1.5 overflow-y-auto">
                  {assignedDraft.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-500">
                      Click items on the left to assign them to this section.
                    </p>
                  ) : (
                    assignedDraft.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#10141E] px-2.5 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono-num text-amber-400 mr-1.5">#{idx + 1}</span>
                          <span className="truncate font-semibold text-white">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              const next = [...assignedDraft];
                              [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                              setAssignedDraft(next);
                            }}
                            className="rounded p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === assignedDraft.length - 1}
                            onClick={() => {
                              const next = [...assignedDraft];
                              [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                              setAssignedDraft(next);
                            }}
                            className="rounded p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAssignedDraft((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="rounded p-1 text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => setItemsModalSec(null)}
                className="h-9 rounded-lg border border-white/15 px-4 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAssignedItems}
                className="h-9 rounded-lg bg-amber-500 px-5 text-xs font-bold text-slate-950"
              >
                Save Section Items
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeroSliderManagerTab() {
  const [selectedPageKey, setSelectedPageKey] = useState('home');
  const [sliders, setSliders] = useState<PageHeroSlider[]>([]);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [badgeText, setBadgeText] = useState('Featured');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [languageLabel, setLanguageLabel] = useState('');
  const [imageUrl, setImageUrl] = useState('/src/assets/images/hero_midnight_meridian_1794748093840.jpg');
  const [tabletImageUrl, setTabletImageUrl] = useState('');
  const [mobileImageUrl, setMobileImageUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Watch Now');
  const [ctaLink, setCtaLink] = useState('/movies');
  const [secondaryCtaLabel, setSecondaryCtaLabel] = useState('More Info');
  const [secondaryCtaLink, setSecondaryCtaLink] = useState('');
  const [contentId, setContentId] = useState<string>('');
  const [channelId, setChannelId] = useState<string>('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const [autoplay, setAutoplay] = useState(true);
  const [slideDurationMs, setSlideDurationMs] = useState('6500');
  const [sliderActive, setSliderActive] = useState(true);

  const load = (page = selectedPageKey) => {
    Promise.all([
      apiFetch('/api/admin/hero-sliders'),
      apiFetch(`/api/admin/hero-slides?pageKey=${page}`),
      apiFetch('/api/admin/channels'),
      apiFetch('/api/admin/contents'),
    ]).then(([slData, itemData, chData, coData]) => {
      const slList: PageHeroSlider[] = slData.sliders || [];
      setSliders(slList);
      setSlides(itemData.slides || []);
      setChannels(chData.channels || []);
      setContents(coData.contents || []);
      const cur = slList.find((s) => s.pageKey === page);
      if (cur) {
        setAutoplay(cur.autoplay);
        setSlideDurationMs(String(cur.slideDurationMs));
        setSliderActive(cur.isActive);
      }
    });
  };

  useEffect(() => {
    load(selectedPageKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageKey]);

  const uploadBanner = async (file: File, setter: (url: string) => void) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiFetch('/api/admin/upload', { method: 'POST', body: fd });
    setter(res.url);
  };

  const resetSlideForm = () => {
    setEditingSlide(null);
    setTitle('');
    setSubtitle('');
    setBadgeText(selectedPageKey === 'live_tv' ? 'LIVE NOW' : 'Featured');
    setCategoryLabel('');
    setLanguageLabel('');
    setImageUrl('/src/assets/images/hero_midnight_meridian_1794748093840.jpg');
    setTabletImageUrl('');
    setMobileImageUrl('');
    setCtaLabel(selectedPageKey === 'live_tv' ? 'Watch Live' : 'Watch Now');
    setCtaLink(selectedPageKey === 'live_tv' ? '/live-tv' : '/movies');
    setSecondaryCtaLabel('More Info');
    setSecondaryCtaLink('');
    setContentId('');
    setChannelId('');
    setStartsAt('');
    setEndsAt('');
  };

  const startEditSlide = (s: HeroSlide) => {
    setEditingSlide(s);
    setTitle(s.title);
    setSubtitle(s.subtitle || '');
    setBadgeText(s.badgeText || '');
    setCategoryLabel(s.categoryLabel || '');
    setLanguageLabel(s.languageLabel || '');
    setImageUrl(s.imageUrl);
    setTabletImageUrl(s.tabletImageUrl || '');
    setMobileImageUrl(s.mobileImageUrl || '');
    setCtaLabel(s.ctaLabel);
    setCtaLink(s.ctaLink);
    setSecondaryCtaLabel(s.secondaryCtaLabel || '');
    setSecondaryCtaLink(s.secondaryCtaLink || '');
    setContentId(s.contentId ? String(s.contentId) : '');
    setChannelId(s.channelId ? String(s.channelId) : '');
    setStartsAt(s.startsAt ? String(s.startsAt).slice(0, 16) : '');
    setEndsAt(s.endsAt ? String(s.endsAt).slice(0, 16) : '');
  };

  const handleLinkContent = (idStr: string) => {
    setContentId(idStr);
    if (idStr) {
      setChannelId('');
      const co = contents.find((c) => c.id === Number(idStr));
      if (co) {
        setTitle(co.title);
        setSubtitle(co.synopsis);
        setCategoryLabel(co.contentType.toUpperCase());
        setLanguageLabel(co.language);
        if (co.backdropUrl || co.posterUrl) setImageUrl(co.backdropUrl || co.posterUrl);
        setCtaLabel('Watch Now');
        setCtaLink(`/title/${co.slug}`);
        setSecondaryCtaLabel('More Info');
        setSecondaryCtaLink(`/title/${co.slug}`);
      }
    }
  };

  const handleLinkChannel = (idStr: string) => {
    setChannelId(idStr);
    if (idStr) {
      setContentId('');
      const ch = channels.find((c) => c.id === Number(idStr));
      if (ch) {
        setTitle(ch.name);
        setSubtitle(ch.description || `Live broadcast on CH ${ch.channelNumber}`);
        setBadgeText('LIVE NOW');
        setCategoryLabel(ch.categories?.[0]?.name || 'Live TV');
        setLanguageLabel(ch.language);
        setCtaLabel('Watch Live');
        setCtaLink(`/live-tv?channel=${ch.slug}`);
        setSecondaryCtaLabel('Channel Guide');
        setSecondaryCtaLink('/live-tv');
      }
    }
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      pageKey: selectedPageKey,
      title,
      subtitle,
      badgeText,
      categoryLabel,
      languageLabel,
      imageUrl,
      tabletImageUrl,
      mobileImageUrl,
      ctaLabel,
      ctaLink,
      secondaryCtaLabel,
      secondaryCtaLink,
      contentId: contentId ? Number(contentId) : null,
      channelId: channelId ? Number(channelId) : null,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
    };
    if (editingSlide) {
      await apiFetch(`/api/admin/hero-slides/${editingSlide.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/api/admin/hero-slides', {
        method: 'POST',
        body: JSON.stringify({ ...payload, sortOrder: slides.length + 1 }),
      });
    }
    resetSlideForm();
    load(selectedPageKey);
  };

  const handleDrop = async (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    const list = [...slides];
    const from = list.findIndex((s) => s.id === dragId);
    const to = list.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setSlides(list);
    setDragId(null);
    await apiFetch('/api/admin/hero-slides/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds: list.map((s) => s.id) }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PAGE_SLIDER_KEYS.map((p) => {
            const count = sliders.find((s: any) => s.pageKey === p.key)?.slideCount;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setSelectedPageKey(p.key);
                  setEditingSlide(null);
                }}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  selectedPageKey === p.key
                    ? 'bg-amber-500 text-slate-950'
                    : 'border border-white/15 bg-[#10141E] text-slate-300 hover:bg-white/5'
                }`}
              >
                {p.label} {count !== undefined ? `(${count})` : ''}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Preview {selectedPageKey.replace('_', ' ')} Slider</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#10141E] p-4">
        <div className="flex flex-wrap items-center gap-5 text-xs text-slate-300">
          <span className="inline-flex items-center gap-1.5 font-semibold text-white">
            <SlidersHorizontal className="h-4 w-4 text-amber-400" />
            <span>Slider Playback Config</span>
          </span>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sliderActive}
              onChange={(e) => setSliderActive(e.target.checked)}
              className="accent-amber-500"
            />
            <span>Slider Enabled</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => setAutoplay(e.target.checked)}
              className="accent-amber-500"
            />
            <span>Autoplay</span>
          </label>
          <label className="flex items-center gap-2">
            <span>Duration (ms):</span>
            <input
              type="number"
              min={2000}
              step={500}
              value={slideDurationMs}
              onChange={(e) => setSlideDurationMs(e.target.value)}
              className="h-8 w-24 rounded border border-white/15 bg-[#0A0D14] px-2 font-mono-num text-white"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={async () => {
            await apiFetch(`/api/admin/hero-sliders/${selectedPageKey}`, {
              method: 'PATCH',
              body: JSON.stringify({
                autoplay,
                slideDurationMs: Number(slideDurationMs || 6500),
                isActive: sliderActive,
              }),
            });
            load(selectedPageKey);
          }}
          className="h-8 rounded-lg bg-white/10 px-4 text-xs font-semibold text-white hover:bg-white/20"
        >
          Save Slider Config
        </button>
      </div>

      <form
        onSubmit={handleSaveSlide}
        className="space-y-3 rounded-xl border border-white/10 bg-[#10141E] p-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-white">
            {editingSlide ? `Edit Slide: ${editingSlide.title}` : `Add Slide to ${selectedPageKey}`}
          </h3>
          {editingSlide && (
            <button
              type="button"
              onClick={resetSlideForm}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <select
            value={contentId}
            onChange={(e) => handleLinkContent(e.target.value)}
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-6"
          >
            <option value="">-- Link Existing Movie / Drama / Series / Sports (Optional) --</option>
            {contents.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.contentType}] {c.title} ({c.language})
              </option>
            ))}
          </select>

          <select
            value={channelId}
            onChange={(e) => handleLinkChannel(e.target.value)}
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-6"
          >
            <option value="">-- Or Link Live TV Channel (Optional) --</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                CH {ch.channelNumber} · {ch.name} ({ch.language})
              </option>
            ))}
          </select>

          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Custom Slide Title"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-4"
          />
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Short Description"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-4"
          />
          <input
            type="text"
            value={categoryLabel}
            onChange={(e) => setCategoryLabel(e.target.value)}
            placeholder="Category Label (e.g. Action, News)"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
          />
          <input
            type="text"
            value={languageLabel}
            onChange={(e) => setLanguageLabel(e.target.value)}
            placeholder="Language (Bangla, English)"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
          />

          <div className="flex gap-1.5 md:col-span-4">
            <input
              type="text"
              required
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Desktop Banner URL *"
              className="h-10 flex-1 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
            />
            <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 text-xs text-white hover:bg-white/10">
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Desktop</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadBanner(f, setImageUrl);
                }}
              />
            </label>
          </div>

          <div className="flex gap-1.5 md:col-span-4">
            <input
              type="text"
              value={tabletImageUrl}
              onChange={(e) => setTabletImageUrl(e.target.value)}
              placeholder="Tablet Banner URL (Optional)"
              className="h-10 flex-1 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
            />
            <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 text-xs text-white hover:bg-white/10">
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tablet</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadBanner(f, setTabletImageUrl);
                }}
              />
            </label>
          </div>

          <div className="flex gap-1.5 md:col-span-4">
            <input
              type="text"
              value={mobileImageUrl}
              onChange={(e) => setMobileImageUrl(e.target.value)}
              placeholder="Mobile Banner URL (Optional)"
              className="h-10 flex-1 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
            />
            <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 text-xs text-white hover:bg-white/10">
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mobile</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadBanner(f, setMobileImageUrl);
                }}
              />
            </label>
          </div>

          <input
            type="text"
            value={badgeText}
            onChange={(e) => setBadgeText(e.target.value)}
            placeholder="Kicker / LIVE NOW"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
          />
          <input
            type="text"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder="Primary CTA Label"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
          />
          <input
            type="text"
            value={ctaLink}
            onChange={(e) => setCtaLink(e.target.value)}
            placeholder="Primary CTA Link"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
          />
          <input
            type="text"
            value={secondaryCtaLabel}
            onChange={(e) => setSecondaryCtaLabel(e.target.value)}
            placeholder="Secondary CTA (More Info)"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
          />
          <input
            type="text"
            value={secondaryCtaLink}
            onChange={(e) => setSecondaryCtaLink(e.target.value)}
            placeholder="Secondary Link"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 md:col-span-2"
          >
            {editingSlide ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{editingSlide ? 'Update Slide' : 'Add Slide'}</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-400 md:col-span-6">
            <span>Schedule Start:</span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="h-9 flex-1 rounded-lg border border-white/15 bg-[#0A0D14] px-2.5 text-xs text-white"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 md:col-span-6">
            <span>Schedule End:</span>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="h-9 flex-1 rounded-lg border border-white/15 bg-[#0A0D14] px-2.5 text-xs text-white"
            />
          </div>
        </div>
      </form>

      <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-[#10141E]">
        {slides.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No slides configured for <span className="text-white font-semibold">{selectedPageKey}</span> yet. Add one above.
          </div>
        ) : (
          slides.map((s) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => setDragId(s.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(s.id)}
              className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-4 min-w-0">
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-500" />
                <img
                  src={s.imageUrl}
                  alt={s.title}
                  className="h-14 w-24 shrink-0 rounded-lg border border-white/10 object-cover"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-display text-sm font-bold text-white">{s.title}</p>
                    {s.languageLabel && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {s.languageLabel}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    {s.badgeText} · {s.ctaLabel} → {s.ctaLink}
                    {s.tabletImageUrl || s.mobileImageUrl ? ' · Responsive banners set' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => startEditSlide(s)}
                  className="rounded border border-white/15 p-1.5 text-slate-300 hover:text-white"
                  title="Edit slide"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/admin/hero-slides/${s.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ isActive: !s.isActive }),
                    });
                    load(selectedPageKey);
                  }}
                  className={`rounded border px-2.5 py-1 text-xs font-semibold ${
                    s.isActive
                      ? 'border-emerald-500/40 text-emerald-400'
                      : 'border-white/15 text-slate-400'
                  }`}
                >
                  {s.isActive ? 'Active' : 'Disabled'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/admin/hero-slides/${s.id}`, { method: 'DELETE' });
                    load(selectedPageKey);
                  }}
                  className="rounded border border-red-500/30 p-1.5 text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-[#0A0A0D]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <p className="font-display text-sm font-bold text-white">
                Hero Slider Preview ({selectedPageKey})
              </p>
              <button type="button" onClick={() => setPreviewOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <HeroSlider
              slides={slides.filter((s) => s.isActive)}
              slider={{ autoplay, slideDurationMs: Number(slideDurationMs || 6500), isActive: sliderActive }}
              navigate={() => {}}
              heightClass="h-[460px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LiveTvCategoryManagerTab() {
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [editingCat, setEditingCat] = useState<ChannelCategory | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [language, setLanguage] = useState('All');
  const [categoryType, setCategoryType] = useState('genre');

  const load = () => {
    apiFetch('/api/admin/channel-categories').then((d) => setCategories(d.categories || []));
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingCat(null);
    setName('');
    setDescription('');
    setIconUrl('');
    setLanguage('All');
    setCategoryType('genre');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = { name, description, iconUrl, language, categoryType };
    if (editingCat) {
      await apiFetch(`/api/admin/channel-categories/${editingCat.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/api/admin/channel-categories', {
        method: 'POST',
        body: JSON.stringify({ ...payload, sortOrder: categories.length + 1 }),
      });
    }
    resetForm();
    load();
  };

  const handleDrop = async (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    const list = [...categories];
    const from = list.findIndex((c) => c.id === dragId);
    const to = list.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setCategories(list);
    setDragId(null);
    await apiFetch('/api/admin/channel-categories/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds: list.map((c) => c.id) }),
    });
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSave}
        className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-[#10141E] p-4 md:grid-cols-12"
      >
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category Name (e.g. Bangla Channels)"
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-3"
        />
        <select
          value={categoryType}
          onChange={(e) => setCategoryType(e.target.value)}
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
        >
          <option value="featured">Type: Featured</option>
          <option value="language">Type: Language (Strict)</option>
          <option value="genre">Type: Genre / Topic</option>
          <option value="general">Type: General</option>
        </select>
        <input
          type="text"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          placeholder="Language (All, Bangla, English, Hindi)"
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-2"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white md:col-span-3"
        />
        <div className="flex gap-1.5 md:col-span-2">
          <label className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 text-xs text-white hover:bg-white/10">
            <Upload className="h-3.5 w-3.5" />
            <span>{iconUrl ? 'Icon Set' : 'Icon'}</span>
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
                setIconUrl(res.url);
              }}
            />
          </label>
          <button
            type="submit"
            className="h-10 rounded-lg bg-amber-500 px-4 text-xs font-bold text-slate-950"
          >
            {editingCat ? 'Save' : 'Add'}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-slate-400">
            <tr>
              <th className="w-10 p-3">Order</th>
              <th className="p-3">Category</th>
              <th className="p-3">Type</th>
              <th className="p-3">Language</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {categories.map((cat) => (
              <tr
                key={cat.id}
                draggable
                onDragStart={() => setDragId(cat.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(cat.id)}
                className="hover:bg-white/[0.02]"
              >
                <td className="p-3 cursor-grab text-slate-500">
                  <GripVertical className="h-4 w-4" />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    {cat.iconUrl && (
                      <img src={cat.iconUrl} alt="" className="h-6 w-6 rounded object-cover" />
                    )}
                    <div>
                      <p className="font-semibold text-white">{cat.name}</p>
                      <p className="text-[11px] text-slate-400">{cat.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3 capitalize text-slate-300">{cat.categoryType}</td>
                <td className="p-3 text-amber-300 font-semibold">{cat.language}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/channel-categories/${cat.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ isActive: !cat.isActive }),
                      });
                      load();
                    }}
                    className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                      cat.isActive
                        ? 'border-emerald-500/40 text-emerald-400'
                        : 'border-white/15 text-slate-500'
                    }`}
                  >
                    {cat.isActive ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCat(cat);
                        setName(cat.name);
                        setDescription(cat.description || '');
                        setIconUrl(cat.iconUrl || '');
                        setLanguage(cat.language || 'All');
                        setCategoryType(cat.categoryType || 'genre');
                      }}
                      className="rounded border border-white/15 px-2.5 py-1 text-white hover:bg-white/10"
                    >
                      Edit
                    </button>
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

function PlacementManagerTab() {
  const [selectedKey, setSelectedKey] = useState(PLACEMENT_KEYS[0].key);
  const [targetType, setTargetType] = useState<'channel' | 'content'>('channel');
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [orderedIds, setOrderedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      apiFetch('/api/admin/placements'),
      apiFetch('/api/admin/channels'),
      apiFetch('/api/admin/contents'),
    ]).then(([plData, chData, coData]) => {
      setChannels(chData.channels || []);
      setContents(coData.contents || []);

      const chPlacements = (plData.channelPlacements || []).filter(
        (p: any) => p.placementKey === selectedKey
      );
      const coPlacements = (plData.contentPlacements || []).filter(
        (p: any) => p.placementKey === selectedKey
      );

      if (targetType === 'channel') {
        const ids = chPlacements.map((p: any) => Number(p.channelId));
        setOrderedIds(
          ids.length > 0
            ? ids
            : (chData.channels || [])
                .filter((c: LiveChannel) => c.placements?.includes(selectedKey))
                .map((c: LiveChannel) => c.id)
        );
      } else {
        const ids = coPlacements.map((p: any) => Number(p.contentId));
        setOrderedIds(
          ids.length > 0
            ? ids
            : (coData.contents || [])
                .filter((c: ContentItem) => c.placements?.includes(selectedKey))
                .map((c: ContentItem) => c.id)
        );
      }
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, targetType]);

  const pool = targetType === 'channel' ? channels : contents;
  const selectedSet = new Set(orderedIds);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/placements/${selectedKey}`, {
        method: 'PUT',
        body: JSON.stringify({ targetType, orderedIds }),
      });
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#10141E] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedKey}
            onChange={(e) => {
              const nextKey = e.target.value;
              setSelectedKey(nextKey);
              const meta = PLACEMENT_KEYS.find((k) => k.key === nextKey);
              if (meta) setTargetType(meta.defaultTarget);
            }}
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
          >
            {PLACEMENT_KEYS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label} ({k.key})
              </option>
            ))}
          </select>

          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as 'channel' | 'content')}
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
          >
            <option value="channel">Live TV Channels</option>
            <option value="content">VOD Content</option>
          </select>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-amber-500 px-5 text-xs font-bold text-slate-950 hover:bg-amber-400"
        >
          <Save className="h-3.5 w-3.5" />
          <span>{saving ? 'Saving...' : 'Save Placement Order'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#10141E] p-4 space-y-2">
          <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-400">
            Select {targetType === 'channel' ? 'Live Channels' : 'VOD Titles'}
          </h4>
          <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
            {pool.map((item: any) => {
              const checked = selectedSet.has(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs cursor-pointer ${
                    checked
                      ? 'border-amber-400/50 bg-amber-500/10 text-white'
                      : 'border-white/10 bg-[#0A0D14] text-slate-300'
                  }`}
                >
                  <span className="truncate">
                    {item.name ? `CH ${item.channelNumber} · ${item.name}` : item.title} ({item.language})
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setOrderedIds((prev) =>
                        checked ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                      )
                    }
                    className="accent-amber-500"
                  />
                </label>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#10141E] p-4 space-y-2">
          <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-400">
            Display Order in "{selectedKey}" ({orderedIds.length})
          </h4>
          <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
            {orderedIds.map((id, idx) => {
              const item: any = pool.find((p: any) => p.id === id);
              if (!item) return null;
              return (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0A0D14] px-3 py-2 text-xs"
                >
                  <span className="truncate font-semibold text-white">
                    <span className="font-mono-num text-amber-400 mr-2">#{idx + 1}</span>
                    {item.name || item.title}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => {
                        const next = [...orderedIds];
                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                        setOrderedIds(next);
                      }}
                      className="rounded p-1 text-slate-400 hover:text-white disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === orderedIds.length - 1}
                      onClick={() => {
                        const next = [...orderedIds];
                        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                        setOrderedIds(next);
                      }}
                      className="rounded p-1 text-slate-400 hover:text-white disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
