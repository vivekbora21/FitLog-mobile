import type { QueryClient } from '@tanstack/react-query';

// Logging anything (a meal, water, a workout, a check-in) feeds the dashboard's
// aggregates too, so every write refreshes the screens that summarise it.
export function invalidateTrackingData(queryClient: QueryClient) {
  return Promise.all(
    [
      'nutritionDay',
      'nutritionHistory',
      'dashboardStats',
      'dailyLog',
      'workoutSessions',
      'workoutSession',
      'todaysWorkout',
      'workoutPlan',
      'recentFoods',
      'personalRecords',
      'recentExercises',
      'lastPerformance',
      'cardioEntries',
    ].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] })
    )
  );
}

export async function invalidateWorkoutData(queryClient: QueryClient, dateKey?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['workoutPlan'] }),
    queryClient.invalidateQueries({ queryKey: ['todaysWorkout'] }),
    queryClient.invalidateQueries({ queryKey: ['workoutDay'] }),
    queryClient.invalidateQueries({ queryKey: ['workoutSessions'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] }),
    queryClient.invalidateQueries({ queryKey: ['calendarDayStatus'] }),
  ]);
  if (dateKey) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['nutritionDay', dateKey] }),
      queryClient.invalidateQueries({ queryKey: ['dailyLog', dateKey] }),
    ]);
  }
}
