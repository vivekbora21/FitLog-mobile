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
}

export function normalizeWorkoutDay(day: NormalizedWorkoutDay): NormalizedWorkoutDay {
  return {
    ...day,
    calendar_date: day.calendar_date,
    label: day.label || `Day ${day.day_number}`,
    status: day.status || 'UPCOMING',
    is_optional: Boolean(day.is_optional),
    routine_details: day.routine_details
      ? { ...day.routine_details, exercises: resolveRoutineExercises(day.routine_details.exercises) as unknown as RoutineExercise[] }
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
  return ex.swap?.exercise_name || ex.exercise_name || 'Exercise';
}

/**
 * Returns the primary muscle group, respecting per-day swaps.
 */
export function getRoutineExerciseMuscle(ex?: Partial<RoutineExercise> | null): string {
  if (!ex) return '';
  return ex.swap?.primary_muscle || ex.primary_muscle || '';
}

/**
 * Returns the active exercise ID, respecting per-day swaps.
 */
export function getRoutineExerciseId(ex?: Partial<RoutineExercise> | null): string {
  if (!ex) return '';
  return ex.swap?.exercise || ex.exercise || '';
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
