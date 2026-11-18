import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import {
  apiFetch,
  clearSessionToken,
  detectClientPlatform,
  getDeviceFingerprint,
  setSessionToken,
} from '../services/api.ts';
import { UserDevice, UserProfile, UserSubscription, WalletInfo } from '../types/platform.ts';

interface AuthContextValue {
  user: UserProfile | null;
  wallet: WalletInfo | null;
  activeSubscription: UserSubscription | null;
  devices: UserDevice[];
  loading: boolean;
  isAdmin: boolean;
  refreshSession: () => Promise<void>;
  loginWithGoogle: (activateFreeTrial?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function formatGoogleAuthError(err: any): string {
  const code = err?.code || '';
  if (code === 'auth/popup-blocked') {
    return 'Popup was blocked by your browser. Please allow popups for this site and click Google Sign-In again.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in popup was closed before completing authentication.';
  }
  if (code === 'auth/unauthorized-domain') {
    return `This preview domain (${window.location.hostname}) is not authorized in Firebase Authentication settings.`;
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google Sign-In provider is not enabled in Firebase Authentication Console.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error while connecting to Google authentication.';
  }
  return err?.message || 'Google Sign-In failed. Please try again.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<UserSubscription | null>(null);
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiFetch('/api/auth/me');
      setUser(data.user);
      setWallet(data.wallet);
      setActiveSubscription(data.activeSubscription);
      setDevices(data.devices || []);
    } catch {
      setUser(null);
      setWallet(null);
      setActiveSubscription(null);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const loginWithGoogle = useCallback(
    async (activateFreeTrial = true) => {
      let idToken = '';
      try {
        const result = await signInWithPopup(auth, googleAuthProvider);
        idToken = await result.user.getIdToken();
      } catch (err: any) {
        throw new Error(formatGoogleAuthError(err));
      }

      const { deviceName, platform } = detectClientPlatform();
      const res = await apiFetch('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({
          idToken,
          deviceFingerprint: getDeviceFingerprint(),
          deviceName,
          platform,
          activateFreeTrial,
        }),
      });

      if (res?.token) {
        setSessionToken(res.token);
      }
      if (res?.user) {
        setUser(res.user);
      }
      await refreshSession();
    },
    [refreshSession]
  );

  const logout = useCallback(async () => {
    clearSessionToken();
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
    setUser(null);
    setWallet(null);
    setActiveSubscription(null);
    setDevices([]);
  }, []);

  const isAdmin = Boolean(
    user && ['admin', 'super_admin', 'editor', 'operator'].includes(user.role)
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        wallet,
        activeSubscription,
        devices,
        loading,
        isAdmin,
        refreshSession,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
