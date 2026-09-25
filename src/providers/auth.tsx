import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, ApiError } from '../api/client';
import { getAccessToken } from '../lib/secureStore';
import { getCachedUser, setCachedUser, clearCachedUser } from '../lib/userCache';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const applyUser = useCallback((userData: User) => {
    setUser(userData);
    setCachedUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      await clearCachedUser();
      setUser(null);
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
