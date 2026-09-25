export type ThemePreference = 'light' | 'dark' | 'system';

const KEY = 'fitlog_theme_preference';

export function getThemePreference(): ThemePreference {
  try {
    const value = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {}
  return 'light';
}

export function setThemePreference(value: ThemePreference): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {}
}
