import Storage from 'expo-sqlite/kv-store';

export type ThemePreference = 'light' | 'dark' | 'system';

const KEY = 'fitlog_theme_preference';

// Read synchronously: the palette is chosen when the theme module first loads,
// before any StyleSheet.create call captures its colors.
export function getThemePreference(): ThemePreference {
  try {
    const value = Storage.getItemSync(KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch (error) {
    console.error('Error reading theme preference:', error);
  }
  return 'light';
}

export function setThemePreference(value: ThemePreference): void {
  try {
    Storage.setItemSync(KEY, value);
  } catch (error) {
    console.error('Error saving theme preference:', error);
  }
}
