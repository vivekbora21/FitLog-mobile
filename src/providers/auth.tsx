import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, ApiError } from '../api/client';
import { getAccessToken } from '../lib/secureStore';
import { getCachedUser, setCachedUser, clearCachedUser } from '../lib/userCache';
import { resumeQueueAfterLogin, setOfflineQueueUser } from '../lib/offlineQueue';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: { email: string; password: string; first_name: string; last_name: string }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// A sleeping backend (Render free tier) can take ~30-60s to wake, well past the client's 10s timeout.
const RESTORE_ATTEMPTS = 4;

function isAuthRejection(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

// Keeps the server's per-user timezone (used for every "today" boundary: plan day
// numbering, nutrition date, exercise-calorie attribution) in sync with the device's
// actual timezone. Best-effort and silent: a stale timezone is a correctness bug worth
// fixing quietly in the background, not something to interrupt the user about, and it
// must never block sign-in if the network call fails.
const TIMEZONE_CANONICAL_MAP: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
};

function syncDeviceTimezone(userData: User) {
  try {
    const rawTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const deviceTimezone = rawTimezone ? (TIMEZONE_CANONICAL_MAP[rawTimezone] || rawTimezone) : null;
    if (deviceTimezone && deviceTimezone !== userData.profile?.timezone) {
      api.updateMe({ profile: { timezone: deviceTimezone } }).catch(() => {
        // Offline or transient failure — next successful sync point will retry.
      });
    }
  } catch {
    // Intl.DateTimeFormat should always be available on Hermes, but never let
    // timezone detection itself break sign-in.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const applyUser = useCallback((userData: User) => {
    setUser(userData);
    setCachedUser(userData);
    syncDeviceTimezone(userData);
    // Scope the offline write queue to this user (BUG-11) — a shared device switching
    // accounts must never replay one user's queued writes into another's data — and
    // resume any auto-retry that a prior session's 401 had paused.
    setOfflineQueueUser(String(userData.id));
    resumeQueueAfterLogin();
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      await clearCachedUser();
      setUser(null);
      setOfflineQueueUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await api.getMe();
      applyUser(userData);
      return userData;
    } catch (error) {
      console.warn('Failed to refresh user data:', error);
      return null;
    }
  }, [applyUser]);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    await api.login(email.trim(), password);
    const userData = await api.getMe();
    applyUser(userData);
    return userData;
  }, [applyUser]);

  const register = useCallback(async (payload: { email: string; password: string; first_name: string; last_name: string }): Promise<User> => {
    await api.register(payload);
    const userData = await api.getMe();
    applyUser(userData);
    return userData;
  }, [applyUser]);

  useEffect(() => {
    // Fired only when the server rejects the session (refresh token missing/expired/invalid).
    api.onUnauthorized(() => {
      clearCachedUser();
      setUser(null);
    });

    // Stay signed in until the user logs out: tokens are cleared only on a real 401, never on
    // network errors or timeouts, so killing the app while offline or while the backend sleeps
    // no longer signs the user out.
    async function bootstrapAuth() {
      const token = await getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const cachedUser = await getCachedUser();
      if (cachedUser) {
        // Enter the app immediately; revalidate in the background.
        setUser(cachedUser);
        setIsLoading(false);
      }

      const attempts = cachedUser ? 1 : RESTORE_ATTEMPTS;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          applyUser(await api.getMe());
          break;
        } catch (error) {
          if (isAuthRejection(error)) break; // client already cleared tokens and fired onUnauthorized
          console.warn(`Could not reach backend to restore session (attempt ${attempt}/${attempts}):`, error);
        }
      }
      setIsLoading(false);
    }

    bootstrapAuth();
  }, [applyUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
