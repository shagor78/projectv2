import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  CreditCard,
  Heart,
  History,
  MonitorSmartphone,
  Play,
  Trash2,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, formatCurrency, formatTimecode } from '../services/api.ts';

interface AccountPageProps {
  navigate: (path: string) => void;
}

function AccountSubNav({
  active,
  navigate,
}: {
  active: 'dashboard' | 'profile' | 'history' | 'favorites' | 'devices';
  navigate: (path: string) => void;
}) {
  const tabs = [
    { key: 'dashboard', label: 'Overview', path: '/dashboard' },
    { key: 'profile', label: 'Profile Settings', path: '/profile' },
    { key: 'history', label: 'Watch History', path: '/history' },
    { key: 'favorites', label: 'Favorites', path: '/favorites' },
    { key: 'devices', label: 'Devices', path: '/devices' },
  ] as const;

  return (
    <div className="mb-8 flex items-center gap-2 overflow-x-auto border-b border-white/10 pb-4">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => navigate(t.path)}
          className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            active === t.key
              ? 'bg-amber-500 text-slate-950'
              : 'border border-white/10 bg-[#121621] text-slate-300 hover:bg-[#192030]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function RequireSignInCard({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold text-white">Sign In Required</h1>
      <p className="mt-2 text-sm text-slate-400">
        Sign in to manage your subscription, wallet balance, watch history, and devices.
      </p>
      <button
        type="button"
        onClick={() => navigate('/login')}
        className="mt-5 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-bold text-slate-950"
      >
        Sign In
      </button>
    </div>
  );
}

