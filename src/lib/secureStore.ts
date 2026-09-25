import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'fitlog_access_token';
const REFRESH_TOKEN_KEY = 'fitlog_refresh_token';

// In-memory fallback for environments where neither SecureStore nor window is present
const memoryStore: Record<string, string> = {};

export async function getAccessToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
      }
      return memoryStore[ACCESS_TOKEN_KEY] || null;
    }
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Error reading access token from SecureStore:', error);
    return null;
  }
}

export async function setAccessToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
      }
      memoryStore[ACCESS_TOKEN_KEY] = token;
      return;
    }
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  } catch (error) {
    console.error('Error saving access token to SecureStore:', error);
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
      }
      return memoryStore[REFRESH_TOKEN_KEY] || null;
    }
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Error reading refresh token from SecureStore:', error);
    return null;
  }
}

export async function setRefreshToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
      }
      memoryStore[REFRESH_TOKEN_KEY] = token;
      return;
    }
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Error saving refresh token to SecureStore:', error);
  }
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  await Promise.all([setAccessToken(access), setRefreshToken(refresh)]);
}

export async function clearTokens(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      }
      delete memoryStore[ACCESS_TOKEN_KEY];
      delete memoryStore[REFRESH_TOKEN_KEY];
      return;
    }
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  } catch (error) {
    console.error('Error clearing tokens from SecureStore:', error);
  }
}

// Small non-secret per-device flags (e.g. "onboarding skipped"). Web uses localStorage so it outlives the tab.
export async function getFlag(key: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && window.localStorage?.getItem(key) === '1';
    }
    return (await SecureStore.getItemAsync(key)) === '1';
  } catch {
    return false;
  }
}

export async function setFlag(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage?.setItem(key, '1');
      return;
    }
    await SecureStore.setItemAsync(key, '1');
  } catch (error) {
    console.error('Error saving flag:', error);
  }
}
