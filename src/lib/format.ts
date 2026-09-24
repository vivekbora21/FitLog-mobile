// Date & display helpers shared by the tab screens.

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Late night grind';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "Today", "Yesterday", "Mon", or "Sep 12" depending on distance from now. */
export function formatRelativeDay(iso?: string | null): string {
  if (!iso) return 'Past session';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Past session';

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDate = new Date(date);
  startOfDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDuration(seconds?: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function humanize(value?: string | null): string {
  if (!value) return '';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Last 7 days ending today, oldest first. */
export function getLastSevenDays(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }
  return days;
}

/** Compact training volume: "850 kg", "12.4 t". */
export function formatVolume(kg?: number | null): string {
  if (!kg || kg <= 0) return '0 kg';
  if (kg >= 10_000) return `${(kg / 1000).toFixed(1)} t`;
  return `${Math.round(kg).toLocaleString()} kg`;
}

/** Parses a "YYYY-MM-DD" key as a local-time date (Date's own parser would treat it as UTC). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function shiftDateKey(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function isValidDateKey(key?: string | null): key is string {
  return !!key && /^\d{4}-\d{2}-\d{2}$/.test(key) && !isNaN(parseDateKey(key).getTime());
}

/** "Today", "Yesterday", or "Mon, Sep 22" for a date key. */
export function formatDayLabel(key: string): string {
  const todayKey = toDateKey(new Date());
  if (key === todayKey) return 'Today';
  if (key === shiftDateKey(todayKey, -1)) return 'Yesterday';
  return parseDateKey(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Loose numeric parse for text inputs; empty or invalid input yields null. */
export function parseNumberInput(value: string): number | null {
  const n = parseFloat(value.replace(',', '.'));
  return isNaN(n) ? null : n;
}
