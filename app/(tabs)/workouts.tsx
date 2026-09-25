import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import {
  Dumbbell,
  CheckCircle2,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Moon,
  Check,
  Plus,
  ChevronRight,
  CalendarDays,
  Trophy,
} from 'lucide-react-native';
import { api, extractErrorMessage } from '../../src/api/client';
import {
  Button,
  Card,
  Badge,
  EmptyState,
  ErrorState,
  PressableScale,
  ScreenHeader,
  ScreenSkeleton,
} from '../../src/components/ui';
import { useTabBarClearance } from '../../src/components/navigation/TabBar';
import { colors, radius, spacing } from '../../src/theme';
import type { WorkoutSession } from '../../src/types';
import { formatDuration, formatRelativeDay, formatVolume } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';

const COLLAPSED_EXERCISES = 4;
const enter = (i: number) => FadeInDown.delay(60 + i * 60).duration(420);

export default function WorkoutsScreen() {
  const bottomClearance = useTabBarClearance();
  const router = useRouter();
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [mountedAt] = useState(() => Date.now());

  const {
    data: todayWorkout,
    isLoading: isTodayLoading,
    refetch: refetchToday,
    isRefetching: isTodayRefetching,
  } = useQuery({
    queryKey: ['todaysWorkout'],
    queryFn: () => api.getTodaysWorkout(),
  });

  const {
    data: sessionPages,
    isLoading: isSessionsLoading,
    isError: isSessionsError,
    error: sessionsError,
    refetch: refetchSessions,
    isRefetching: isSessionsRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['workoutSessions'],
    queryFn: ({ pageParam }) => api.getWorkoutSessionsPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, _all, lastParam) => (last.next ? lastParam + 1 : undefined),
  });
  const sessions = useMemo<WorkoutSession[]>(
    () => sessionPages?.pages.flatMap((p) => p.results) ?? [],
    [sessionPages]
  );

  const isRefreshing = isTodayRefetching || isSessionsRefetching;

  const onRefresh = async () => {
    haptics.light();
    await Promise.all([refetchToday(), refetchSessions()]);
  };

  const weekSummary = useMemo(() => {
    const weekAgo = mountedAt - 7 * 86_400_000;
    const recent = sessions.filter((s) => s.started_at && new Date(s.started_at).getTime() >= weekAgo);
    return {
      count: recent.length,
      volume: recent.reduce((sum, s) => sum + (s.total_volume_kg || 0), 0),
      minutes: Math.round(recent.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 60),
    };
  }, [sessions, mountedAt]);

  const today = todayWorkout?.today;
  const routine = today?.routine_details;
  const exercises = routine?.exercises || [];
  const isDone = today?.status === 'COMPLETED';
  const visibleExercises = showAllExercises ? exercises : exercises.slice(0, COLLAPSED_EXERCISES);
  const hiddenCount = exercises.length - COLLAPSED_EXERCISES;

  if ((isTodayLoading || isSessionsLoading) && !todayWorkout && sessions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenSkeleton />
      </SafeAreaView>
    );
  }

  if (isSessionsError && !todayWorkout && sessions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ErrorState
          title="Couldn't load workouts"
          message={extractErrorMessage(sessionsError)}
          onRetry={onRefresh}
          retrying={isRefreshing}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryLight}
            colors={[colors.primaryLight]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <ScreenHeader
          eyebrow="Training"
          title="Workouts"
          right={
            <PressableScale
              onPress={() => router.push('/workout/log')}
              style={styles.headerAddBtn}
              accessibilityLabel="Log a workout"
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.6} />
            </PressableScale>
          }
        />

        {/* 7-day summary */}
        <Animated.View entering={enter(0)} style={styles.summaryRow}>
          <SummaryTile
            icon={<CheckCircle2 size={16} color={colors.primaryLight} />}
            value={String(weekSummary.count)}
            label="Sessions"
            tint={colors.primarySurface}
          />
          <SummaryTile
            icon={<Layers size={16} color={colors.cyan} />}
            value={formatVolume(weekSummary.volume)}
            label="Volume"
            tint={colors.cyanGlow}
          />
          <SummaryTile
            icon={<Clock size={16} color={colors.amber} />}
            value={weekSummary.minutes ? `${weekSummary.minutes}m` : '0m'}
            label="Time"
            tint={colors.amberGlow}
          />
        </Animated.View>
        <Text style={styles.summaryCaption}>Last 7 days</Text>

        {/* Plan & Progress links */}
        <Animated.View entering={enter(1)} style={styles.linksRow}>
          <PressableScale
            haptic="selection"
            scaleTo={0.98}
            onPress={() => router.push('/plan')}
            style={styles.planCardHalf}
            accessibilityLabel="Open workout plan"
          >
            <View style={[styles.summaryIcon, { backgroundColor: colors.primarySurface }]}>
              <CalendarDays size={18} color={colors.primaryLight} />
            </View>
            <View style={styles.planText}>
              <Text style={styles.planTitle} numberOfLines={1}>
                {todayWorkout?.program?.name || 'Workout plan'}
              </Text>
              <Text style={styles.planMeta} numberOfLines={1}>
                {todayWorkout?.program
                  ? `Day ${todayWorkout.program.current_day}/${todayWorkout.program.duration_days}`
                  : 'Choose plan'}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </PressableScale>

          <PressableScale
            haptic="selection"
            scaleTo={0.98}
            onPress={() => router.push('/progress')}
            style={styles.planCardHalf}
            accessibilityLabel="Open progress & PRs"
          >
            <View style={[styles.summaryIcon, { backgroundColor: colors.amberGlow }]}>
              <Trophy size={18} color={colors.warning} />
            </View>
            <View style={styles.planText}>
              <Text style={styles.planTitle} numberOfLines={1}>
                Progress
              </Text>
              <Text style={styles.planMeta} numberOfLines={1}>
                PRs &amp; Trends
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </PressableScale>
        </Animated.View>

        {/* Today */}
        <Animated.View entering={enter(1)}>
          <Text style={styles.sectionTitle}>Today&apos;s session</Text>
          <Card elevated highlighted={!isDone && exercises.length > 0} style={styles.todayCard}>
            <View style={styles.todayHeader}>
              <View style={styles.routineCol}>
                <Badge
                  label={today?.status || (exercises.length ? 'Scheduled' : 'Rest')}
                  tone={isDone ? 'emerald' : exercises.length ? 'cyan' : 'slate'}
                />
                <Text style={styles.routineTitle}>
                  {routine?.name || today?.label || 'Rest Day / Recovery'}
                </Text>
                {exercises.length > 0 && (
                  <Text style={styles.routineMeta}>
                    {exercises.length} exercises ·{' '}
                    {exercises.reduce((n, ex) => n + (ex.target_sets || 0), 0)} total sets
                  </Text>
                )}
              </View>
              <View style={[styles.iconCircle, isDone && styles.iconCircleDone]}>
                {isDone ? (
                  <Check size={22} color={colors.textInverse} strokeWidth={3} />
                ) : exercises.length ? (
                  <Dumbbell size={22} color={colors.primaryLight} />
                ) : (
                  <Moon size={22} color={colors.textSecondary} />
                )}
              </View>
            </View>

            {exercises.length > 0 ? (
              <Animated.View layout={LinearTransition.duration(250)} style={styles.exerciseList}>
                {visibleExercises.map((ex, index) => (
                  <Animated.View
                    key={ex.id || index}
                    entering={FadeInDown.duration(250)}
                    style={styles.exerciseItem}
                  >
                    <View style={[styles.exerciseIndexBadge, isDone && styles.exerciseIndexDone]}>
                      {isDone ? (
                        <Check size={12} color={colors.primaryLight} strokeWidth={3} />
                      ) : (
                        <Text style={styles.exerciseIndexText}>{index + 1}</Text>
                      )}
                    </View>
                    <Text style={styles.exerciseNameText} numberOfLines={1}>
                      {ex.exercise_name}
                    </Text>
                    <View style={styles.setsPill}>
                      <Text style={styles.setsPillText}>
                        {ex.target_sets} × {ex.target_reps}
                      </Text>
                    </View>
                  </Animated.View>
                ))}

                {hiddenCount > 0 && (
                  <PressableScale
                    haptic="selection"
                    onPress={() => setShowAllExercises((v) => !v)}
                    style={styles.showMoreBtn}
                    accessibilityLabel={
                      showAllExercises ? 'Show fewer exercises' : `Show ${hiddenCount} more exercises`
                    }
                  >
                    <Text style={styles.showMoreText}>
                      {showAllExercises ? 'Show less' : `Show ${hiddenCount} more`}
                    </Text>
                    {showAllExercises ? (
                      <ChevronUp size={16} color={colors.primaryLight} />
                    ) : (
                      <ChevronDown size={16} color={colors.primaryLight} />
                    )}
                  </PressableScale>
                )}
              </Animated.View>
            ) : (
              <Text style={styles.restDayText}>
                No lifting scheduled today. Focus on mobility, hydration and sleep — recovery is where
                the gains happen.
              </Text>
            )}

            {exercises.length > 0 && !isDone ? (
              <Button
                title="Start & log this workout"
                icon={<Dumbbell size={18} color="#FFFFFF" />}
                iconPosition="left"
                onPress={() => router.push({ pathname: '/workout/log', params: { plan: '1' } })}
                style={styles.todayAction}
              />
            ) : (
              <Button
                title={isDone ? 'Log another workout' : 'Log a workout'}
                variant="secondary"
                icon={<Plus size={18} color={colors.textPrimary} />}
                iconPosition="left"
                onPress={() => router.push('/workout/log')}
                style={styles.todayAction}
              />
            )}
          </Card>
        </Animated.View>

        {/* History */}
        <Animated.View entering={enter(2)}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleInline}>History</Text>
            {sessions.length > 0 && (
              <Text style={styles.sectionMeta}>
                {sessions.length}
                {hasNextPage ? '+' : ''} sessions
              </Text>
            )}
          </View>
        </Animated.View>

        {sessions.length > 0 ? (
          <>
            {sessions.map((session, i) => (
              <Animated.View key={session.id} entering={enter(3 + Math.min(i, 6))}>
                <SessionRow session={session} onPress={() => router.push(`/workout/${session.id}`)} />
              </Animated.View>
            ))}
            {hasNextPage && (
              <Button
                title="Load older sessions"
                variant="ghost"
                loading={isFetchingNextPage}
                onPress={() => fetchNextPage()}
                style={styles.loadMoreBtn}
              />
            )}
          </>
        ) : (
          <EmptyState
            title="No sessions logged yet"
            description="Completed workouts will show up here with volume, duration and exercise breakdown."
            icon={<CheckCircle2 size={24} color={colors.primaryLight} />}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryTile({
  icon,
  value,
  label,
  tint,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tint: string;
}) {
  return (
    <View style={styles.summaryTile} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.summaryIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function SessionRow({ session, onPress }: { session: WorkoutSession; onPress: () => void }) {
  const date = session.started_at ? new Date(session.started_at) : null;
  const duration = formatDuration(session.duration_seconds);
  const exerciseCount = session.exercises?.length || 0;
  // Sessions logged without sets have no volume; lead with duration instead of "0 kg".
  const hasVolume = (session.total_volume_kg || 0) > 0;
  const primaryStat =
    hasVolume || !duration
      ? { value: formatVolume(session.total_volume_kg), label: 'Volume' }
      : { value: duration, label: 'Duration' };

  return (
    <Card style={styles.historyCard} onPress={onPress} accessibilityHint="Opens workout details">
      <View style={styles.historyRow}>
        <View style={styles.dateTile}>
          <Text style={styles.dateTileMonth}>
            {date ? date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '—'}
          </Text>
          <Text style={styles.dateTileDay}>{date ? date.getDate() : '--'}</Text>
        </View>
        <View style={styles.historyInfo}>
          <Text style={styles.historyTitle} numberOfLines={1}>
            {session.title || 'Workout Session'}
          </Text>
          <Text style={styles.historyMeta} numberOfLines={1}>
            {[
              formatRelativeDay(session.started_at),
              hasVolume ? duration : null,
              exerciseCount ? `${exerciseCount} exercises` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <View style={styles.historyVolumeBox}>
          <Text style={styles.historyVolumeValue}>{primaryStat.value}</Text>
          <Text style={styles.historyVolumeLabel}>{primaryStat.label}</Text>
        </View>
        <ChevronRight size={16} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerAddBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linksRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  planCardHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    padding: spacing.md,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  planText: {
    flex: 1,
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  planMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  todayAction: {
    marginTop: spacing.md,
  },
  loadMoreBtn: {
    marginTop: spacing.xs,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  summaryCaption: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs + 2,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    letterSpacing: -0.3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitleInline: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  todayCard: {
    padding: spacing.lg,
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  routineCol: {
    flex: 1,
    gap: spacing.xs,
  },
  routineTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  routineMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleDone: {
    backgroundColor: colors.primaryLight,
  },
  exerciseList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  exerciseIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseIndexDone: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderGlow,
  },
  exerciseIndexText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  exerciseNameText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  setsPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm + 2,
  },
  setsPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
    marginTop: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  restDayText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  historyCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dateTile: {
    width: 48,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTileMonth: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryLight,
    letterSpacing: 0.8,
  },
  dateTileDay: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: -2,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
  },
  historyVolumeBox: {
    alignItems: 'flex-end',
  },
  historyVolumeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  historyVolumeLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
