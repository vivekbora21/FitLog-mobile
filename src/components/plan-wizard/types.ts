import type { PlanEquipmentLevel, PlanExperience, RecompDirection } from '../../types';

/** The four goal cards shown on the Goal screen (spec v1.6 section 8.1).
 * Habit exists as a backend Mode (workouts/plan_engine/domain.py treats it
 * identically to Focus) but is not one of the plan builder's screen cards --
 * see the implementation report for this judgment call. */
export type BuilderMode = 'CUT' | 'BULK' | 'RECOMP' | 'FOCUS';

/** Local, string-backed form state for the whole 5-step builder (mirrors
 * Input's controlled text fields). One object, shared by the plan-select
 * orchestrator and (in a condensed form) onboarding's plan sub-wizard. */
export interface PlanWizardState {
  mode: BuilderMode | null;
  sex: 'MALE' | 'FEMALE' | null;
  age: string;
  height: string;
  currentWeight: string;
  goalWeight: string;
  /** Only meaningful when mode === 'RECOMP'. */
  recompDirection: RecompDirection | null;
  durationDays: string;
  /** 4.10: "If the user has not edited it, adopt the new mode's blueprint
   * default... If edited, keep it and revalidate." Set to true the first
   * time the user changes durationDays directly (not via a mode switch). */
  durationEdited: boolean;
  daysPerWeek: number;
  /** 1=Mon..7=Sun, matching the existing WEEKDAY_OPTIONS/API convention. */
  weekdays: number[];
  experience: PlanExperience | null;
  equipment: PlanEquipmentLevel | null;
  splitSlug: string | null;
}

export const DEFAULT_SPREAD_BY_DAYS_PER_WEEK: Record<number, number[]> = {
  3: [1, 3, 5], // Mon/Wed/Fri
  4: [1, 2, 4, 6], // Mon/Tue/Thu/Sat
  5: [1, 2, 4, 5, 6], // Mon/Tue/Thu/Fri/Sat
  6: [1, 2, 3, 4, 5, 6], // Mon-Sat
};

export const DEFAULT_DURATION_DAYS_BY_MODE: Record<BuilderMode, number> = {
  CUT: 60,
  BULK: 90,
  RECOMP: 45,
  FOCUS: 30,
};

export function defaultPlanWizardState(overrides?: Partial<PlanWizardState>): PlanWizardState {
  return {
    mode: null,
    sex: null,
    age: '',
    height: '',
    currentWeight: '',
    goalWeight: '',
    recompDirection: null,
    durationDays: '60',
    durationEdited: false,
    daysPerWeek: 4,
    weekdays: DEFAULT_SPREAD_BY_DAYS_PER_WEEK[4],
    experience: null,
    equipment: null,
    splitSlug: null,
    ...overrides,
  };
}
