import React, { useMemo, useState } from 'react';
import { Alert, View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Dumbbell,
  CheckCircle2,
  Clock,
  Layers,
  ChevronDown,
  Moon,
  Check,
  Plus,
  ChevronRight,
  CalendarDays,
  Trophy,
  FastForward,
  RotateCcw,
  Repeat,
  SkipForward,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react-native';
import { api, extractErrorMessage, type CalendarDayInfo } from '../../src/api/client';
import {
  Button,
  Card,
  Badge,
  ErrorState,
  PressableScale,
  ScreenHeader,
  ScreenSkeleton,
  WeekCalendar,
  DayActionModal,
  SnapStatusButton,
} from '../../src/components/ui';
import { useTabBarClearance } from '../../src/components/navigation/TabBar';
import { radius, spacing, makeStyles, useTheme } from '../../src/theme';
import type { WorkoutSession } from '../../src/types';
import { ExercisePicker } from '../../src/features/workout/ExercisePicker';
import { CardioSection } from '../../src/features/workout/CardioSection';
import {
  formatDuration,
  formatRelativeDay,
  formatVolume,
  toDateKey,
  shiftDateKey,
  formatDayLabel,
  getDateProgramDayNumber,
  getProgramDayDate,
} from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { invalidateWorkoutData } from '../../src/lib/queries';
import { ResumeWorkoutBanner } from '../../src/features/workout/ResumeWorkoutBanner';
import { getRoutineExerciseDisplayName } from '../../src/lib/workout';

const COLLAPSED_EXERCISES = 4;
const enter = (i: number) => FadeInDown.delay(60 + i * 60).duration(420);

export default function WorkoutsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const bottomClearance = useTabBarClearance();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [mountedAt] = useState(() => Date.now());

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [activeDayModal, setActiveDayModal] = useState<string | null>(null);

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
    data: stats,
    refetch: refetchStats,
    isRefetching: isStatsRefetching,
  } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => api.getDashboardStats(),
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

  const isRefreshing = isTodayRefetching || isSessionsRefetching || isStatsRefetching;

  const onRefresh = async () => {
    haptics.light();
    await Promise.all([refetchToday(), refetchSessions(), refetchStats()]);
  };

  const statusMutation = useMutation({
    mutationFn: (newStatus: 'COMPLETED' | 'REST' | 'SKIPPED' | 'CLEAR') =>
      api.updateCalendarDayStatus({ date: selectedDate, status: newStatus }),
    onSuccess: () => {
      haptics.success();
      invalidateWorkoutData(queryClient, selectedDate);
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['workoutSessions'] });
      queryClient.invalidateQueries({ queryKey: ['todaysWorkout'] });
      queryClient.invalidateQueries({ queryKey: ['workoutPlan'] });
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't update status", extractErrorMessage(err));
    },
  });

  // Swapping today's recommended exercise for a different one (per program day, not the
  // shared routine template). Shared with plan.tsx's rendering of the same `swap` field.
  const [swapTarget, setSwapTarget] = useState<{ dayNumber: number; routineExerciseId: string } | null>(null);
  const swapMutation = useMutation({
    mutationFn: (payload: { day_number: number; routine_exercise_id: string; exercise_id: string }) =>
      api.swapExercise(payload),
    onSuccess: () => {
      haptics.success();
      invalidateWorkoutData(queryClient, selectedDate);
      setSwapTarget(null);
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't swap exercise", extractErrorMessage(err));
    },
  });

  const selectedDateSessions = useMemo(() => {
    return sessions.filter((s) => s.started_at && toDateKey(new Date(s.started_at)) === selectedDate);
  }, [sessions, selectedDate]);

  const selectedDayInfo = stats?.calendar_days?.[selectedDate];

  const [historyDaysCount, setHistoryDaysCount] = useState(5);

  const programStartDate = todayWorkout?.program?.start_date || stats?.journey?.start_date || null;
  const programDurationDays = todayWorkout?.program?.duration_days || stats?.journey?.program_length || 30;

  const currentProgramDay = todayWorkout?.program?.current_day || stats?.journey?.program_day || 1;
  const currentProgramDayDate = useMemo(() => {
    return getProgramDayDate(programStartDate, currentProgramDay);
  }, [programStartDate, currentProgramDay]);

  const { data: selectedDateWorkout } = useQuery({
    queryKey: ['workoutDay', selectedDate],
    queryFn: () => api.getWorkoutDay(selectedDate),
    enabled: Boolean(selectedDate),
  });

  const selectedDateProgramDay = useMemo(() => {
    // Prefer the backend's drift-corrected day number (anchored to actual completion
    // dates); only fall back to the naive calendar-offset guess when the date falls
    // outside the stats window and calendar_days has nothing for it.
    return (
      selectedDateWorkout?.today?.day_number ??
      selectedDayInfo?.program_day?.day_number ??
      getDateProgramDayNumber(programStartDate, selectedDate, programDurationDays)
    );
  }, [selectedDateWorkout, selectedDayInfo, programStartDate, selectedDate, programDurationDays]);

  const historyDailyLogs = useMemo(() => {
    const list = [];
    const today = new Date();

    for (let i = 0; i < historyDaysCount; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = toDateKey(d);

      const matchingSessions = sessions.filter(
        (s) => s.started_at && toDateKey(new Date(s.started_at)) === k
      );
      const dayInfo = stats?.calendar_days?.[k];
      // Same backend-first, naive-fallback rule as selectedDateProgramDay above.
      const programDayNum =
        dayInfo?.program_day?.day_number ?? getDateProgramDayNumber(programStartDate, k, programDurationDays);

      list.push({
        dateKey: k,
        date: d,
        sessions: matchingSessions,
        dayInfo,
        programDayNum,
      });
    }
    return list;
  }, [historyDaysCount, sessions, stats?.calendar_days, programStartDate, programDurationDays]);

  const weekSummary = useMemo(() => {
    const weekAgo = mountedAt - 7 * 86_400_000;
    const twoWeeksAgo = mountedAt - 14 * 86_400_000;
    const recent = sessions.filter((s) => s.started_at && new Date(s.started_at).getTime() >= weekAgo);
    const prior = sessions.filter(
      (s) => s.started_at && new Date(s.started_at).getTime() >= twoWeeksAgo && new Date(s.started_at).getTime() < weekAgo
    );
    const count = recent.length;
    const priorCount = prior.length;
    const volume = recent.reduce((sum, s) => sum + (s.total_volume_kg || 0), 0);
    const priorVolume = prior.reduce((sum, s) => sum + (s.total_volume_kg || 0), 0);
    const minutes = Math.round(recent.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 60);
    const priorMinutes = Math.round(prior.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 60);

    return {
      count,
      countDelta: count - priorCount,
      volume,
      volumeDelta: Math.round(volume - priorVolume),
      minutes,
      minutesDelta: minutes - priorMinutes,
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
              onPress={() => {
                if (!isDone && exercises.length > 0) {
                  router.push({ pathname: '/workout/log', params: { plan: '1' } });
                } else {
                  router.push('/workout/log');
                }
              }}
              style={styles.headerAddBtn}
              accessibilityLabel="Log a workout"
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.6} />
            </PressableScale>
          }
        />

        <ResumeWorkoutBanner />

        {/* 7-day summary */}
        <Animated.View entering={enter(0)} style={styles.summaryRow}>
          <SummaryTile
            icon={<CheckCircle2 size={16} color={colors.primaryLight} />}
            value={String(weekSummary.count)}
            label="Sessions"
            tint={colors.primarySurface}
            delta={weekSummary.countDelta}
          />
          <SummaryTile
            icon={<Layers size={16} color={colors.cyan} />}
            value={formatVolume(weekSummary.volume)}
            label="Volume"
            tint={colors.cyanGlow}
            delta={weekSummary.volumeDelta}
            deltaFormatted={
              weekSummary.volumeDelta !== 0
                ? `${weekSummary.volumeDelta > 0 ? '+' : ''}${formatVolume(weekSummary.volumeDelta)}`
                : null
            }
          />
          <SummaryTile
            icon={<Clock size={16} color={colors.amber} />}
            value={weekSummary.minutes ? `${weekSummary.minutes}m` : '0m'}
            label="Time"
            tint={colors.amberGlow}
            delta={weekSummary.minutesDelta}
            deltaUnit="m"
          />
        </Animated.View>
        <Text style={styles.summaryCaption}>Last 7 days · trend vs prior 7 days</Text>

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
                  ? `Day ${todayWorkout.program.current_day}/${todayWorkout.program.duration_days}${
                      currentProgramDayDate ? ` (${currentProgramDayDate.formattedShort})` : ''
                    }`
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

        {/* Interactive Week Calendar */}
        <Animated.View entering={enter(1)} style={styles.calendarContainer}>
          <WeekCalendar
            selectedDate={selectedDate}
            onSelectDate={(key) => setSelectedDate(key)}
            onOpenDayModal={(key) => setActiveDayModal(key)}
            calendarDays={stats?.calendar_days}
            heatmap={stats?.activity_heatmap || {}}
            workoutsThisWeek={stats?.workouts_this_week}
            weeklyTarget={stats?.weekly_workouts_target}
          />
        </Animated.View>

        {/* Selected Date or Today's Session */}
        {selectedDate === todayKey ? (
          <Animated.View entering={enter(1)}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleInline}>Today&apos;s session</Text>
              <PressableScale
                haptic="selection"
                onPress={() => setActiveDayModal(todayKey)}
                style={styles.dayOptionsBtn}
                accessibilityLabel="Manage today's schedule and status"
              >
                <SlidersHorizontal size={13} color={colors.primaryLight} />
                <Text style={styles.dayOptionsBtnText}>Day options</Text>
              </PressableScale>
            </View>
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
                  {visibleExercises.map((ex, index) => {
                    const displayName = getRoutineExerciseDisplayName(ex);
                    const isSwapped = !!ex.swap;
                    return (
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
                        <View style={styles.exerciseNameCol}>
                          <Text style={styles.exerciseNameText} numberOfLines={1}>
                            {displayName}
                          </Text>
                          {isSwapped && <Text style={styles.swappedTag}>Swapped</Text>}
                        </View>
                        <View style={styles.setsPill}>
                          <Text style={styles.setsPillText}>
                            {ex.target_sets} × {ex.target_reps}
                          </Text>
                        </View>
                        {!isDone && today?.day_number != null && (
                          <View style={styles.exerciseActionsInline}>
                            <PressableScale
                              haptic="selection"
                              onPress={() =>
                                setSwapTarget({ dayNumber: today!.day_number, routineExerciseId: ex.id })
                              }
                              style={styles.exerciseSwapBtn}
                              accessibilityLabel={`Swap ${displayName}`}
                            >
                              <Repeat size={14} color={colors.primaryLight} />
                            </PressableScale>
                            {isSwapped && (
                              <PressableScale
                                haptic="selection"
                                onPress={() =>
                                  swapMutation.mutate({
                                    day_number: today!.day_number,
                                    routine_exercise_id: ex.id,
                                    exercise_id: ex.exercise,
                                  })
                                }
                                style={styles.exerciseRevertBtn}
                                accessibilityLabel={`Revert ${displayName} to recommended exercise`}
                              >
                                <RotateCcw size={13} color={colors.textMuted} />
                              </PressableScale>
                            )}
                          </View>
                        )}
                      </Animated.View>
                    );
                  })}

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
                      <AnimatedChevron expanded={showAllExercises} color={colors.primaryLight} />
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
                <>
                  <Button
                    title="Start & log this workout"
                    icon={<Dumbbell size={18} color="#FFFFFF" />}
                    iconPosition="left"
                    onPress={() => router.push({ pathname: '/workout/log', params: { plan: '1' } })}
                    style={styles.todayAction}
                  />
                  <View style={styles.todayQuickActionsRow}>
                    <PressableScale
                      haptic="selection"
                      onPress={() => router.push('/workout/log')}
                      style={styles.todayQuickActionBtn}
                      accessibilityLabel="Log a different or custom workout"
                    >
                      <Plus size={14} color={colors.primaryLight} strokeWidth={2.4} />
                      <Text style={styles.todayQuickActionBtnText}>Different workout</Text>
                    </PressableScale>

                    <PressableScale
                      haptic="selection"
                      onPress={() => setActiveDayModal(todayKey)}
                      style={styles.todayQuickActionBtn}
                      accessibilityLabel="Skip workout or mark rest day"
                    >
                      <SkipForward size={14} color={colors.amber} strokeWidth={2.4} />
                      <Text style={styles.todayQuickActionBtnText}>Skip / Rest day</Text>
                    </PressableScale>
                  </View>
                </>
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
        ) : (
          <Animated.View entering={enter(1)}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleInline}>
                {formatSelectedDateTitle(selectedDate, selectedDateProgramDay)}
              </Text>
              {selectedDate !== todayKey && (
                <PressableScale onPress={() => setSelectedDate(todayKey)} style={styles.backTodayBtn}>
                  <Text style={styles.backTodayText}>Today</Text>
                </PressableScale>
              )}
            </View>

            {selectedDateSessions.length > 0 ? (
              <Card elevated style={styles.todayCard}>
                <View style={styles.todayHeader}>
                  <View style={styles.routineCol}>
                    <Badge label="Completed Session" tone="emerald" />
                    <Text style={styles.routineTitle}>
                      {selectedDateSessions[0].title || 'Workout Session'}
                    </Text>
                    <Text style={styles.routineMeta}>
                      {[
                        formatDuration(selectedDateSessions[0].duration_seconds),
                        selectedDateSessions[0].total_volume_kg ? formatVolume(selectedDateSessions[0].total_volume_kg) : null,
                        selectedDateSessions[0].total_calories ? `${selectedDateSessions[0].total_calories} kcal` : null,
                        selectedDateSessions[0].exercises?.length ? `${selectedDateSessions[0].exercises.length} exercises` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <View style={[styles.iconCircle, styles.iconCircleDone]}>
                    <Check size={22} color={colors.textInverse} strokeWidth={3} />
                  </View>
                </View>

                <Button
                  title="View session details"
                  variant="secondary"
                  icon={<ChevronRight size={18} color={colors.textPrimary} />}
                  onPress={() => router.push(`/workout/${selectedDateSessions[0].id}`)}
                  style={styles.todayAction}
                />

                <Button
                  title="Log another workout for this date"
                  variant="ghost"
                  icon={<Plus size={16} color={colors.primaryLight} />}
                  onPress={() => router.push({ pathname: '/workout/log', params: { date: selectedDate } })}
                  style={{ marginTop: spacing.xs }}
                />
              </Card>
            ) : (
              <Card elevated style={styles.todayCard}>
                <View style={styles.todayHeader}>
                  <View style={styles.routineCol}>
                    <Badge
                      label={
                        selectedDayInfo?.status === 'COMPLETED'
                          ? 'Completed'
                          : selectedDayInfo?.status === 'REST'
                          ? 'Rest Day'
                          : selectedDayInfo?.status === 'SKIPPED'
                          ? 'Skipped'
                          : 'No Workout Logged'
                      }
                      tone={
                        selectedDayInfo?.status === 'COMPLETED'
                          ? 'emerald'
                          : selectedDayInfo?.status === 'REST'
                          ? 'cyan'
                          : selectedDayInfo?.status === 'SKIPPED'
                          ? 'amber'
                          : 'slate'
                      }
                    />
                    <Text style={styles.routineTitle}>
                      {selectedDayInfo?.status === 'REST'
                        ? 'Rest & Recovery'
                        : selectedDayInfo?.status === 'SKIPPED'
                        ? 'Skipped Day'
                        : selectedDayInfo?.program_day?.routine_name || 'No Session Logged'}
                    </Text>
                    <Text style={styles.routineMeta}>
                      {selectedDayInfo?.notes ||
                        (selectedDayInfo?.status === 'REST'
                          ? 'Rest scheduled. Recovery is where muscle grows.'
                          : 'Mark day status or tap below to record past workout.')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.iconCircle,
                      selectedDayInfo?.status === 'REST' && { backgroundColor: colors.cyanGlow },
                      selectedDayInfo?.status === 'COMPLETED' && styles.iconCircleDone,
                    ]}
                  >
                    {selectedDayInfo?.status === 'REST' ? (
                      <Moon size={22} color={colors.cyan} />
                    ) : selectedDayInfo?.status === 'SKIPPED' ? (
                      <FastForward size={22} color={colors.warning} />
                    ) : selectedDayInfo?.status === 'COMPLETED' ? (
                      <Check size={22} color={colors.textInverse} strokeWidth={3} />
                    ) : (
                      <Dumbbell size={22} color={colors.textMuted} />
                    )}
                  </View>
                </View>

                {/* 1-tap quick status selector */}
                <View style={styles.statusRow}>
                  <SnapStatusButton
                    label="Done"
                    icon={
                      <Check
                        size={14}
                        color={selectedDayInfo?.status === 'COMPLETED' ? colors.primaryLight : colors.textSecondary}
                      />
                    }
                    active={selectedDayInfo?.status === 'COMPLETED'}
                    activeColor={colors.primaryLight}
                    activeBackground={colors.primarySurface}
                    onPress={() => statusMutation.mutate('COMPLETED')}
                    disabled={statusMutation.isPending}
                  />

                  <SnapStatusButton
                    label="Rest"
                    icon={
                      <Moon
                        size={14}
                        color={selectedDayInfo?.status === 'REST' ? colors.cyan : colors.textSecondary}
                      />
                    }
                    active={selectedDayInfo?.status === 'REST'}
                    activeColor={colors.cyan}
                    activeBackground={colors.cyanGlow}
                    onPress={() => statusMutation.mutate('REST')}
                    disabled={statusMutation.isPending}
                  />

                  <SnapStatusButton
                    label="Skip"
                    icon={
                      <FastForward
                        size={14}
                        color={selectedDayInfo?.status === 'SKIPPED' ? colors.warning : colors.textSecondary}
                      />
                    }
                    active={selectedDayInfo?.status === 'SKIPPED'}
                    activeColor={colors.warning}
                    activeBackground={colors.amberGlow}
                    onPress={() => statusMutation.mutate('SKIPPED')}
                    disabled={statusMutation.isPending}
                  />

                  {selectedDayInfo?.status && (
                    <SnapStatusButton
                      icon={<RotateCcw size={13} color={colors.textMuted} />}
                      flex={0.5}
                      onPress={() => statusMutation.mutate('CLEAR')}
                      disabled={statusMutation.isPending}
                      accessibilityLabel="Reset status"
                    />
                  )}
                </View>

                <Button
                  title={`Log workout for ${formatShortDay(selectedDate)}`}
                  icon={<Plus size={18} color="#FFFFFF" />}
                  iconPosition="left"
                  onPress={() =>
                    router.push({
                      pathname: '/workout/log',
                      params: {
                        date: selectedDate,
                        ...(selectedDayInfo?.program_day?.routine_id
                          ? {
                              routineId: selectedDayInfo.program_day.routine_id,
                              dayNumber: String(selectedDayInfo.program_day.day_number),
                            }
                          : {}),
                      },
                    })
                  }
                  style={styles.todayAction}
                />
              </Card>
            )}
          </Animated.View>
        )}

        {/* Cardio (collapsed by default so it doesn't crowd today's exercises) */}
        <Animated.View entering={enter(2)}>
          <CardioSection />
        </Animated.View>

        {/* Daily Logs & History */}
        <Animated.View entering={enter(2)}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitleInline}>Daily Activity &amp; Logs</Text>
              <Text style={styles.historySubhead}>
                Last {historyDaysCount} days · {formatDayLabel(shiftDateKey(todayKey, -(historyDaysCount - 1)))} to Today
              </Text>
            </View>
          </View>
        </Animated.View>

        {historyDailyLogs.map((item, i) => {
          const hasSession = item.sessions.length > 0;
          const status = item.dayInfo?.status;

          return (
            <Animated.View key={item.dateKey} entering={enter(3 + Math.min(i, 5))}>
              {hasSession ? (
                item.sessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    programDayNum={item.programDayNum}
                    onPress={() => router.push(`/workout/${session.id}`)}
                  />
                ))
              ) : status === 'REST' ? (
                <RestDayRow
                  date={item.date}
                  dateKey={item.dateKey}
                  dayInfo={item.dayInfo}
                  programDayNum={item.programDayNum}
                  onPress={() => setActiveDayModal(item.dateKey)}
                />
              ) : status === 'SKIPPED' ? (
                <SkippedDayRow
                  date={item.date}
                  dateKey={item.dateKey}
                  dayInfo={item.dayInfo}
                  programDayNum={item.programDayNum}
                  onPress={() => setActiveDayModal(item.dateKey)}
                  onLogWorkout={() =>
                    router.push({
                      pathname: '/workout/log',
                      params: {
                        date: item.dateKey,
                        routineId: item.dayInfo?.program_day?.routine_id || undefined,
                        dayNumber: item.dayInfo?.program_day?.day_number ? String(item.dayInfo.program_day.day_number) : undefined,
                      },
                    })
                  }
                />
              ) : (
                <OpenDayRow
                  date={item.date}
                  dateKey={item.dateKey}
                  programDayNum={item.programDayNum}
                  onPress={() => setActiveDayModal(item.dateKey)}
                  onLogWorkout={() =>
                    router.push({
                      pathname: '/workout/log',
                      params: {
                        date: item.dateKey,
                        routineId: item.dayInfo?.program_day?.routine_id || undefined,
                        dayNumber: item.dayInfo?.program_day?.day_number ? String(item.dayInfo.program_day.day_number) : undefined,
                      },
                    })
                  }
                />
              )}
            </Animated.View>
          );
        })}

        {/* Load more (10 days at a time) */}
        <Animated.View entering={enter(3)} style={styles.historyActionsRow}>
          <Button
            title="View more history (+10 days)"
            variant="secondary"
            icon={<ChevronDown size={16} color={colors.textPrimary} />}
            iconPosition="right"
            onPress={() => {
              haptics.selection();
              setHistoryDaysCount((c) => c + 10);
            }}
            style={{ flex: 1 }}
          />
          {historyDaysCount > 5 && (
            <Button
              title="Show 5 days"
              variant="ghost"
              onPress={() => {
                haptics.selection();
                setHistoryDaysCount(5);
              }}
              style={{ marginLeft: spacing.xs }}
            />
          )}
        </Animated.View>
      </ScrollView>

      {activeDayModal && (
        <DayActionModal
          dateKey={activeDayModal}
          visible={!!activeDayModal}
          onClose={() => setActiveDayModal(null)}
          dayInfo={stats?.calendar_days?.[activeDayModal]}
          onStatusUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
            queryClient.invalidateQueries({ queryKey: ['workoutSessions'] });
            queryClient.invalidateQueries({ queryKey: ['todaysWorkout'] });
          }}
        />
      )}

      <ExercisePicker
        visible={!!swapTarget}
        selectedIds={exercises.map((ex) => ex.swap?.exercise ?? ex.exercise)}
        onClose={() => setSwapTarget(null)}
        onPick={(picked) => {
          if (!swapTarget) return;
          swapMutation.mutate({
            day_number: swapTarget.dayNumber,
            routine_exercise_id: swapTarget.routineExerciseId,
            exercise_id: picked.id,
          });
        }}
      />
    </SafeAreaView>
  );
}

