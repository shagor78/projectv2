import React, { useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiFetch, formatCurrency } from '../../services/api.ts';
import { SubscriptionPackage } from '../../types/platform.ts';

export function AdminUsersSection() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [status, setStatus] = useState('active');
  const [emailVerified, setEmailVerified] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    apiFetch('/api/admin/users')
      .then((d) => setUsers(d.users || []))
      .catch((err) => setError(err?.message || 'Failed to load users'));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          phone: phone || undefined,
          password,
          role,
          status,
          emailVerified,
        }),
      });
      setCreateOpen(false);
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      load();
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  const filtered = users.filter(
    (u) =>
      !search.trim() ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.phone || '').includes(search)
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
          placeholder="Search users by name, email, or phone..."
          className="h-10 w-full rounded-lg border border-white/10 bg-[#10141E] px-3 text-sm text-white sm:w-80"
        />
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setCreateOpen(true);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400"
        >
          <UserPlus className="h-4 w-4" />
          <span>Create User / Admin</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-slate-400">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Role</th>
              <th className="p-3">Plan</th>
              <th className="p-3 text-right">Wallet</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((u) => (
              <tr key={u.id}>
                <td className="p-3">
                  <p className="font-semibold text-white">{u.fullName}</p>
                  <p className="text-[11px] text-slate-400">{u.email || u.phone}</p>
                </td>
                <td className="p-3">
                  <select
                    value={u.role}
                    onChange={async (e) => {
                      await apiFetch(`/api/admin/users/${u.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ role: e.target.value }),
                      });
                      load();
                    }}
                    className="h-8 rounded border border-white/15 bg-[#0A0D14] px-2 text-xs text-white"
                  >
                    <option value="user">User</option>
                    <option value="editor">Editor</option>
                    <option value="operator">Operator</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </td>
                <td className="p-3 text-slate-300">{u.activePlan || 'None'}</td>
                <td className="p-3 text-right font-mono-num text-amber-400">
                  {formatCurrency(u.walletBalanceCents)}
                </td>
                <td className="p-3">
                  <span className={u.status === 'active' ? 'text-emerald-400' : 'text-red-400'}>
                    {u.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/users/${u.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({
                            status: u.status === 'active' ? 'suspended' : 'active',
                          }),
                        });
                        load();
                      }}
                      className="rounded border border-white/15 px-2.5 py-1 text-xs text-white hover:bg-white/10"
                    >
                      {u.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                    {currentUser?.id !== u.id && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(u)}
                        className="rounded border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10"
                        title="Delete user"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User / Admin Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleCreateUser}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-white">Create User or Staff Account</h3>
            {createError && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-300">
                {createError}
              </p>
            )}
            <div>
              <label className="block text-xs text-slate-300">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300">Phone (Optional)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300">Temporary Password (min 6 chars)</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-sm text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300">Assigned Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                >
                  <option value="user">User (Customer)</option>
                  <option value="editor">Editor</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={emailVerified}
                onChange={(e) => setEmailVerified(e.target.checked)}
                className="accent-amber-500"
              />
              <span>Mark email as verified</span>
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="h-9 rounded-lg border border-white/15 px-4 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="h-9 rounded-lg bg-amber-500 px-5 text-xs font-bold text-slate-950"
              >
                {creating ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-white">Delete User Account?</h3>
            <p className="text-xs text-slate-300">
              Permanently remove <span className="font-semibold text-white">{deleteTarget.fullName}</span> (
              {deleteTarget.email || deleteTarget.phone})? Associated subscriptions and sessions will be deleted.
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
                  await apiFetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' });
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
    </div>
  );
}

export function AdminPackagesSection() {
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [priceDollars, setPriceDollars] = useState('0');
  const [durationDays, setDurationDays] = useState('90');
  const [maxDevices, setMaxDevices] = useState('2');
  const [maxQuality, setMaxQuality] = useState('FHD');

  const load = () => {
    apiFetch('/api/admin/packages').then((d) => setPackages(d.packages || []));
  };
  useEffect(() => {
    load();
  }, []);

  const startEdit = (pkg: SubscriptionPackage) => {
    setEditingId(pkg.id);
    setPriceDollars((pkg.priceCents / 100).toFixed(2));
    setDurationDays(String(pkg.durationDays));
    setMaxDevices(String(pkg.maxDevices));
    setMaxQuality(pkg.maxQuality);
  };

  const saveEdit = async (id: number) => {
    await apiFetch(`/api/admin/packages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        priceCents: Math.round(Number(priceDollars) * 100),
        durationDays: Number(durationDays),
        maxDevices: Number(maxDevices),
        maxQuality,
      }),
    });
    setEditingId(null);
    load();
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        All 4 commercial package prices, durations, and quality caps update the customer Plans & Checkout immediately.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {packages.map((pkg) => {
          const isEditing = editingId === pkg.id;
          return (
            <div key={pkg.id} className="rounded-xl border border-white/10 bg-[#10141E] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-white">{pkg.name}</h3>
                <span className="font-mono-num text-xs text-slate-400">{pkg.slug}</span>
              </div>

              {isEditing ? (
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-slate-400">Price ($ USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={priceDollars}
                      onChange={(e) => setPriceDollars(e.target.value)}
                      className="mt-1 h-9 w-full rounded border border-white/15 bg-[#0A0D14] px-2.5 font-mono-num text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400">Days</label>
                      <input
                        type="number"
                        min="1"
                        value={durationDays}
                        onChange={(e) => setDurationDays(e.target.value)}
                        className="mt-1 h-9 w-full rounded border border-white/15 bg-[#0A0D14] px-2.5 font-mono-num text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Devices</label>
                      <input
                        type="number"
                        min="1"
                        value={maxDevices}
                        onChange={(e) => setMaxDevices(e.target.value)}
                        className="mt-1 h-9 w-full rounded border border-white/15 bg-[#0A0D14] px-2.5 font-mono-num text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400">Max Quality</label>
                    <select
                      value={maxQuality}
                      onChange={(e) => setMaxQuality(e.target.value)}
                      className="mt-1 h-9 w-full rounded border border-white/15 bg-[#0A0D14] px-2 text-white"
                    >
                      <option value="HD">HD (720p)</option>
                      <option value="FHD">FHD (1080p)</option>
                      <option value="4K">4K Ultra HD</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(pkg.id)}
                      className="h-8 flex-1 rounded bg-amber-500 font-bold text-slate-950"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="h-8 rounded border border-white/15 px-3 text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-display text-2xl font-extrabold text-amber-400 font-mono-num">
                    {formatCurrency(pkg.priceCents)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {pkg.durationDays} Days · {pkg.maxQuality} · {pkg.maxDevices} Devices
                  </p>
                  <button
                    type="button"
                    onClick={() => startEdit(pkg)}
                    className="mt-2 h-9 w-full rounded-lg border border-white/15 bg-white/5 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    Edit Price & Limits
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminSubscriptionsSection() {
  const [subs, setSubs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantPackageId, setGrantPackageId] = useState('');

  const load = () => {
    Promise.all([
      apiFetch('/api/admin/subscriptions'),
      apiFetch('/api/admin/users'),
      apiFetch('/api/admin/packages'),
    ]).then(([sData, uData, pData]) => {
      setSubs(sData.subscriptions || []);
      setUsers(uData.users || []);
      setPackages(pData.packages || []);
      if (!grantUserId && uData.users?.[0]) setGrantUserId(String(uData.users[0].id));
      if (!grantPackageId && pData.packages?.[1]) setGrantPackageId(String(pData.packages[1].id));
    });
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await apiFetch('/api/admin/subscriptions/grant', {
            method: 'POST',
            body: JSON.stringify({
              userId: Number(grantUserId),
              packageId: Number(grantPackageId),
            }),
          });
          load();
        }}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#10141E] p-4"
      >
        <select
          value={grantUserId}
          onChange={(e) => setGrantUserId(e.target.value)}
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName} ({u.email || u.phone})
            </option>
          ))}
        </select>
        <select
          value={grantPackageId}
          onChange={(e) => setGrantPackageId(e.target.value)}
          className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
        >
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.durationDays}d)
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-lg bg-amber-500 px-5 text-xs font-bold text-slate-950"
        >
          Grant Subscription
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-slate-400">
            <tr>
              <th className="p-3">Subscriber</th>
              <th className="p-3">Package</th>
              <th className="p-3">Method</th>
              <th className="p-3">Expires</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {subs.map((r) => (
              <tr key={r.subscription.id}>
                <td className="p-3">
                  <p className="font-semibold text-white">{r.userName}</p>
                  <p className="text-[11px] text-slate-400">{r.userEmail}</p>
                </td>
                <td className="p-3 text-white font-semibold">{r.packageName}</td>
                <td className="p-3 uppercase text-slate-400">{r.subscription.paymentMethod}</td>
                <td className="p-3 font-mono-num text-slate-300">
                  {new Date(r.subscription.expiresAt).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <span
                    className={
                      r.subscription.status === 'active' ? 'text-emerald-400' : 'text-slate-500'
                    }
                  >
                    {r.subscription.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {r.subscription.status === 'active' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/subscriptions/${r.subscription.id}/expire`, {
                          method: 'POST',
                        });
                        load();
                      }}
                      className="rounded border border-red-500/30 px-2.5 py-1 text-red-400"
                    >
                      Expire Now
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminWalletsSection() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [adjustModal, setAdjustModal] = useState<any>(null);
  const [amountDollars, setAmountDollars] = useState('10');
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [reason, setReason] = useState('Promotional adjustment');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    apiFetch('/api/admin/wallets').then((d) => setWallets(d.wallets || []));
  };
  useEffect(() => {
    load();
  }, []);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cents = Math.round(Number(amountDollars) * 100) * (direction === 'credit' ? 1 : -1);
    try {
      await apiFetch(`/api/admin/wallets/${adjustModal.wallet.userId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ deltaCents: cents, description: reason }),
      });
      setAdjustModal(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-slate-400">
            <tr>
              <th className="p-3">Account</th>
              <th className="p-3 text-right">Balance</th>
              <th className="p-3">Updated</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {wallets.map((w) => (
              <tr key={w.wallet.id}>
                <td className="p-3">
                  <p className="font-semibold text-white">{w.userName}</p>
                  <p className="text-[11px] text-slate-400">{w.userEmail || w.userPhone}</p>
                </td>
                <td className="p-3 text-right font-mono-num font-bold text-amber-400">
                  {formatCurrency(w.wallet.balanceCents)}
                </td>
                <td className="p-3 font-mono-num text-slate-400">
                  {new Date(w.wallet.updatedAt).toLocaleString()}
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setAdjustModal(w);
                    }}
                    className="rounded border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-amber-300"
                  >
                    Adjust Balance
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleAdjust}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#10141E] p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-white">
              Adjust Wallet: {adjustModal.userName}
            </h3>
            {error && (
              <p className="rounded bg-red-500/10 p-2.5 text-xs text-red-300">{error}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as any)}
                className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
              >
                <option value="credit">Credit (+)</option>
                <option value="debit">Debit (-)</option>
              </select>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                className="h-10 rounded-lg border border-white/15 bg-[#0A0D14] px-3 font-mono-num text-sm text-white"
              />
            </div>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Audit reason"
              className="h-10 w-full rounded-lg border border-white/15 bg-[#0A0D14] px-3 text-xs text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustModal(null)}
                className="h-9 rounded-lg border border-white/15 px-4 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded-lg bg-amber-500 px-5 text-xs font-bold text-slate-950"
              >
                Commit Transaction
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function AdminPaymentsAndTransactionsSection({ mode }: { mode: 'payments' | 'transactions' }) {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    apiFetch(mode === 'payments' ? '/api/admin/payments' : '/api/admin/transactions').then((d) =>
      setRows(mode === 'payments' ? d.payments || [] : d.transactions || [])
    );
  }, [mode]);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-white/10 text-slate-400">
          <tr>
            <th className="p-3">Reference</th>
            <th className="p-3">User</th>
            <th className="p-3">{mode === 'payments' ? 'Package / Provider' : 'Description'}</th>
            <th className="p-3 text-right">Amount</th>
            <th className="p-3 text-right">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r) => {
            const item = mode === 'payments' ? r.payment : r.tx;
            return (
              <tr key={item.id}>
                <td className="p-3 font-mono-num text-slate-400">{item.referenceKey}</td>
                <td className="p-3 text-white">{r.userEmail || r.userName}</td>
                <td className="p-3 text-slate-300">
                  {mode === 'payments'
                    ? `${r.packageName || 'Package'} · ${item.provider}`
                    : item.description}
                </td>
                <td
                  className={`p-3 text-right font-mono-num font-bold ${
                    item.amountCents >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatCurrency(item.amountCents)}
                </td>
                <td className="p-3 text-right font-mono-num text-slate-400">
                  {new Date(item.createdAt).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
