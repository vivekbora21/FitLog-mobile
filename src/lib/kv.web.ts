// Web build avoids expo-sqlite; localStorage gives the same synchronous API.
export const kv = {
  get(key: string): string | null {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
};