function AnimatedChevron({ expanded, color }: { expanded: boolean; color: string }) {
  const rotation = useSharedValue(expanded ? 180 : 0);
  React.useEffect(() => {
    rotation.set(withTiming(expanded ? 180 : 0, { duration: 250, easing: Easing.out(Easing.cubic) }));
  }, [expanded, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <ChevronDown size={16} color={color} />
    </Animated.View>
  );
}

function SummaryTile({
  icon,
  value,
  label,
  tint,
  delta,
  deltaUnit,
  deltaFormatted,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tint: string;
  delta?: number | null;
  deltaUnit?: string;
  deltaFormatted?: string | null;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  const formatted =
    deltaFormatted !== undefined
      ? deltaFormatted
      : delta != null && delta !== 0
      ? `${delta > 0 ? '+' : ''}${delta}${deltaUnit ? deltaUnit : ''}`
      : null;

  return (
    <View style={styles.summaryTile} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.summaryTopRow}>
        <View style={[styles.summaryIcon, { backgroundColor: tint }]}>{icon}</View>
        {formatted ? (
          <View style={styles.deltaBadge}>
            {delta != null && delta > 0 ? (
              <TrendingUp size={10} color={colors.success} strokeWidth={2.6} />
            ) : delta != null && delta < 0 ? (
              <TrendingDown size={10} color={colors.warning} strokeWidth={2.6} />
            ) : (
              <Minus size={10} color={colors.textMuted} strokeWidth={2} />
            )}
            <Text
              style={[
                styles.deltaText,
                delta != null && delta > 0 && { color: colors.success },
                delta != null && delta < 0 && { color: colors.warning },
              ]}
              numberOfLines={1}
            >
              {formatted}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function SessionRow({
  session,
  programDayNum,
  onPress,
}: {
  session: WorkoutSession;
  programDayNum?: number | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
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
          {programDayNum ? (
            <View style={styles.dateTileProgramBadge}>
              <Text style={styles.dateTileProgramText}>D{programDayNum}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.historyInfo}>
          <View style={styles.historyBadgeRow}>
            <Badge label="Completed" tone="emerald" />
            {programDayNum ? (
              <Text style={styles.dayInlineTag}>Day {programDayNum}</Text>
            ) : null}
          </View>
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

function RestDayRow({
  date,
  dateKey,
  dayInfo,
  programDayNum,
  onPress,
}: {
  date: Date;
  dateKey: string;
  dayInfo?: CalendarDayInfo | null;
  programDayNum?: number | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <Card style={styles.historyCard} onPress={onPress} accessibilityHint="Opens day options">
      <View style={styles.historyRow}>
        <View style={[styles.dateTile, styles.dateTileRest]}>
          <Text style={[styles.dateTileMonth, { color: colors.cyan }]}>
            {date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
          </Text>
          <Text style={styles.dateTileDay}>{date.getDate()}</Text>
          {programDayNum ? (
            <View style={[styles.dateTileProgramBadge, { backgroundColor: colors.cyanGlow }]}>
              <Text style={[styles.dateTileProgramText, { color: colors.cyan }]}>D{programDayNum}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.historyInfo}>
          <View style={styles.historyBadgeRow}>
            <Badge label="Rest Day" tone="cyan" />
            {programDayNum ? (
              <Text style={[styles.dayInlineTag, { color: colors.cyan }]}>Day {programDayNum}</Text>
            ) : null}
          </View>
          <Text style={styles.historyTitle} numberOfLines={1}>
            Rest &amp; Recovery
          </Text>
          <Text style={styles.historyMeta} numberOfLines={1}>
            {formatDayLabel(dateKey)} · {dayInfo?.notes || 'Active recovery & rest'}
          </Text>
        </View>
        <View style={[styles.statusIconBox, { backgroundColor: colors.cyanGlow }]}>
          <Moon size={18} color={colors.cyan} />
        </View>
        <ChevronRight size={16} color={colors.textMuted} />
      </View>
    </Card>
  );
}

function SkippedDayRow({
  date,
  dateKey,
  dayInfo,
  programDayNum,
  onPress,
  onLogWorkout,
}: {
  date: Date;
  dateKey: string;
  dayInfo?: CalendarDayInfo | null;
  programDayNum?: number | null;
  onPress: () => void;
  onLogWorkout: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <Card style={styles.historyCard}>
      <View style={styles.historyRow}>
        <PressableScale
          onPress={onPress}
          scaleTo={0.99}
          accessibilityHint="Opens day options"
          style={styles.historyMainPressable}
        >
          <View style={[styles.dateTile, styles.dateTileSkipped]}>
            <Text style={[styles.dateTileMonth, { color: colors.warning }]}>
              {date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
            </Text>
            <Text style={styles.dateTileDay}>{date.getDate()}</Text>
            {programDayNum ? (
              <View style={[styles.dateTileProgramBadge, { backgroundColor: colors.amberGlow }]}>
                <Text style={[styles.dateTileProgramText, { color: colors.warning }]}>D{programDayNum}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.historyInfo}>
            <View style={styles.historyBadgeRow}>
              <Badge label="Skipped" tone="amber" />
              {programDayNum ? (
                <Text style={[styles.dayInlineTag, { color: colors.warning }]}>Day {programDayNum}</Text>
              ) : null}
            </View>
            <Text style={styles.historyTitle} numberOfLines={1}>
              {dayInfo?.program_day?.routine_name ? `${dayInfo.program_day.routine_name} (Skipped)` : 'Skipped Workout'}
            </Text>
            <Text style={styles.historyMeta} numberOfLines={1}>
              {formatDayLabel(dateKey)} · {dayInfo?.notes || 'Missed workout'}
            </Text>
          </View>
        </PressableScale>
        <PressableScale
          onPress={onLogWorkout}
          style={styles.logPillBtn}
          accessibilityLabel={`Log workout for ${formatShortDay(dateKey)}`}
        >
          <Plus size={13} color="#FFFFFF" strokeWidth={2.6} />
          <Text style={styles.logPillBtnText}>Log</Text>
        </PressableScale>
      </View>
    </Card>
  );
}

function OpenDayRow({
  date,
  dateKey,
  programDayNum,
  onPress,
  onLogWorkout,
}: {
  date: Date;
  dateKey: string;
  programDayNum?: number | null;
  onPress: () => void;
  onLogWorkout: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <Card style={styles.historyCard}>
      <View style={styles.historyRow}>
        <PressableScale
          onPress={onPress}
          scaleTo={0.99}
          accessibilityHint="Opens day options"
          style={styles.historyMainPressable}
        >
          <View style={styles.dateTile}>
            <Text style={styles.dateTileMonth}>
              {date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
            </Text>
            <Text style={styles.dateTileDay}>{date.getDate()}</Text>
            {programDayNum ? (
              <View style={styles.dateTileProgramBadge}>
                <Text style={styles.dateTileProgramText}>D{programDayNum}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.historyInfo}>
            <View style={styles.historyBadgeRow}>
              <Badge label="Open Day" tone="slate" />
              {programDayNum ? (
                <Text style={styles.dayInlineTag}>Day {programDayNum}</Text>
              ) : null}
            </View>
            <Text style={styles.historyTitle} numberOfLines={1}>
              No Workout Logged
            </Text>
            <Text style={styles.historyMeta} numberOfLines={1}>
              {formatDayLabel(dateKey)} · Tap to record or mark rest
            </Text>
          </View>
        </PressableScale>
        <PressableScale
          onPress={onLogWorkout}
          style={styles.logPillBtnSecondary}
          accessibilityLabel={`Log workout for ${formatShortDay(dateKey)}`}
        >
          <Plus size={13} color={colors.primaryLight} strokeWidth={2.6} />
          <Text style={styles.logPillBtnSecondaryText}>Log</Text>
        </PressableScale>
      </View>
    </Card>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
  todayQuickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  todayQuickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayQuickActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
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
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  deltaText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
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
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitleInline: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  dayOptionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
  },
  dayOptionsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
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
  exerciseNameCol: {
    flex: 1,
  },
  exerciseNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  swappedTag: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
    marginTop: 1,
  },
  exerciseActionsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exerciseSwapBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseRevertBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
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
  historyMainPressable: {
    flex: 1,
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
  calendarContainer: {
    marginTop: spacing.md,
  },
  backTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
  },
  backTodayText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusBtnActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryLight,
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  statusBtnTextActive: {
    color: colors.primaryLight,
  },
  dateTileProgramBadge: {
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySurface,
  },
  dateTileProgramText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  dateTileRest: {
    borderWidth: 1,
    borderColor: colors.cyan,
  },
  dateTileSkipped: {
    borderWidth: 1,
    borderColor: colors.warning,
  },
  historyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  dayInlineTag: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  statusIconBox: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  logPillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logPillBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primarySurface,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  logPillBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  historySubhead: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  historyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
}));

function formatSelectedDateTitle(key: string, programDayNum?: number | null): string {
  const rel = formatRelativeDay(key);
  const parts = key.split('-');
  if (parts.length !== 3) return key;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const formatted =
    rel === 'Today' || rel === 'Yesterday'
      ? `${rel}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return programDayNum ? `Day ${programDayNum} · ${formatted}` : formatted;
}

function formatShortDay(key: string): string {
  const rel = formatRelativeDay(key);
  if (rel === 'Today' || rel === 'Yesterday') return rel;
  const parts = key.split('-');
  if (parts.length !== 3) return key;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
