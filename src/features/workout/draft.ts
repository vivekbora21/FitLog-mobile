import type { RoutineExercise, WorkoutSession, WorkoutSet } from '../../types';
import { kv } from '../../lib/kv';

export type SetType = WorkoutSet['set_type'];

export interface DraftSet {
  key: string;
  type: SetType;
  weight: string;
  reps: string;
  done: boolean;
}

export interface DraftExercise {
  key: string;
  exerciseId: string;
  name: string;
  muscle?: string;
  restSeconds: number;
  sets: DraftSet[];
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

export const newSet = (weight = '', reps = '', type: SetType = 'NORMAL'): DraftSet => ({
  key: nextKey(),
  type,
  weight,
  reps,
  done: false,
});

/** "8-10" → "8", "12" → "12", "AMRAP" → "". */
function firstRepNumber(targetReps?: string): string {
  const m = targetReps?.match(/\d+/);
  return m ? m[0] : '';
}

export function exerciseFromRoutine(ex: RoutineExercise): DraftExercise {
  const weight = ex.progression?.recommended_weight_kg ?? ex.suggested_weight_kg;
  const reps = firstRepNumber(ex.target_reps);
  return {
    key: nextKey(),
    exerciseId: ex.exercise,
    name: ex.exercise_name,
    muscle: ex.primary_muscle,
    restSeconds: ex.rest_seconds || 90,
    sets: Array.from({ length: Math.max(1, ex.target_sets || 1) }, () => newSet(weight ? String(weight) : '', reps)),
  };
}

export function exercisesFromSession(session: WorkoutSession): DraftExercise[] {
  return (session.exercises ?? []).map((ex) => ({
    key: nextKey(),
    exerciseId: ex.exercise,
    name: ex.exercise_name,
    muscle: ex.primary_muscle,
    restSeconds: ex.rest_seconds ?? 90,
    sets: (ex.sets ?? []).map((s) => ({
      key: nextKey(),
      type: s.set_type ?? 'NORMAL',
      weight: s.weight_kg ? String(s.weight_kg) : '',
      reps: s.reps ? String(s.reps) : '',
      done: s.completed,
    })),
  }));
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
