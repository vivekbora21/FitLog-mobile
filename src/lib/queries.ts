import type { QueryClient } from '@tanstack/react-query';

// Logging anything (a meal, water, a workout, a check-in) feeds the dashboard's
// aggregates too, so every write refreshes the screens that summarise it.
export function invalidateTrackingData(queryClient: QueryClient) {
  return Promise.all(
    ['nutritionDay', 'dashboardStats', 'dailyLog', 'workoutSessions', 'todaysWorkout', 'recentFoods'].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] })
    )
  );
}
