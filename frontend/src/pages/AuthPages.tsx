import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  apiFetch,
  detectClientPlatform,
  getDeviceFingerprint,
  setSessionToken,
} from '../services/api.ts';

interface AuthPageProps {
  navigate: (path: string) => void;
}

export function LoginPage({ navigate }: AuthPageProps) {
  const { refreshSession, loginWithGoogle } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [issuedTokenHint, setIssuedTokenHint] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { deviceName, platform } = detectClientPlatform();
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          password,
          deviceFingerprint: getDeviceFingerprint(),
          deviceName,
          platform,
        }),
      });
      if (res?.token) {
        setSessionToken(res.token);
      }
      await refreshSession();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Google Sign-In was cancelled or failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSuccess(null);
    try {
      const res = await apiFetch('/api/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail }),
      });
      setResetSuccess(res.message);
      if (res.resetToken) {
        setIssuedTokenHint(res.resetToken);
        setResetToken(res.resetToken);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      setResetMode(false);
      setResetSuccess('Password reset complete. Sign in with your new password.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-white/10 bg-[#12141C] p-7 shadow-2xl">
        <h1 className="font-display text-2xl font-bold text-white">
          {resetMode ? 'Reset Password' : 'Sign In to VEXORA'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {resetMode
            ? 'Request a recovery token and set a new password.'
            : 'Access Live TV, 4K movies, drama, and your saved watchlist.'}
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}
        {resetSuccess && (
          <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300">
            {resetSuccess}
          </div>
        )}

        {!resetMode ? (
          <>
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300">Email or Phone Number</label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or +1555..."
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-[#0A0A0D] px-3.5 text-sm text-white placeholder-slate-500 focus:border-pink-400 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => setResetMode(true)}
                    className="text-xs font-medium text-pink-400 hover:text-pink-300"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-[#0A0A0D] px-3.5 text-sm text-white placeholder-slate-500 focus:border-pink-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-sm font-bold text-white shadow-lg shadow-pink-500/20 hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {submitting ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
              <div className="h-px flex-1 bg-white/10" />
              <span>or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleGoogleSignIn}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-white/20 bg-white/5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50 transition-colors"
            >
              <GoogleMark />
              <span>Continue with Google</span>
            </button>

            <div className="mt-5 rounded-xl border border-white/10 bg-[#0A0A0D]/70 p-3 text-[11px] text-slate-400">
              <p className="font-semibold text-slate-300 mb-1.5">Quick Demo Credentials</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('member@velostream.tv');
                    setPassword('VeloUser!2026');
                  }}
                  className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-slate-200 hover:bg-white/10"
                >
                  Fill Member Demo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('admin@velostream.tv');
                    setPassword('VeloAdmin!2026');
                  }}
                  className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-slate-200 hover:bg-white/10"
                >
                  Fill Admin Demo
                </button>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              New to VEXORA?{' '}
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="font-semibold text-pink-400 hover:text-pink-300"
              >
                Create account &amp; start 15-day free trial
              </button>
            </p>
          </>
        ) : (
          <div className="mt-6 space-y-5">
            <form onSubmit={handleRequestReset} className="space-y-3">
              <label className="block text-xs font-medium text-slate-300">Account Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-10 flex-1 rounded-xl border border-white/15 bg-[#0A0A0D] px-3 text-sm text-white focus:border-pink-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-white/10 px-4 text-xs font-semibold text-white hover:bg-white/20"
                >
                  Send Token
                </button>
              </div>
              {issuedTokenHint && (
                <p className="font-mono-num text-[11px] text-pink-300 break-all">
                  Dev token (SMTP unset): {issuedTokenHint}
                </p>
              )}
            </form>

            <form onSubmit={handleConfirmReset} className="space-y-3 border-t border-white/10 pt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300">Reset Token</label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-white/15 bg-[#0A0A0D] px-3 text-sm text-white focus:border-pink-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-white/15 bg-[#0A0A0D] px-3 text-sm text-white focus:border-pink-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="h-10 w-full rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-sm font-bold text-white"
              >
                Update Password
              </button>
            </form>

            <button
              type="button"
              onClick={() => setResetMode(false)}
              className="w-full text-center text-xs text-slate-400 hover:text-white"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function RegisterPage({ navigate }: AuthPageProps) {
  const { refreshSession, loginWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [activateFreeTrial, setActivateFreeTrial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { deviceName, platform } = detectClientPlatform();
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password,
          activateFreeTrial,
          deviceFingerprint: getDeviceFingerprint(),
          deviceName,
          platform,
        }),
      });
      if (res?.token) {
        setSessionToken(res.token);
      }
      await refreshSession();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle(activateFreeTrial);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Google Sign-Up failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-white/10 bg-[#12141C] p-7 shadow-2xl">
        <h1 className="font-display text-2xl font-bold text-white">Create VEXORA Account</h1>
        <p className="mt-1 text-sm text-slate-400">
          Register with email or phone to start your 15-day Free Access trial.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jordan Blake"
              className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-[#0A0A0D] px-3.5 text-sm text-white focus:border-pink-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-[#0A0A0D] px-3.5 text-sm text-white focus:border-pink-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Phone Number (optional if email provided)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 010 2020"
              className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-[#0A0A0D] px-3.5 text-sm text-white focus:border-pink-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Password (min 8 characters)</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-[#0A0A0D] px-3.5 text-sm text-white focus:border-pink-400 focus:outline-none"
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-[#0A0A0D] p-3 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={activateFreeTrial}
              onChange={(e) => setActivateFreeTrial(e.target.checked)}
              className="mt-0.5 accent-pink-500"
            />
            <span>Activate complimentary 15-day Free Access trial upon signup (one per person/device)</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-sm font-bold text-white shadow-lg shadow-pink-500/20 hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {submitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-white/10" />
          <span>or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={handleGoogleSignUp}
          className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-white/20 bg-white/5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
        >
          <GoogleMark />
          <span>Sign up with Google</span>
        </button>

        <p className="mt-6 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <button type="button" onClick={() => navigate('/login')} className="font-semibold text-pink-400 hover:text-pink-300">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.6-5.4 3.6-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
