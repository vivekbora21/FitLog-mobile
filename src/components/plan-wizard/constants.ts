import { Dumbbell, Flame, RefreshCw, Target, Zap } from 'lucide-react-native';
import type { JourneyMode } from '../../types';

// Mirrors JourneyProgram.MIN_DURATION_DAYS / MAX_DURATION_DAYS on the backend.
export const MIN_PLAN_DAYS = 7;
export const MAX_PLAN_DAYS = 365;
export const MIN_DAYS_PER_WEEK = 3;
export const MAX_DAYS_PER_WEEK = 6;
// Backend rejects a FOCUS/HABIT goal weight more than this many kg from the current weight.
export const STEADY_MODE_MAX_GOAL_DELTA_KG = 2;

export type ModeAccent = 'rose' | 'violet' | 'cyan' | 'amber' | 'blue';

export interface ModeMeta {
  mode: JourneyMode;
  label: string;
  color: ModeAccent;
  Icon: typeof Flame;
  description: string;
}

export const MODE_META: ModeMeta[] = [
  {
    mode: 'CUT',
    label: 'Cut',
    color: 'rose',
    Icon: Flame,
    description: 'Strip body fat while holding onto strength.',
  },
  {
    mode: 'BULK',
    label: 'Bulk',
    color: 'violet',
    Icon: Dumbbell,
    description: 'Clean surplus pacing to maximise muscle gain.',
  },
  {
    mode: 'RECOMP',
    label: 'Recomp',
    color: 'blue',
    Icon: RefreshCw,
    description: 'Build muscle and lose fat at the same time.',
  },
  {
    mode: 'FOCUS',
    label: 'Focus',
    color: 'cyan',
    Icon: Target,
    description: 'Heavy compound progression to break plateaus.',
  },
  {
    mode: 'HABIT',
    label: 'Habit',
    color: 'amber',
    Icon: Zap,
    description: 'Build consistency and routine momentum.',
  },
];

export const MODE_META_BY_MODE: Record<JourneyMode, ModeMeta> = MODE_META.reduce(
  (acc, m) => ({ ...acc, [m.mode]: m }),
  {} as Record<JourneyMode, ModeMeta>
);

export const DURATION_PRESETS = [21, 30, 60, 90].map((d) => ({ value: d, label: `${d}d` }));
export const DAYS_PER_WEEK_OPTIONS = [3, 4, 5, 6].map((n) => ({ value: n, label: `${n}×/wk` }));

export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

export const SEX_OPTIONS: { value: 'MALE' | 'FEMALE'; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
];
