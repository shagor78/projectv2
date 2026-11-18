import React, { useEffect, useState } from 'react';
import { Activity, BarChart3, DollarSign, Radio, RefreshCw, Tv, Users } from 'lucide-react';
import { apiFetch, formatCurrency } from '../../services/api.ts';

export function AdminOverviewSection({ onNavigateSection }: { onNavigateSection: (s: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch('/api/admin/overview')
      .then(setData)
      .catch((err) => setError(err?.message || 'Failed to load admin overview metrics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-xs text-red-200 flex items-center justify-between">
        <span>{error}</span>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/20"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const cards = [
    { label: 'Total Revenue', value: formatCurrency(kpis.totalRevenueCents || 0), icon: DollarSign, target: 'payments' },
    { label: 'Active Subscriptions', value: String(kpis.activeSubscriptions || 0), icon: Users, target: 'subscriptions' },
    { label: 'Live TV Channels', value: `${kpis.totalChannels || 0} (${kpis.healthyStreams || 0}/${kpis.totalStreams || 0} HLS OK)`, icon: Tv, target: 'live-tv' },
    { label: 'Catalog Titles', value: String(kpis.totalContents || 0), icon: Radio, target: 'movies' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onNavigateSection(c.target)}
            className="rounded-xl border border-white/10 bg-[#10141E] p-5 text-left transition-colors hover:border-amber-400/40"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{c.label}</span>
              <c.icon className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-white font-mono-num">{c.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#10141E] p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-display text-sm font-bold text-white">Recent Stream Health Events</h3>
            <button
              type="button"
              onClick={() => onNavigateSection('streams')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300"
            >
              Manage Streams
            </button>
          </div>
          <div className="mt-3 divide-y divide-white/5 text-xs">
            {(data?.recentStreamLogs || []).length === 0 ? (
              <p className="py-4 text-slate-400">No stream checks logged yet. Run a stream test to log health telemetry.</p>
            ) : (
              data.recentStreamLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-white capitalize">
                      {log.eventType.replace('_', ' ')} · Stream #{log.streamId}
                    </p>
                    <p className="truncate text-slate-400">{log.details}</p>
                  </div>
                  <span
                    className={`shrink-0 font-mono-num font-semibold ${
                      log.newStatus === 'healthy'
                        ? 'text-emerald-400'
                        : log.newStatus === 'degraded'
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}
                  >
                    {log.responseTimeMs ? `${log.responseTimeMs}ms` : log.newStatus}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#10141E] p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-display text-sm font-bold text-white">Recent Payments</h3>
            <button
              type="button"
              onClick={() => onNavigateSection('payments')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300"
            >
              View All
            </button>
          </div>
          <div className="mt-3 divide-y divide-white/5 text-xs">
            {(data?.recentPayments || []).length === 0 ? (
              <p className="py-4 text-slate-400">No payments recorded yet.</p>
            ) : (
              data.recentPayments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-semibold text-white">User #{p.userId} · {p.provider.toUpperCase()}</p>
                    <p className="font-mono-num text-slate-400">{p.referenceKey}</p>
                  </div>
                  <span className="font-mono-num font-bold text-emerald-400">
                    {formatCurrency(p.amountCents)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminAnalyticsSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch('/api/admin/analytics')
      .then(setData)
      .catch((err) => setError(err?.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="skeleton-shimmer h-72 rounded-xl" />;
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-xs text-red-200 flex items-center justify-between">
        <span>{error}</span>
        <button type="button" onClick={load} className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-white">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#10141E] p-5">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <BarChart3 className="h-4 w-4 text-amber-400" />
            <h3 className="font-display text-sm font-bold text-white">Catalog & Views by Category</h3>
          </div>
          <table className="mt-3 w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2">Type</th>
                <th className="py-2 text-right">Titles</th>
                <th className="py-2 text-right">Total Views</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(data?.contentByType || []).map((row: any) => (
                <tr key={row.contentType}>
                  <td className="py-2.5 font-semibold capitalize text-white">{row.contentType}</td>
                  <td className="py-2.5 text-right font-mono-num text-slate-300">{row.count}</td>
                  <td className="py-2.5 text-right font-mono-num text-amber-400">{row.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#10141E] p-5">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h3 className="font-display text-sm font-bold text-white">Stream Health & Latency</h3>
          </div>
          <table className="mt-3 w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Streams</th>
                <th className="py-2 text-right">Avg Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(data?.streamStats || []).map((row: any) => (
                <tr key={row.healthStatus}>
                  <td className="py-2.5 font-semibold capitalize text-white">{row.healthStatus}</td>
                  <td className="py-2.5 text-right font-mono-num text-slate-300">{row.count}</td>
                  <td className="py-2.5 text-right font-mono-num text-slate-300">
                    {row.avgResponseMs ? `${row.avgResponseMs} ms` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#10141E] p-5">
        <h3 className="border-b border-white/10 pb-3 font-display text-sm font-bold text-white">
          Top Performing Titles
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(data?.topContent || []).map((item: any) => (
            <div key={item.id} className="rounded-lg border border-white/10 bg-[#0A0D14] p-3">
              <p className="truncate text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 font-mono-num text-xs text-slate-400 capitalize">
                {item.contentType} · {item.viewCount} views
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
