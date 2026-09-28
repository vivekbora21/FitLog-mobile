import type { RoutineExercise, WorkoutSession, WorkoutSet } from '../../types';
import { kv } from '../../lib/kv';

export type SetType = WorkoutSet['set_type'];

export interface DraftSet {
  key: string;
  type: SetType;
  weight: string;
  reps: string;
  done: boolean;
  // Cardio fields
  durationMinutes?: string;
  incline?: string;
  speedKmh?: string;
  resistance?: string;
  intensity?: string;
  heartRate?: string;
  distanceKm?: string;
  calories?: string;
}

export interface DraftExercise {
  key: string;
  exerciseId: string;
  name: string;
  muscle?: string;
  restSeconds: number;
  sets: DraftSet[];
  isCardio?: boolean;
  targetPrescription?: string;
  notes?: string;
}

/** An in-progress new workout, saved on every change so a crash or kill never loses it. */
export interface WorkoutDraft {
  version: 1;
  date: string;
  /** Epoch ms when the live session began. */
  startedAt: number;
  title: string;
  notes: string;
  /** False once the user types a duration instead of using the running clock (or backdates). */
  live: boolean;
  /** Minutes, used when `live` is false. */
  duration: string;
  /** Plan routine this session completes, if it was started from today's plan. */
  routineId: string | null;
  exercises: DraftExercise[];
  updatedAt: number;
}

const DRAFT_KEY = 'fitlog_workout_draft_v1';
// A draft older than this is almost certainly abandoned; don't nag about it.
const DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 36;

let keySeq = 0;
export const nextKey = () => `k${Date.now().toString(36)}${++keySeq}`;

export const newSet = (
  weight = '',
  reps = '',
  type: SetType = 'NORMAL',
  cardio?: {
    durationMinutes?: string;
    incline?: string;
    speedKmh?: string;
    resistance?: string;
    intensity?: string;
    heartRate?: string;
    distanceKm?: string;
    calories?: string;
  }
): DraftSet => ({
  key: nextKey(),
  type,
  weight,
  reps,
  done: false,
  durationMinutes: cardio?.durationMinutes ?? '',
  incline: cardio?.incline ?? '',
  speedKmh: cardio?.speedKmh ?? '',
  resistance: cardio?.resistance ?? '',
  intensity: cardio?.intensity ?? 'Zone 2',
  heartRate: cardio?.heartRate ?? '',
  distanceKm: cardio?.distanceKm ?? '',
  calories: cardio?.calories ?? '',
});

export const newCardioSet = (
  durationMinutes = '20',
  incline = '0',
  speedKmh = '',
  intensity = 'Zone 2',
  type: SetType = 'NORMAL'
): DraftSet => ({
  key: nextKey(),
  type,
  weight: '0',
  reps: '0',
  done: false,
  durationMinutes,
  incline,
  speedKmh,
  intensity,
});

/** Detects whether an exercise is cardio-based by muscle group or name. */
export function isCardioExercise(name?: string, muscle?: string): boolean {
  const m = (muscle ?? '').trim().toLowerCase();
  const n = (name ?? '').trim().toLowerCase();
  if (m === 'cardio' || m.includes('cardio') || m.includes('aerobic')) return true;
  return (
    n.includes('treadmill') ||
    n.includes('incline walk') ||
    n.includes('bike') ||
    n.includes('cycling') ||
    n.includes('rowing') ||
    n.includes('elliptical') ||
    n.includes('cross trainer') ||
    n.includes('stair climber') ||
    n.includes('jump rope') ||
    n.includes('running') ||
    n.includes('jogging') ||
    n.includes('dynamic mobility') ||
    n.includes('mobility walk')
  );
}

/** Extracts incline, speed, target duration, and intensity hints from an exercise prescription. */
export function parseCardioDetails(name: string, targetReps?: string, notes?: string, focus?: string) {
  let incline = '';
  let speedKmh = '';
  let durationMinutes = '20';
  let intensity = 'Zone 2';
  let heartRate = '';

  const n = (name || '').toLowerCase();
  const tr = (targetReps || '').toLowerCase();
  const nt = (notes || '').toLowerCase();
  const fc = (focus || '').toLowerCase();

  // Incline: look for "12% incline", "10%", etc.
  const incMatch = (name + ' ' + (notes || '')).match(/(\d+(?:\.\d+)?)\s*%\s*(?:incline)?/i);
  if (incMatch) {
    incline = incMatch[1];
  } else if (n.includes('incline')) {
    incline = '10';
  } else {
    incline = '0';
  }

  // Speed: look for "4.8 km/h", "5.0 km/h", "4.8kmh", "5.0kph"
  const spdMatch = (name + ' ' + (notes || '')).match(/(\d+(?:\.\d+)?)\s*(?:km\/h|kmh|kph|mph)/i);
  if (spdMatch) {
    speedKmh = spdMatch[1];
  } else if (n.includes('treadmill') || n.includes('walk')) {
    speedKmh = '4.8';
  }

  // Duration: look in targetReps (e.g. "15-25 min", "5-10 min", "20-25 min", "25-30 min")
  const durMatch = (targetReps || '').match(/(\d+)\s*(?:-\s*(\d+))?\s*(?:min|m\b)/i);
  if (durMatch) {
    if (durMatch[2]) {
      const minVal = parseInt(durMatch[1], 10);
      const maxVal = parseInt(durMatch[2], 10);
      durationMinutes = String(Math.round((minVal + maxVal) / 2));
    } else {
      durationMinutes = durMatch[1];
    }
  } else if (fc.includes('warm-up') || n.includes('warm-up') || n.includes('warmup') || n.includes('mobility')) {
    durationMinutes = '10';
  }

  // Intensity
  if (fc.includes('warm-up') || n.includes('warmup') || n.includes('mobility')) {
    intensity = 'Warm-up';
  } else if (nt.includes('zone 2') || fc.includes('fat loss') || tr.includes('zone 2')) {
    intensity = 'Zone 2';
  } else if (nt.includes('zone 3') || fc.includes('tempo')) {
    intensity = 'Zone 3';
  } else if (nt.includes('hiit') || fc.includes('interval')) {
    intensity = 'HIIT';
  }

  // Heart rate from notes e.g. "Target HR 125-135 bpm"
  const hrMatch = (notes || '').match(/(\d+)\s*(?:-\s*(\d+))?\s*bpm/i);
  if (hrMatch) {
    heartRate = hrMatch[2] ? String(Math.round((parseInt(hrMatch[1], 10) + parseInt(hrMatch[2], 10)) / 2)) : hrMatch[1];
  }

  return { incline, speedKmh, durationMinutes, intensity, heartRate };
}

