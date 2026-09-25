import type { User } from '../types';

// Web mirrors the token storage (sessionStorage), so the cached user lives exactly as long as the tokens.
const USER_CACHE_KEY = 'fitlog_cached_user';

export async function getCachedUser(): Promise<User | null> {
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage?.getItem(USER_CACHE_KEY) : null;
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export async function setCachedUser(user: User): Promise<void> {
  try {
    if (typeof window !== 'undefined') window.sessionStorage?.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error caching user:', error);
  }
}

export async function clearCachedUser(): Promise<void> {
  try {
    if (typeof window !== 'undefined') window.sessionStorage?.removeItem(USER_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing cached user:', error);
  }
}
