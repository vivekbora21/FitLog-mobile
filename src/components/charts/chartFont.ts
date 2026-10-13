import { Platform } from 'react-native';

// SVG <text> on web falls back to the browser's serif default instead of inheriting
// the app's system font, so chart labels need the stack spelled out explicitly.
export const CHART_FONT_FAMILY = Platform.select({
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  default: undefined,
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-16" -> "Sep 16" without timezone drift from Date parsing. */
export function formatShortDate(dateKey: string): string {
  const [, m, d] = dateKey.slice(0, 10).split('-').map(Number);
  if (!m || !d) return dateKey;
  return `${MONTHS[m - 1]} ${d}`;
}
