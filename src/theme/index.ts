import { Appearance } from 'react-native';
import { getThemePreference, type ThemePreference } from './preference';

export type { ThemePreference };

const lightColors = {
  // Light slate backgrounds & surfaces
  background: '#F6F8FA',
  canvas: '#EEF2F6',
  surface: '#FFFFFF',
  surfaceElevated: '#F8FAFC',
  surfaceHover: '#EEF2F6',
  surfaceHighlighted: '#F0FDFA',
  tabBar: 'rgba(255, 255, 255, 0.97)',

  // Borders
  border: '#E2E8F0',
  borderSubtle: '#E2E8F0',
  borderBright: '#CBD5E1',
  borderGlow: 'rgba(15, 118, 110, 0.35)',

  // Primary Accent - FitLog Athletic Emerald / Teal
  primary: '#0F766E', // requested emerald/teal accent
  primaryHover: '#0D645D',
  primaryLight: '#059669', // slightly deeper emerald so it stays legible on white
  primaryGlow: 'rgba(16, 185, 129, 0.15)',
  primarySurface: 'rgba(15, 118, 110, 0.10)',

  // Functional Accents
  cyan: '#0284C7',
  cyanGlow: 'rgba(2, 132, 199, 0.15)',
  violet: '#7C3AED',
  amber: '#D97706',
  amberGlow: 'rgba(217, 119, 6, 0.15)',
  rose: '#E11D48',
  roseGlow: 'rgba(225, 29, 72, 0.15)',
  blue: '#2563EB',

  // Progress tracks — translucent so they read on both surface and surfaceElevated
  track: 'rgba(100, 116, 139, 0.14)',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',

  // Statuses
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  errorBackground: 'rgba(239, 68, 68, 0.12)',
  errorBorder: 'rgba(239, 68, 68, 0.3)',
};

const darkColors: typeof lightColors = {
  ...lightColors,
  // Dark slate backgrounds & surfaces
  background: '#080B11',
  canvas: '#0B0F19',
  surface: '#111827',
  surfaceElevated: '#1E293B',
  surfaceHover: '#283548',
  surfaceHighlighted: '#0F2423',
  tabBar: 'rgba(17, 24, 39, 0.97)',

  border: '#1F2937',
  borderSubtle: '#334155',
  borderBright: '#475569',
  borderGlow: 'rgba(15, 118, 110, 0.4)',

  primaryLight: '#10B981',
  primarySurface: 'rgba(15, 118, 110, 0.12)',

  track: 'rgba(148, 163, 184, 0.16)',

  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#080B11',
};

export const themePreference: ThemePreference = getThemePreference();

// Pin native UI (alerts, pickers, keyboards) to the chosen scheme; 'system' follows the OS.
if (themePreference !== 'system') Appearance.setColorScheme?.(themePreference); // not implemented on web

export const isDark =
  themePreference === 'dark' || (themePreference === 'system' && Appearance.getColorScheme() === 'dark');

export const colors = isDark ? darkColors : lightColors;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.3 : 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.25 : 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  glow: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.35 : 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const typography = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};
