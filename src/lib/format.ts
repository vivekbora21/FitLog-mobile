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

export interface ProgramDayDateInfo {
  dateKey: string;
  formattedShort: string; // e.g. "10 Sep"
  formattedFull: string;  // e.g. "Wed, 10 Sep"
  weekday: string;        // e.g. "Wed"
  dayOfMonth: number;     // e.g. 10
  monthShort: string;     // e.g. "Sep"
}

/** Given program start date (YYYY-MM-DD) and a day number (1-indexed), returns date details */
export function getProgramDayDate(startDateStr: string | null | undefined, dayNumber: number): ProgramDayDateInfo | null {
  if (!startDateStr || !isValidDateKey(startDateStr) || !dayNumber || dayNumber < 1) return null;
  const d = parseDateKey(startDateStr);
  d.setDate(d.getDate() + (dayNumber - 1));
  const dateKey = toDateKey(d);
  const formattedShort = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  const formattedFull = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const dayOfMonth = d.getDate();
  const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
  return { dateKey, formattedShort, formattedFull, weekday, dayOfMonth, monthShort };
}

/** Given a date key and program start date, returns the program day number (1-indexed) if within duration */
export function getDateProgramDayNumber(startDateStr: string | null | undefined, dateKey: string, durationDays: number = 30): number | null {
  if (!startDateStr || !isValidDateKey(startDateStr) || !isValidDateKey(dateKey)) return null;
  const start = parseDateKey(startDateStr);
  const target = parseDateKey(dateKey);
  const diffDays = Math.round((target.getTime() - start.getTime()) / 86_400_000);
  const dayNum = diffDays + 1;
  if (dayNum >= 1 && dayNum <= durationDays) return dayNum;
  return null;
}

/** Calculates age in years from YYYY-MM-DD string */
export function calculateAge(dobStr?: string | null): number | null {
  if (!dobStr || !isValidDateKey(dobStr)) return null;
  const [y, m, d] = dobStr.split('-').map(Number);
  const birthDate = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 && age < 130 ? age : null;
}

/** Formats YYYY-MM-DD into "15 May 1998" */
export function formatDobDisplay(dobStr?: string | null): string {
  if (!dobStr || !isValidDateKey(dobStr)) return '--';
  const d = parseDateKey(dobStr);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