/** "8-10" → "8", "12" → "12", "AMRAP" → "". */
function firstRepNumber(targetReps?: string): string {
  const m = targetReps?.match(/\d+/);
  return m ? m[0] : '';
}

export function exerciseFromRoutine(ex: RoutineExercise): DraftExercise {
  const exName = ex.swap?.exercise_name ?? ex.exercise_name;
  const exMuscle = ex.swap ? ex.swap.primary_muscle ?? undefined : ex.primary_muscle;
  const isCardio = isCardioExercise(exName, exMuscle);

  if (isCardio) {
    const details = parseCardioDetails(exName, ex.target_reps, ex.notes, ex.focus);
    const cardioSet = newSet('0', '0', 'NORMAL', {
      durationMinutes: details.durationMinutes,
      incline: details.incline,
      speedKmh: details.speedKmh,
      intensity: details.intensity,
      heartRate: details.heartRate,
    });

    const targetDesc = [
      ex.target_reps,
      details.incline && details.incline !== '0' ? `${details.incline}% Incline` : null,
      details.speedKmh ? `${details.speedKmh} km/h` : null,
      details.intensity,
    ].filter(Boolean).join(' · ');

    return {
      key: nextKey(),
      exerciseId: ex.swap?.exercise ?? ex.exercise,
      name: exName,
      muscle: exMuscle,
      restSeconds: ex.rest_seconds || 0,
      isCardio: true,
      targetPrescription: targetDesc || ex.target_reps,
      notes: ex.notes,
      sets: [cardioSet],
    };
  }

  const weight = ex.progression?.recommended_weight_kg ?? ex.suggested_weight_kg;
  const reps = firstRepNumber(ex.target_reps);
  return {
    key: nextKey(),
    exerciseId: ex.swap?.exercise ?? ex.exercise,
    name: exName,
    muscle: exMuscle,
    restSeconds: ex.rest_seconds || 90,
    isCardio: false,
    notes: ex.notes,
    sets: Array.from({ length: Math.max(1, ex.target_sets || 1) }, () => newSet(weight ? String(weight) : '', reps)),
  };
}

export function exercisesFromSession(session: WorkoutSession): DraftExercise[] {
  return (session.exercises ?? []).map((ex) => {
    const isCardio = isCardioExercise(ex.exercise_name, ex.primary_muscle);
    return {
      key: nextKey(),
      exerciseId: ex.exercise,
      name: ex.exercise_name,
      muscle: ex.primary_muscle,
      restSeconds: ex.rest_seconds ?? (isCardio ? 0 : 90),
      isCardio,
      notes: ex.notes,
      sets: (ex.sets ?? []).map((s) => ({
        key: nextKey(),
        type: s.set_type ?? 'NORMAL',
        weight: s.weight_kg ? String(s.weight_kg) : '',
        reps: s.reps ? String(s.reps) : '',
        durationMinutes: s.duration_seconds ? String(Math.round(s.duration_seconds / 60)) : '',
        incline: s.incline_percent !== null && s.incline_percent !== undefined ? String(s.incline_percent) : '',
        speedKmh: s.speed_kmh !== null && s.speed_kmh !== undefined ? String(s.speed_kmh) : '',
        resistance: s.resistance_level !== null && s.resistance_level !== undefined ? String(s.resistance_level) : '',
        intensity: s.intensity || (isCardio ? 'Zone 2' : ''),
        heartRate: s.heart_rate ? String(s.heart_rate) : '',
        distanceKm: s.distance_km ? String(s.distance_km) : '',
        calories: s.calories ? String(s.calories) : '',
        done: s.completed,
      })),
    };
  });
}

export function loadWorkoutDraft(): WorkoutDraft | null {
  const raw = kv.get(DRAFT_KEY);
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as WorkoutDraft;
    if (draft.version !== 1 || Date.now() - draft.updatedAt > DRAFT_MAX_AGE_MS) {
      kv.remove(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    kv.remove(DRAFT_KEY);
    return null;
  }
}

export function saveWorkoutDraft(draft: Omit<WorkoutDraft, 'version' | 'updatedAt'>): void {
  kv.set(DRAFT_KEY, JSON.stringify({ ...draft, version: 1, updatedAt: Date.now() }));
}

export function clearWorkoutDraft(): void {
  kv.remove(DRAFT_KEY);
}

export function draftHasContent(d: Pick<WorkoutDraft, 'exercises' | 'title' | 'notes'>): boolean {
  return d.exercises.length > 0 || d.title.trim().length > 0 || d.notes.trim().length > 0;
}