export function UserDashboardPage({ navigate }: AccountPageProps) {
  const { user, refreshSession } = useAuth();
  const [data, setData] = useState<any>(null);
  const [topupDollars, setTopupDollars] = useState('20');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch('/api/user/dashboard')
      .then((res) => setData(res))
      .catch((err) => setError(err?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) load();
    else setLoading(false);
  }, [user]);

  if (!user) return <RequireSignInCard navigate={navigate} />;

  const handleQuickTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setError(null);
    try {
      const cents = Math.round(Number(topupDollars) * 100);
      await apiFetch('/api/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amountCents: cents }),
      });
      await refreshSession();
      load();
      setMsg(`Added ${formatCurrency(cents)} to wallet.`);
    } catch (err: any) {
      setError(err?.message || 'Wallet topup failed');
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-4 font-display text-3xl font-bold text-white">Account Dashboard</h1>
      <AccountSubNav active="dashboard" navigate={navigate} />

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          {msg && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {msg}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-[#10141E] p-6">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Active Subscription</span>
                <CreditCard className="h-4 w-4 text-amber-400" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold text-white">
                {data?.activeSubscription ? data.activeSubscription.package.name : 'No Active Plan'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {data?.activeSubscription
                  ? `Expires ${new Date(data.activeSubscription.expiresAt).toLocaleDateString()}`
                  : 'Claim your 15-day Free Access trial or select a plan'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/plans')}
                className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                {data?.activeSubscription ? 'Change / Upgrade Plan' : 'Browse Plans'}
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#10141E] p-6">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Wallet Balance</span>
                <Wallet className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold text-white font-mono-num">
                {formatCurrency(data?.wallet?.balanceCents ?? 0)}
              </p>
              <form onSubmit={handleQuickTopup} className="mt-4 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={topupDollars}
                  onChange={(e) => setTopupDollars(e.target.value)}
                  aria-label="Top up amount in USD"
                  className="h-9 w-24 rounded-lg border border-white/15 bg-[#0A0D14] px-2.5 font-mono-num text-xs text-white focus:border-amber-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-9 rounded-lg border border-white/15 bg-white/5 px-3.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Credit Wallet
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#10141E] p-6">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Registered Devices</span>
                <MonitorSmartphone className="h-4 w-4 text-sky-400" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold text-white font-mono-num">
                {data?.devices?.length ?? 0} Active
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Email status: {user.emailVerified ? 'Verified' : 'Unverified'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/devices')}
                className="mt-4 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
              >
                Manage Devices
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-2xl border border-white/10 bg-[#10141E] p-6 lg:col-span-7">
              <h2 className="font-display text-lg font-bold text-white">Recent Wallet Transactions</h2>
              {data?.transactions?.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">Description</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3 text-right">Amount</th>
                        <th className="py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.transactions.map((tx: any) => (
                        <tr key={tx.id}>
                          <td className="py-2.5 pr-3 text-slate-200">{tx.description}</td>
                          <td className="py-2.5 pr-3 text-slate-400 capitalize">{tx.type.replace('_', ' ')}</td>
                          <td
                            className={`py-2.5 pr-3 text-right font-mono-num font-semibold ${
                              tx.amountCents >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {tx.amountCents >= 0 ? '+' : ''}
                            {formatCurrency(tx.amountCents)}
                          </td>
                          <td className="py-2.5 text-right font-mono-num text-slate-300">
                            {formatCurrency(tx.balanceAfterCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">No wallet transactions recorded yet.</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#10141E] p-6 lg:col-span-5">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-400" />
                <h2 className="font-display text-lg font-bold text-white">Notifications</h2>
              </div>
              <div className="mt-4 space-y-3">
                {(data?.notifications || []).map((n: any) => (
                  <div key={n.id} className="rounded-xl border border-white/10 bg-[#0A0D14] p-3.5">
                    <p className="text-xs font-semibold text-white">{n.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProfileSettingsPage({ navigate }: AccountPageProps) {
  const { user, refreshSession } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyTokenInput, setVerifyTokenInput] = useState('');
  const [issuedVerifyToken, setIssuedVerifyToken] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPhone(user.phone || '');
    }
  }, [user]);

  if (!user) return <RequireSignInCard navigate={navigate} />;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName, phone }),
      });
      await refreshSession();
      setMessage('Profile updated.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRequestVerification = async () => {
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch('/api/auth/verify-email/request', { method: 'POST' });
      setMessage(res.message || 'Verification initiated.');
      if (res.verificationToken) {
        setIssuedVerifyToken(res.verificationToken);
        setVerifyTokenInput(res.verificationToken);
      }
    } catch (err: any) {
      setError(err?.message || 'Verification request failed');
    }
  };

  const handleConfirmVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/auth/verify-email/confirm', {
        method: 'POST',
        body: JSON.stringify({ token: verifyTokenInput }),
      });
      await refreshSession();
      setMessage('Email address verified!');
      setIssuedVerifyToken(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-4 font-display text-3xl font-bold text-white">Profile Settings</h1>
      <AccountSubNav active="profile" navigate={navigate} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form onSubmit={handleSaveProfile} className="rounded-2xl border border-white/10 bg-[#10141E] p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-white">Personal Information</h2>
          {message && (
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Email Address</label>
            <input
              type="text"
              disabled
              value={user.email || 'Not set'}
              className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-[#080A0F] px-3 text-sm text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          <button type="submit" className="h-10 rounded-lg bg-amber-500 px-5 text-sm font-bold text-slate-950 hover:bg-amber-400">
            Save Changes
          </button>
        </form>

        <div className="rounded-2xl border border-white/10 bg-[#10141E] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">Email Verification</h2>
            {user.emailVerified ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
                <UserCheck className="h-4 w-4" />
                Pending Verification
              </span>
            )}
          </div>

          {!user.emailVerified && user.email && (
            <>
              <p className="text-xs leading-relaxed text-slate-400">
                Verify your email address to protect your subscription and unlock password recovery.
              </p>
              <button
                type="button"
                onClick={handleRequestVerification}
                className="h-9 rounded-lg border border-white/15 bg-white/5 px-4 text-xs font-semibold text-white hover:bg-white/10"
              >
                Generate Verification Token
              </button>

              {issuedVerifyToken && (
                <p className="font-mono-num text-[11px] text-amber-300 break-all">
                  Token (SMTP unset): {issuedVerifyToken}
                </p>
              )}

              <form onSubmit={handleConfirmVerification} className="flex gap-2 pt-2">
                <input
                  type="text"
                  required
                  value={verifyTokenInput}
                  onChange={(e) => setVerifyTokenInput(e.target.value)}
                  placeholder="Paste verification token"
                  className="h-10 flex-1 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                />
                <button type="submit" className="h-10 rounded-lg bg-amber-500 px-4 text-xs font-bold text-slate-950">
                  Verify
                </button>
              </form>
            </>
          )}

          {user.emailVerified && (
            <p className="text-sm text-slate-400">
              Your email <span className="text-white font-medium">{user.email}</span> is verified.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function WatchHistoryPage({ navigate }: AccountPageProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch('/api/watch-history')
      .then((d) => setRows(d.history || []))
      .catch((err) => setError(err?.message || 'Failed to load watch history'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) load();
    else setLoading(false);
  }, [user]);

  if (!user) return <RequireSignInCard navigate={navigate} />;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-white">Watch History</h1>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={async () => {
              await apiFetch('/api/watch-history', { method: 'DELETE' });
              setRows([]);
            }}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
          >
            Clear All History
          </button>
        )}
      </div>
      <AccountSubNav active="history" navigate={navigate} />

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center text-sm text-red-300">
          <AlertCircle className="mx-auto mb-2 h-6 w-6" />
          {error}
        </div>
      ) : loading ? (
        <div className="skeleton-shimmer h-64 rounded-2xl" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#10141E] py-16 text-center">
          <History className="mx-auto h-10 w-10 text-slate-500" />
          <p className="mt-3 font-display text-lg font-semibold text-white">No Watch History Yet</p>
          <p className="mt-1 text-sm text-slate-400">Titles and channels you play will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#10141E]">
          {rows.map((r) => {
            const title = r.content?.title || r.channel?.name || 'Playback Item';
            const sub = r.episode
              ? `Episode ${r.episode.episodeNumber}: ${r.episode.title}`
              : r.channel
              ? `Live TV CH ${r.channel.channelNumber}`
              : r.content?.contentType;
            const targetPath = r.channel
              ? `/live-tv?channel=${r.channel.slug}`
              : `/title/${r.content?.slug}`;
            return (
              <div key={r.history.id} className="flex items-center justify-between gap-4 p-4">
                <button type="button" onClick={() => navigate(targetPath)} className="flex items-center gap-4 text-left hover:opacity-90">
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black">
                    {(r.content?.backdropUrl || r.channel?.logoUrl) && (
                      <img src={r.content?.backdropUrl || r.channel?.logoUrl} alt={title} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold text-white">{title}</p>
                    <p className="text-xs text-slate-400">
                      {sub} · Position {formatTimecode(r.history.positionSeconds)}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(targetPath)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-xs font-bold text-slate-950"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Resume
                  </button>
                  <button
                    type="button"
                    aria-label="Remove history entry"
                    onClick={async () => {
                      await apiFetch(`/api/watch-history/${r.history.id}`, { method: 'DELETE' });
                      setRows((prev) => prev.filter((item) => item.history.id !== r.history.id));
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FavoritesPage({ navigate }: AccountPageProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setError(null);
      apiFetch('/api/favorites')
        .then((d) => setRows(d.favorites || []))
        .catch((err) => setError(err?.message || 'Failed to load favorites'))
        .finally(() => setLoading(false));
    } else setLoading(false);
  }, [user]);

  if (!user) return <RequireSignInCard navigate={navigate} />;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-4 font-display text-3xl font-bold text-white">Favorites</h1>
      <AccountSubNav active="favorites" navigate={navigate} />

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center text-sm text-red-300">
          {error}
        </div>
      ) : loading ? (
        <div className="skeleton-shimmer h-64 rounded-2xl" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#10141E] py-16 text-center">
          <Heart className="mx-auto h-10 w-10 text-slate-500" />
          <p className="mt-3 font-display text-lg font-semibold text-white">No Favorites Saved</p>
          <p className="mt-1 text-sm text-slate-400">
            Save movies, drama, web series, or Live TV channels to reach them quickly here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((r) => {
            const isChannel = Boolean(r.channel);
            const title = r.content?.title || r.channel?.name;
            const img = r.content?.backdropUrl || r.channel?.logoUrl;
            const target = isChannel ? `/live-tv?channel=${r.channel.slug}` : `/title/${r.content.slug}`;
            return (
              <div key={r.favorite.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#10141E]">
                <div className="aspect-video w-full bg-black">
                  {img && <img src={img} alt={title} className="h-full w-full object-cover" />}
                </div>
                <div className="flex items-center justify-between gap-2 p-4">
                  <button type="button" onClick={() => navigate(target)} className="min-w-0 text-left">
                    <p className="truncate font-display text-sm font-bold text-white hover:text-amber-300">{title}</p>
                    <p className="text-xs text-slate-400">
                      {isChannel ? `Live TV CH ${r.channel.channelNumber}` : r.content.contentType}
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label="Remove from favorites"
                    onClick={async () => {
                      await apiFetch('/api/favorites/toggle', {
                        method: 'POST',
                        body: JSON.stringify({
                          contentId: r.favorite.contentId,
                          channelId: r.favorite.channelId,
                        }),
                      });
                      setRows((prev) => prev.filter((x) => x.favorite.id !== r.favorite.id));
                    }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DeviceManagementPage({ navigate }: AccountPageProps) {
  const { user, refreshSession } = useAuth();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch('/api/auth/devices')
      .then((d) => setDevices(d.devices || []))
      .catch((err) => setError(err?.message || 'Failed to load registered devices'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) load();
    else setLoading(false);
  }, [user]);

  if (!user) return <RequireSignInCard navigate={navigate} />;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-4 font-display text-3xl font-bold text-white">Device Management</h1>
      <AccountSubNav active="devices" navigate={navigate} />

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center text-sm text-red-300">
          {error}
        </div>
      ) : loading ? (
        <div className="skeleton-shimmer h-64 rounded-2xl" />
      ) : (
        <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#10141E]">
          {devices.map((d) => (
            <div key={d.id} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-sm font-bold text-white">{d.deviceName}</p>
                  <span className="text-xs text-slate-400">· {d.platform}</span>
                  {d.isRevoked && <span className="text-xs font-semibold text-red-400">· Revoked</span>}
                </div>
                <p className="mt-1 font-mono-num text-xs text-slate-400">
                  ID: {d.deviceIdentifier} · Last Active: {new Date(d.lastActiveAt).toLocaleString()}
                </p>
              </div>
              {!d.isRevoked && (
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/auth/devices/${d.id}`, { method: 'DELETE' });
                    await refreshSession();
                    load();
                  }}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                >
                  Revoke Device
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
