import { Dumbbell, Flame, RefreshCw, Target } from 'lucide-react-native';
import type { PlanEquipmentLevel, PlanExperience, RecompDirection } from '../../types';
import type { BuilderMode } from './types';

// Mirrors workouts.plan_engine.config.MIN_DURATION_DAYS/MAX_DURATION_DAYS.
export const MIN_PLAN_DAYS = 7;
export const MAX_PLAN_DAYS = 365;
export const MIN_DAYS_PER_WEEK = 3;
export const MAX_DAYS_PER_WEEK = 6;

export type ModeAccent = 'rose' | 'violet' | 'cyan' | 'amber' | 'blue';

export interface ModeCardMeta {
  mode: BuilderMode;
  /** Plain-language card title (spec v1.6 section 8.1), e.g. "Lose fat". */
  title: string;
  /** Mode name shown as a subtitle, e.g. "Cut". */
  subtitle: string;
  /** One-line expectation under the title. */
  expectation: string;
  color: ModeAccent;
  Icon: typeof Flame;
}

export const MODE_CARDS: ModeCardMeta[] = [
  {
    mode: 'CUT',
    title: 'Lose fat',
    subtitle: 'Cut',
    expectation: 'A calorie deficit paced to your goal weight and timeline.',
    color: 'rose',
    Icon: Flame,
  },
  {
    mode: 'BULK',
    title: 'Build muscle',
    subtitle: 'Bulk',
    expectation: 'A calorie surplus paced to add size with manageable fat gain.',
    color: 'violet',
    Icon: Dumbbell,
  },
  {
    mode: 'RECOMP',
    title: 'Lose fat and build muscle',
    subtitle: 'Recomp',
    expectation: 'Calories near maintenance while training drives the change.',
    color: 'blue',
    Icon: RefreshCw,
  },
  {
    mode: 'FOCUS',
    title: 'Get stronger',
    subtitle: 'Focus',
    expectation: 'Maintenance calories while you push performance in the gym.',
    color: 'cyan',
    Icon: Target,
  },
];

export const MODE_CARD_BY_MODE: Record<BuilderMode, ModeCardMeta> = MODE_CARDS.reduce(
  (acc, m) => ({ ...acc, [m.mode]: m }),
  {} as Record<BuilderMode, ModeCardMeta>
);

export const DURATION_PRESETS = [21, 30, 60, 90].map((d) => ({ value: d, label: `${d}d` }));
export const DAYS_PER_WEEK_OPTIONS = [3, 4, 5, 6].map((n) => ({ value: n, label: `${n}×` }));

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

export const RECOMP_DIRECTION_OPTIONS: { value: RecompDirection; label: string }[] = [
  { value: 'lean_out', label: 'Lean out slightly' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'lean_gain', label: 'Build slightly' },
];

export const EXPERIENCE_OPTIONS: { value: PlanExperience; label: string }[] = [
  { value: 'BEGINNER', label: 'New (under 6 months)' },
  { value: 'INTERMEDIATE', label: 'Some experience (6 mo-2 yrs)' },
  { value: 'ADVANCED', label: 'Experienced (2+ yrs)' },
];

export const EQUIPMENT_OPTIONS: { value: PlanEquipmentLevel; label: string }[] = [
  { value: 'full_gym', label: 'Full gym' },
  { value: 'home_basic', label: 'Home (dumbbells + bench)' },
  { value: 'minimal', label: 'Minimal (bodyweight + bands)' },
];

// D2 (spec v1.6 section 0A): 18+ only in v1 -- mirrors
// workouts.plan_engine.config.MIN_AGE for inline UI feedback; the server's
// V-01 PROFILE_OUT_OF_RANGE is still the enforced rule.
export const MIN_BUILDER_AGE = 18;
