import React, { useEffect, useState } from 'react';
import { Globe, Upload } from 'lucide-react';
import { useSiteConfig } from '../../context/SiteConfigContext.tsx';
import { apiFetch } from '../../services/api.ts';

export function AdminNotificationsSection() {
  const [list, setList] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');

  const load = () => {
    apiFetch('/api/admin/notifications').then((d) => setList(d.notifications || []));
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await apiFetch('/api/admin/notifications', {
            method: 'POST',
            body: JSON.stringify({ title, message, type }),
          });
          setTitle('');
          setMessage('');
          load();
        }}
        className="rounded-xl border border-white/10 bg-[#10141E] p-5 space-y-3"
      >
        <h3 className="font-display text-sm font-bold text-white">Broadcast Notification</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification Title"
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white sm:col-span-2"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
          >
            <option value="info">Information</option>
            <option value="promo">Promotion</option>
            <option value="billing">Billing Alert</option>
            <option value="system">System Notice</option>
          </select>
        </div>
        <textarea
          rows={2}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message body..."
          className="w-full rounded-lg border border-white/15 bg-[#0A0D14] p-3 text-xs text-white"
        />
        <button
          type="submit"
          className="h-9 rounded-lg bg-amber-500 px-5 text-xs font-bold text-slate-950"
        >
          Send Broadcast
        </button>
      </form>

      <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-[#10141E]">
        {list.map((n) => (
          <div key={n.id} className="p-4">
            <p className="text-sm font-semibold text-white">{n.title}</p>
            <p className="mt-1 text-xs text-slate-400">{n.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDevicesSection() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => {
    apiFetch('/api/admin/devices').then((d) => setRows(d.devices || []));
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-white/10 text-slate-400">
          <tr>
            <th className="p-3">User</th>
            <th className="p-3">Device & Platform</th>
            <th className="p-3">Last Active</th>
            <th className="p-3">Status</th>
            <th className="p-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r) => (
            <tr key={r.device.id}>
              <td className="p-3 text-white">{r.userEmail || r.userName}</td>
              <td className="p-3 text-slate-300">
                {r.device.deviceName} · {r.device.platform}
              </td>
              <td className="p-3 font-mono-num text-slate-400">
                {new Date(r.device.lastActiveAt).toLocaleString()}
              </td>
              <td className="p-3">
                <span className={r.device.isRevoked ? 'text-red-400' : 'text-emerald-400'}>
                  {r.device.isRevoked ? 'Revoked' : 'Active'}
                </span>
              </td>
              <td className="p-3 text-right">
                {!r.device.isRevoked && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/devices/${r.device.id}`, { method: 'DELETE' });
                      load();
                    }}
                    className="rounded border border-red-500/30 px-2.5 py-1 text-red-400"
                  >
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminRolesSection() {
  const [roles, setRoles] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [perms, setPerms] = useState('content.manage, channels.manage');

  const load = () => {
    apiFetch('/api/admin/roles').then((d) => setRoles(d.roles || []));
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await apiFetch('/api/admin/roles', {
            method: 'POST',
            body: JSON.stringify({
              name,
              description,
              permissions: perms
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean),
            }),
          });
          setName('');
          setDescription('');
          load();
        }}
        className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-[#10141E] p-4 sm:grid-cols-12"
      >
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Role Name"
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white sm:col-span-3"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Role Description"
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white sm:col-span-4"
        />
        <input
          type="text"
          value={perms}
          onChange={(e) => setPerms(e.target.value)}
          placeholder="Permissions (comma-separated)"
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 font-mono-num text-xs text-white sm:col-span-3"
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-amber-500 text-xs font-bold text-slate-950 sm:col-span-2"
        >
          Create Role
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {roles.map((r) => (
          <div key={r.id} className="rounded-xl border border-white/10 bg-[#10141E] p-4">
            <p className="font-display text-sm font-bold text-white">{r.name}</p>
            <p className="mt-1 text-xs text-slate-400">{r.description}</p>
            <p className="mt-2 font-mono-num text-[11px] text-amber-300">
              Permissions: {(r.permissions || []).join(', ')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const KNOWN_WEBSITE_KEYS = [
  { key: 'platform_name', label: 'Website Name', category: 'branding', placeholder: 'VEXORA' },
  { key: 'logo_url', label: 'Brand Logo URL', category: 'branding', placeholder: '/uploads/logo.png', upload: true },
  { key: 'favicon_url', label: 'Favicon URL', category: 'branding', placeholder: '/uploads/favicon.png', upload: true },
  { key: 'footer_tagline', label: 'Footer Tagline', category: 'branding', placeholder: 'Commercial OTT cinema and live IPTV streaming.' },
  { key: 'support_email', label: 'Contact / Support Email', category: 'contact', placeholder: 'support@vexora.tv' },
  { key: 'contact_phone', label: 'Contact Phone', category: 'contact', placeholder: '+1 (800) 555-0199' },
  { key: 'contact_address', label: 'Business Address', category: 'contact', placeholder: 'Broadcast Plaza Suite 400, New York, NY' },
  { key: 'seo_title', label: 'Default SEO Title', category: 'seo', placeholder: 'VEXORA — OTT & Live IPTV Streaming' },
  { key: 'seo_description', label: 'Default SEO Meta Description', category: 'seo', placeholder: 'Stream Live TV, Movies, Drama, Web Series & Sports.' },
  { key: 'social_facebook', label: 'Facebook URL', category: 'social', placeholder: 'https://facebook.com/...' },
  { key: 'social_youtube', label: 'YouTube URL', category: 'social', placeholder: 'https://youtube.com/...' },
  { key: 'social_instagram', label: 'Instagram URL', category: 'social', placeholder: 'https://instagram.com/...' },
  { key: 'social_x', label: 'X / Twitter URL', category: 'social', placeholder: 'https://x.com/...' },
];

export function AdminSettingsSection() {
  const { refreshSiteConfig } = useSiteConfig();
  const [settingsMap, setSettingsMap] = useState<Record<string, { value: string; description: string; category: string }>>({});
  const [extraSettings, setExtraSettings] = useState<Array<{ key: string; value: string; description: string; category: string }>>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch('/api/admin/settings').then((d) => {
      const rows: Array<{ key: string; value: string; description: string; category: string }> = d.settings || [];
      const knownSet = new Set(KNOWN_WEBSITE_KEYS.map((k) => k.key));
      const map: Record<string, { value: string; description: string; category: string }> = {};
      for (const meta of KNOWN_WEBSITE_KEYS) {
        const match = rows.find((r) => r.key === meta.key);
        map[meta.key] = {
          value: match?.value || '',
          description: match?.description || meta.label,
          category: match?.category || meta.category,
        };
      }
      setSettingsMap(map);
      setExtraSettings(rows.filter((r) => !knownSet.has(r.key)));
    });
  };

  useEffect(() => {
    load();
  }, []);

  const uploadBrandAsset = async (file: File, key: string) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiFetch('/api/admin/upload', { method: 'POST', body: fd });
    setSettingsMap((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { description: key, category: 'branding' }), value: res.url },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setSaving(true);
    try {
      const payloadSettings = [
        ...KNOWN_WEBSITE_KEYS.map((meta) => ({
          key: meta.key,
          value: settingsMap[meta.key]?.value ?? '',
          category: meta.category,
        })),
        ...extraSettings.map((s) => ({
          key: s.key,
          value: s.value,
          category: s.category || 'general',
        })),
      ];
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: payloadSettings }),
      });
      await refreshSiteConfig();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {saved && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          Website & System settings updated and reflected across Navbar, Footer, and SEO metadata immediately.
        </p>
      )}

      {/* Brand, Contact, SEO & Social Settings */}
      <div className="rounded-xl border border-white/10 bg-[#10141E] p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Globe className="h-4 w-4 text-amber-400" />
          <h3 className="font-display text-sm font-bold text-white">Website Branding, Contact & SEO</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {KNOWN_WEBSITE_KEYS.map((meta) => {
            const val = settingsMap[meta.key]?.value ?? '';
            return (
              <div key={meta.key} className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">{meta.label}</label>
                <div className="flex items-center gap-2">
                  {meta.upload && val && (
                    <img src={val} alt="" className="h-10 w-10 rounded border border-white/10 object-contain bg-black/40 p-1" />
                  )}
                  <input
                    type="text"
                    value={val}
                    placeholder={meta.placeholder}
                    onChange={(e) =>
                      setSettingsMap((prev) => ({
                        ...prev,
                        [meta.key]: {
                          ...(prev[meta.key] || { description: meta.label, category: meta.category }),
                          value: e.target.value,
                        },
                      }))
                    }
                    className="h-10 flex-1 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                  />
                  {meta.upload && (
                    <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 text-xs text-white hover:bg-white/10">
                      <Upload className="h-3.5 w-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadBrandAsset(f, meta.key);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Extra System Key-Value Settings */}
      {extraSettings.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-[#10141E] p-6 space-y-4">
          <h3 className="border-b border-white/10 pb-3 font-display text-sm font-bold text-white">
            System & Operational Parameters
          </h3>
          {extraSettings.map((s, idx) => (
            <div key={s.key} className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
              <div className="sm:col-span-5">
                <p className="font-mono-num text-xs font-semibold text-white">{s.key}</p>
                <p className="text-[11px] text-slate-400">{s.description}</p>
              </div>
              <input
                type="text"
                value={s.value}
                onChange={(e) => {
                  const next = [...extraSettings];
                  next[idx] = { ...s, value: e.target.value };
                  setExtraSettings(next);
                }}
                className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white sm:col-span-7"
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="h-10 rounded-lg bg-amber-500 px-6 text-xs font-bold text-slate-950 hover:bg-amber-400"
      >
        {saving ? 'Saving...' : 'Save Website & System Settings'}
      </button>
    </form>
  );
}

export function AdminAuditLogsSection() {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    apiFetch('/api/admin/audit-logs').then((d) => setLogs(d.logs || []));
  }, []);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-white/10 text-slate-400">
          <tr>
            <th className="p-3">Timestamp</th>
            <th className="p-3">Actor</th>
            <th className="p-3">Action</th>
            <th className="p-3">Target</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="p-3 font-mono-num text-slate-400">
                {new Date(l.createdAt).toLocaleString()}
              </td>
              <td className="p-3 text-white">{l.actorEmail}</td>
              <td className="p-3 font-mono-num text-amber-300">{l.action}</td>
              <td className="p-3 text-slate-300">
                {l.entityType} #{l.entityId}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
