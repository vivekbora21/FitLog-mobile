import type { RoutineExercise, WorkoutExercise } from '../shared/types';


export interface NormalizedWorkoutDay {
  id: string;
  day_number: number;
  calendar_date: string;
  label: string;
  status: string;
  is_optional: boolean;
  routine?: string | null;
  routine_details?: { id: string; name: string; description?: string; exercises?: RoutineExercise[] } | null;
  completed_session_id?: string | null;
  completed_session_title?: string | null;
  completed_exercise_count?: number;
  completed_duration_seconds?: number | null;
  completed_volume_kg?: number | null;
  workout_payload?: any;
}

export function normalizeWorkoutDay(day: NormalizedWorkoutDay): NormalizedWorkoutDay {
  let rawExercises = day.routine_details?.exercises;
  if (!rawExercises || rawExercises.length === 0) {
    const wp = day.workout_payload;
    const rawList = Array.isArray(wp) ? wp : wp?.exercises;
    if (Array.isArray(rawList)) {
      rawExercises = rawList.map((item: any, idx: number) => ({
        id: item.id || `payload-${idx}`,
        exercise: item.exercise || '',
        exercise_name: item.exercise_name || item.name || `Exercise ${idx + 1}`,
        target_sets: Number(item.sets || item.target_sets || 3),
        target_reps: String(item.reps || item.target_reps || '8-12'),
        rest_seconds: Number(item.rest_seconds || 90),
        primary_muscle: item.primary_muscle || '',
        target_rpe: item.rpe ?? 8,
        suggested_weight_kg: item.suggested_weight_kg ?? null,
        order: idx,
        notes: item.notes || item.progression_rule || '',
      }));
    }
  }
  const exercises = rawExercises;
  const normalizedExercises: RoutineExercise[] = Array.isArray(exercises)
    ? [...exercises]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((ex) => {
          const raw = ex as any;
          const target_sets = Number(ex.target_sets ?? raw.targetSets ?? 0);
          const target_reps = String(ex.target_reps ?? raw.targetReps ?? '8-12');
          const rest_seconds = Number(ex.rest_seconds ?? raw.restSeconds ?? 90);
          const exercise_name = ex.exercise_name || raw.name || raw.exercise_details?.name || 'Exercise';
          const primary_muscle = ex.primary_muscle || raw.muscle || raw.exercise_details?.primary_muscle?.name || '';
          const suggested_weight_kg = ex.suggested_weight_kg ?? raw.suggestedWeight ?? null;

          return {
            ...ex,
            id: ex.id,
            exercise: ex.exercise ?? raw.exerciseId ?? '',
            exercise_name,
            name: exercise_name,
            primary_muscle,
            muscle: primary_muscle,
            target_sets,
            targetSets: target_sets,
            target_reps,
            targetReps: target_reps,
            rest_seconds,
            restSeconds: rest_seconds,
            suggested_weight_kg,
            suggestedWeight: suggested_weight_kg,
            target_rpe: ex.target_rpe ?? 8,
            notes: ex.notes ?? '',
            focus: ex.focus || '',
            order: ex.order ?? 0,
            swap: ex.swap ?? null,
            progression: ex.progression ?? null,
          } as RoutineExercise;
        })
    : [];

  return {
    ...day,
    calendar_date: day.calendar_date,
    label: day.label || `Day ${day.day_number}`,
    status: day.status || 'UPCOMING',
    is_optional: Boolean(day.is_optional),
    completed_session_id: day.completed_session_id ?? null,
    completed_session_title: day.completed_session_title ?? null,
    completed_exercise_count: day.completed_exercise_count ?? 0,
    completed_duration_seconds: day.completed_duration_seconds ?? null,
    completed_volume_kg: day.completed_volume_kg ?? null,
    routine_details: day.routine_details
      ? {
          ...day.routine_details,
          exercises: normalizedExercises,
        }
      : null,
  };
}

export interface ResolvedExercise {
  id: string;
  exerciseId: string;
  name: string;
  muscle: string;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  notes?: string;
  suggestedWeight?: number | null;
  isSwapped: boolean;
}

/**
 * Returns the true display name for a routine exercise, respecting per-day swaps.
 * Guarantees that Dashboard, Workouts, Plan, and Logger show the exact same exercise name.
 */
export function getRoutineExerciseDisplayName(ex?: Partial<RoutineExercise> | null): string {
  if (!ex) return 'Exercise';
  return ex.swap?.exercise_name || ex.exercise_name || (ex as any).name || 'Exercise';
}

/**
 * Returns the primary muscle group, respecting per-day swaps.
 */
export function getRoutineExerciseMuscle(ex?: Partial<RoutineExercise> | null): string {
  if (!ex) return '';
  return ex.swap?.primary_muscle || ex.primary_muscle || (ex as any).muscle || '';
}

/**
 * Returns the active exercise ID, respecting per-day swaps.
 */
export function getRoutineExerciseId(ex?: Partial<RoutineExercise> | null): string {
  if (!ex) return '';
  return ex.swap?.exercise || ex.exercise || (ex as any).exercise_id || (ex as any).id || '';
}

/**
 * Resolves a RoutineExercise into a standardized shape for UI presentation.
 */
export function resolveRoutineExercise(ex: RoutineExercise): ResolvedExercise {
  const name = getRoutineExerciseDisplayName(ex);
  const muscle = getRoutineExerciseMuscle(ex);
  const exerciseId = getRoutineExerciseId(ex);
  const suggestedWeight = ex.progression?.recommended_weight_kg ?? ex.suggested_weight_kg ?? null;

  return {
    id: ex.id,
    exerciseId,
    name,
    muscle,
    targetSets: ex.target_sets || 0,
    targetReps: ex.target_reps || '',
    restSeconds: ex.rest_seconds || 90,
    notes: ex.notes || '',
    suggestedWeight,
    isSwapped: Boolean(ex.swap),
  };
}

/**
 * Resolves a list of routine exercises in display order.
 */
export function resolveRoutineExercises(exercises?: RoutineExercise[] | null): ResolvedExercise[] {
  if (!exercises || !Array.isArray(exercises)) return [];
  return [...exercises].sort((a, b) => (a.order || 0) - (b.order || 0)).map(resolveRoutineExercise);
}

/**
 * Summarizes the workout display for any day or routine, ensuring
 * that completed sessions and planned routines have matched counts and names across all screens.
 */
export function getWorkoutExerciseSummary(params: {
  routineDetails?: { name?: string; exercises?: RoutineExercise[] } | null;
  completedSession?: { title?: string; exercises?: WorkoutExercise[] } | null;
  dayLabel?: string;
  isCompleted?: boolean;
}) {
  const { routineDetails, completedSession, dayLabel, isCompleted } = params;

  if (isCompleted && completedSession) {
    const exercises = completedSession.exercises || [];
    const exerciseNames = exercises.map((e) => e.exercise_name).filter(Boolean);
    const title = completedSession.title || routineDetails?.name || dayLabel || 'Workout';
    return {
      title,
      isCompleted: true,
      exerciseCount: exercises.length,
      exerciseNames,
      totalSets: exercises.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0),
    };
  }

  const resolved = resolveRoutineExercises(routineDetails?.exercises);
  const title = routineDetails?.name || dayLabel || 'Rest Day / Recovery';
  return {
    title,
    isCompleted: Boolean(isCompleted),
    exerciseCount: resolved.length,
    exerciseNames: resolved.map((e) => e.name),
    totalSets: resolved.reduce((acc, ex) => acc + ex.targetSets, 0),
  };
}
