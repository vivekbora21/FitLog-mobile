import Storage from 'expo-sqlite/kv-store';

// Small synchronous key-value store for device-local state (drafts, preferences).
export const kv = {
  get(key: string): string | null {
    try {
      return Storage.getItemSync(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      Storage.setItemSync(key, value);
    } catch (error) {
      console.error(`kv: failed to write ${key}`, error);
    }
  },
  remove(key: string): void {
    try {
      Storage.removeItemSync(key);
    } catch {}
  },
};
