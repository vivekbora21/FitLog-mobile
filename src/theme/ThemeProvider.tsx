import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, StyleSheet, useColorScheme } from 'react-native';
import { darkColors, lightColors, shadowsFor, type Palette, type Shadows } from './tokens';
import { getThemePreference, setThemePreference, type ThemePreference } from './preference';

export type { ThemePreference };

export interface Theme {
  colors: Palette;
  shadows: Shadows;
  isDark: boolean;
}

interface ThemeContextValue extends Theme {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
}

const LIGHT: Theme = { colors: lightColors, shadows: shadowsFor(false), isDark: false };
const DARK: Theme = { colors: darkColors, shadows: shadowsFor(true), isDark: true };

// Pin native UI (alerts, pickers, keyboards) to the chosen scheme; 'system' follows the OS.
function applyNativeScheme(preference: ThemePreference) {
  Appearance.setColorScheme?.(preference === 'system' ? 'unspecified' : preference); // not implemented on web
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getThemePreference);
  const systemScheme = useColorScheme();

  useEffect(() => {
    applyNativeScheme(preference);
  }, [preference]);

  const setPreference = useCallback((value: ThemePreference) => {
    setThemePreference(value);
    setPreferenceState(value);
  }, []);

  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark');
  const value = useMemo(
    () => ({ ...(isDark ? DARK : LIGHT), preference, setPreference }),
    [isDark, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

/**
 * Theme-aware replacement for a module-level `StyleSheet.create`. Styles are built once per
 * palette and cached, so switching themes just swaps to the other sheet.
 *
 *   const useStyles = makeStyles(({ colors }) => ({ card: { backgroundColor: colors.surface } }));
 *   // in the component: const styles = useStyles();
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T) {
  const cache = new Map<boolean, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let sheet = cache.get(theme.isDark);
    if (!sheet) {
      sheet = StyleSheet.create(factory(theme.isDark ? DARK : LIGHT));
      cache.set(theme.isDark, sheet);
    }
    return sheet;
  };
}
