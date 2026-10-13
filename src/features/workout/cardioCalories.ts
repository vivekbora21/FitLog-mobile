/**
 * Cardio calorie estimation from the workout itself, so nobody has to type a
 * number in. Mirrors backend/workouts/calories.py — keep the two in sync.
 *
 * Picks the most specific model the logged data allows:
 *   1. Average heart rate + age + sex → Keytel et al. (2005) HR equation.
 *   2. Treadmill / walk / run with a speed → ACSM metabolic equations, which
 *      account for both speed and incline.
 *   3. Otherwise → MET × body weight × time, with MET scaled by intensity zone.
 */
import { parseNumberInput } from '../../lib/format';

export type CardioModality =
  | 'WALK_RUN'
  | 'CYCLING'
  | 'ROWING'
  | 'ELLIPTICAL'
  | 'STAIR'
  | 'JUMP_ROPE'
  | 'OTHER';

/** Fallback MET per modality at a moderate (Zone 2) effort, for exercises without a catalog MET. */
const MODALITY_MET: Record<CardioModality, number> = {
  WALK_RUN: 6.0,
  CYCLING: 6.8,
  ROWING: 7.0,
  ELLIPTICAL: 5.0,
  STAIR: 9.0,
  JUMP_ROPE: 11.8,
  OTHER: 5.0,
};

/**
 * Scales a moderate-effort MET to the selected intensity zone. Ordered most
 * intense first, so e.g. "HIIT / Max" matches before anything milder.
 */
const INTENSITY_MULTIPLIERS: [string, number][] = [
  ['hiit', 1.45],
  ['max', 1.45],
  ['zone 5', 1.45],
  ['zone 4', 1.35],
  ['zone 3', 1.2],
  ['tempo', 1.2],
  ['zone 2', 1.0],
  ['zone 1', 0.75],
  ['warm', 0.75],
];

// ACSM treats < ~8 km/h as walking; above that, the running equation applies.
const RUN_THRESHOLD_KMH = 8;

export function detectCardioModality(name?: string): CardioModality {
  const n = (name ?? '').toLowerCase();
  if (n.includes('cycl') || n.includes('bike') || n.includes('spin')) return 'CYCLING';
  if (n.includes('row')) return 'ROWING';
  if (n.includes('ellipt') || n.includes('cross trainer')) return 'ELLIPTICAL';
  if (n.includes('stair') || n.includes('step mill') || n.includes('stepmill')) return 'STAIR';
  if (n.includes('jump rope') || n.includes('skipping')) return 'JUMP_ROPE';
  if (
    n.includes('tread') ||
    n.includes('walk') ||
    n.includes('run') ||
    n.includes('jog') ||
    n.includes('incline')
  ) {
    return 'WALK_RUN';
  }
  return 'OTHER';
}

function intensityMultiplier(intensity?: string): number {
  const i = (intensity ?? '').toLowerCase();
  return INTENSITY_MULTIPLIERS.find(([key]) => i.includes(key))?.[1] ?? 1.0;
}

export function ageFromDateOfBirth(dob?: string | null, today = new Date()): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age > 0 && age < 120 ? age : null;
}

export interface CardioCalorieInput {
  name?: string;
  /** Catalog MET for the exercise, if known. */
  metValue?: number | null;
  durationMinutes?: number | null;
  speedKmh?: number | null;
  inclinePercent?: number | null;
  intensity?: string;
  heartRate?: number | null;
}

export interface CardioCalorieProfile {
  weightKg?: number | null;
  age?: number | null;
  sex?: 'MALE' | 'FEMALE' | '' | null;
}

export type CardioCalorieMethod = 'heart_rate' | 'speed_incline' | 'met';

export interface CardioCalorieEstimate {
  kcal: number;
  method: CardioCalorieMethod;
}

export function estimateCardioCalories(
  input: CardioCalorieInput,
  profile: CardioCalorieProfile
): CardioCalorieEstimate | null {
  const weight = profile.weightKg;
  const mins = input.durationMinutes;
  if (!weight || weight <= 0 || !mins || mins <= 0) return null;

  // 1. Heart rate: most personal signal, but the equation is only validated for
  // exercising heart rates, and needs age + sex.
  const hr = input.heartRate;
  if (hr && hr >= 90 && hr <= 220 && profile.age && (profile.sex === 'MALE' || profile.sex === 'FEMALE')) {
    const kjPerMin =
      profile.sex === 'MALE'
        ? -55.0969 + 0.6309 * hr + 0.1988 * weight + 0.2017 * profile.age
        : -20.4022 + 0.4472 * hr - 0.1263 * weight + 0.074 * profile.age;
    if (kjPerMin > 0) {
      return { kcal: Math.round((kjPerMin / 4.184) * mins), method: 'heart_rate' };
    }
  }

  const modality = detectCardioModality(input.name);

  // 2. Walking / running with a known speed: ACSM equations (VO2 in ml/kg/min).
  const speed = input.speedKmh;
  if (modality === 'WALK_RUN' && speed && speed > 0 && speed < 30) {
    const metersPerMin = (speed * 1000) / 60;
    const grade = Math.max(0, input.inclinePercent ?? 0) / 100;
    const vo2 =
      speed < RUN_THRESHOLD_KMH
        ? 0.1 * metersPerMin + 1.8 * metersPerMin * grade + 3.5
        : 0.2 * metersPerMin + 0.9 * metersPerMin * grade + 3.5;
    // ~5 kcal per litre of O2 consumed.
    const kcalPerMin = (vo2 * weight * 5) / 1000;
    return { kcal: Math.round(kcalPerMin * mins), method: 'speed_incline' };
  }

  // 3. MET × weight × hours, scaled by intensity zone.
  const met = (input.metValue && input.metValue > 0 ? input.metValue : MODALITY_MET[modality]) *
    intensityMultiplier(input.intensity);
  return { kcal: Math.round(met * weight * (mins / 60)), method: 'met' };
}

/** Profile fields the estimator needs, pulled from the signed-in user. */
export function cardioProfileFromUser(
  profile?: { weight_kg?: number | null; date_of_birth?: string | null; sex?: 'MALE' | 'FEMALE' | '' } | null
): CardioCalorieProfile {
  return {
    weightKg: profile?.weight_kg ?? null,
    age: ageFromDateOfBirth(profile?.date_of_birth),
    sex: profile?.sex ?? null,
  };
}

const num = (v?: string) => (v ? parseNumberInput(v) : null);

/** Estimate for one logged cardio interval, from the values entered on it. */
export function estimateDraftSetCalories(
  exercise: { name: string; metValue?: number | null },
  set: { durationMinutes?: string; speedKmh?: string; incline?: string; intensity?: string; heartRate?: string },
  profile: CardioCalorieProfile
): CardioCalorieEstimate | null {
  return estimateCardioCalories(
    {
      name: exercise.name,
      metValue: exercise.metValue,
      durationMinutes: num(set.durationMinutes),
      speedKmh: num(set.speedKmh),
      inclinePercent: num(set.incline),
      intensity: set.intensity,
      heartRate: num(set.heartRate),
    },
    profile
  );
}
