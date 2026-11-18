import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, CreditCard, ShieldCheck, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, formatCurrency, getDeviceFingerprint } from '../services/api.ts';
import { SubscriptionPackage } from '../types/platform.ts';

interface PlansPageProps {
  navigate: (path: string) => void;
}

export function PlansPage({ navigate }: PlansPageProps) {
  const { user, activeSubscription } = useAuth();
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/packages')
      .then((data) => {
        setPackages(data.packages || []);
        setError(null);
      })
      .catch((err) => setError(err?.message || 'Failed to load subscription plans'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-400">
          Membership Tiers
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-white sm:text-4xl">
          Simple, Transparent Streaming Plans
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Every plan unlocks Live TV with multi-source HLS failover, movies, drama, web series, and sports. Prices and access limits are managed centrally.
        </p>
      </div>

      {error ? (
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center text-sm text-red-300">
          <AlertCircle className="mx-auto mb-2 h-6 w-6" />
          {error}
        </div>
      ) : loading ? (
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-96 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {packages.map((pkg) => {
            const isCurrent = activeSubscription?.packageId === pkg.id;
            const highlight = pkg.slug === 'premium';
            return (
              <div
                key={pkg.id}
                className={`flex flex-col justify-between rounded-2xl border p-6 transition-colors ${
                  highlight ? 'border-amber-400/60 bg-[#131826]' : 'border-white/10 bg-[#0F131C]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-xl font-bold text-white">{pkg.name}</h2>
                    {highlight && <span className="text-xs font-semibold text-amber-400">Most Popular</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{pkg.description}</p>

                  <div className="mt-5 flex items-baseline gap-1.5 border-b border-white/10 pb-5">
                    <span className="font-display text-3xl font-extrabold text-white font-mono-num">
                      {pkg.priceCents === 0 ? 'Free' : formatCurrency(pkg.priceCents)}
                    </span>
                    <span className="text-xs text-slate-400">/ {pkg.durationDays} days</span>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-300">
                    <span>{pkg.maxQuality} Quality</span>
                    <span aria-hidden="true">·</span>
                    <span>{pkg.maxDevices} {pkg.maxDevices === 1 ? 'Device' : 'Devices'}</span>
                  </div>

                  <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
                    {pkg.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={isCurrent || (pkg.isTrial && Boolean(user?.trialUsed))}
                  onClick={() => {
                    if (!user) navigate('/login');
                    else navigate(`/checkout/${pkg.id}`);
                  }}
                  className={`mt-8 h-11 w-full rounded-lg text-sm font-bold transition-colors ${
                    isCurrent
                      ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 cursor-default'
                      : pkg.isTrial && user?.trialUsed
                      ? 'border border-white/10 bg-white/5 text-slate-500 cursor-not-allowed'
                      : highlight
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  {isCurrent
                    ? 'Current Plan'
                    : pkg.isTrial && user?.trialUsed
                    ? 'Trial Already Used'
                    : pkg.isTrial
                    ? 'Start 15-Day Free Trial'
                    : 'Choose Plan'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CheckoutPage({
  packageId,
  navigate,
}: {
  packageId: number;
  navigate: (path: string) => void;
}) {
  const { user, wallet, refreshSession } = useAuth();
  const [pkg, setPkg] = useState<SubscriptionPackage | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card'>('wallet');
  const [topupAmountDollars, setTopupAmountDollars] = useState('25');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/packages')
      .then((data) => {
        const found = (data.packages || []).find((p: SubscriptionPackage) => p.id === packageId);
        setPkg(found || null);
      })
      .catch((err) => setError(err?.message || 'Failed to load plan details'))
      .finally(() => setLoading(false));
  }, [packageId]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Sign In Required</h1>
        <p className="mt-2 text-sm text-slate-400">Please sign in to complete your subscription checkout.</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-5 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-bold text-slate-950"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 skeleton-shimmer h-80 rounded-2xl" />;
  }

  if (!pkg) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-white font-semibold">{error || 'Subscription package not found.'}</p>
        <button
          type="button"
          onClick={() => navigate('/plans')}
          className="mt-4 rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-slate-950"
        >
          View Plans
        </button>
      </div>
    );
  }

  const walletBalance = wallet?.balanceCents ?? 0;
  const sufficientBalance = pkg.isTrial || walletBalance >= pkg.priceCents;

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cents = Math.round(Number(topupAmountDollars) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      setError('Enter a valid amount of at least $1.00');
      return;
    }
    setProcessing(true);
    try {
      await apiFetch('/api/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amountCents: cents }),
      });
      await refreshSession();
      setSuccess(`Credited ${formatCurrency(cents)} to your VEXORA wallet.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckout = async () => {
    setError(null);
    setSuccess(null);
    setProcessing(true);
    try {
      await apiFetch('/api/subscriptions/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          packageId: pkg.id,
          paymentMethod: pkg.isTrial ? 'trial' : paymentMethod,
          deviceFingerprint: getDeviceFingerprint(),
        }),
      });
      await refreshSession();
      setSuccess(`${pkg.name} subscription activated! Redirecting to your dashboard...`);
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err: any) {
      setError(err.message || 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-white">Subscription Checkout</h1>
      <p className="mt-1 text-sm text-slate-400">
        Atomic wallet deduction and instant plan activation.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              {success}
            </div>
          )}

          {!pkg.isTrial && (
            <div className="rounded-2xl border border-white/10 bg-[#10141E] p-6">
              <h2 className="font-display text-lg font-bold text-white">Payment Method</h2>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('wallet')}
                  className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors ${
                    paymentMethod === 'wallet'
                      ? 'border-amber-400 bg-amber-500/10'
                      : 'border-white/10 bg-[#0A0D14] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-amber-400" />
                    <div>
                      <p className="text-sm font-semibold text-white">VEXORA Wallet</p>
                      <p className="text-xs text-slate-400">
                        Available balance:{' '}
                        <span className="font-mono-num text-white">{formatCurrency(walletBalance)}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-400">
                    {sufficientBalance ? 'Ready' : 'Top-up needed'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors ${
                    paymentMethod === 'card'
                      ? 'border-amber-400 bg-amber-500/10'
                      : 'border-white/10 bg-[#0A0D14] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-slate-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">Credit / Debit Card (Stripe)</p>
                      <p className="text-xs text-slate-400">
                        External gateway (requires STRIPE_SECRET_KEY in environment)
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {paymentMethod === 'wallet' && !sufficientBalance && (
                <form
                  onSubmit={handleTopup}
                  className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/5 p-4"
                >
                  <p className="text-xs font-semibold text-amber-300">
                    Add Funds to Wallet to Complete Purchase
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      step="1"
                      value={topupAmountDollars}
                      onChange={(e) => setTopupAmountDollars(e.target.value)}
                      className="h-10 w-32 rounded-lg border border-white/15 bg-[#0A0D14] px-3 font-mono-num text-sm text-white focus:border-amber-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={processing}
                      className="h-10 rounded-lg bg-white/15 px-4 text-xs font-semibold text-white hover:bg-white/25"
                    >
                      Credit Wallet
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0F131C] p-4 text-xs text-slate-400">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
            <span>Protected by transactional idempotency keys to prevent duplicate charges.</span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-white/10 bg-[#10141E] p-6">
            <h2 className="font-display text-lg font-bold text-white">Order Summary</h2>
            <div className="mt-4 space-y-3 border-b border-white/10 pb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Plan</span>
                <span className="font-semibold text-white">{pkg.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duration</span>
                <span className="font-mono-num text-white">{pkg.durationDays} Days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Max Quality</span>
                <span className="text-white">{pkg.maxQuality}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Devices</span>
                <span className="font-mono-num text-white">{pkg.maxDevices}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Total Due</span>
              <span className="font-display text-2xl font-extrabold text-amber-400 font-mono-num">
                {pkg.isTrial ? '$0.00' : formatCurrency(pkg.priceCents)}
              </span>
            </div>

            <button
              type="button"
              disabled={processing || (paymentMethod === 'wallet' && !sufficientBalance)}
              onClick={handleCheckout}
              className="mt-6 h-11 w-full rounded-lg bg-amber-500 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {processing
                ? 'Processing...'
                : pkg.isTrial
                ? 'Activate 15-Day Free Trial'
                : 'Confirm & Activate Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
