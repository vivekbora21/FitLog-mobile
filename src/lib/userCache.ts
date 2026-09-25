import Storage from 'expo-sqlite/kv-store';
import type { User } from '../types';

// Last known /auth/me/ payload, so a cold start can enter the app without waiting on the network.
// Kept in SQLite rather than SecureStore because the payload can exceed SecureStore's size limit.
const USER_CACHE_KEY = 'fitlog_cached_user';

export async function getCachedUser(): Promise<User | null> {
  try {
    const raw = await Storage.getItemAsync(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export async function setCachedUser(user: User): Promise<void> {
  try {
    await Storage.setItemAsync(USER_CACHE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error caching user:', error);
  }
}

export async function clearCachedUser(): Promise<void> {
  try {
    await Storage.removeItemAsync(USER_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing cached user:', error);
  }
}
