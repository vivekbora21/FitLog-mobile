import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { getAccessToken, clearTokens } from '../lib/secureStore';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await api.getMe();
      setUser(userData);
    } catch (error) {
      console.warn('Failed to refresh user data:', error);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await api.login(email.trim(), password);
    const userData = await api.getMe();
    setUser(userData);
  }, []);

  useEffect(() => {
    api.onUnauthorized(() => {
      setUser(null);
    });

    async function bootstrapAuth() {
      try {
        const token = await getAccessToken();
        if (token) {
          const userData = await api.getMe();
          setUser(userData);
        }
      } catch (error) {
        console.warn('Failed to restore authentication session:', error);
        await clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    bootstrapAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
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
