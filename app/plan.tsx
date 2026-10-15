import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Dumbbell,
  Flag,
  SlidersHorizontal,
  Check,
  Moon,
  FastForward,
  RotateCcw,
  Repeat,
  Play,
  Clock,
  Layers,
  Plus,
} from 'lucide-react-native';
import { api, extractErrorMessage, type ProgramDay } from '../src/api/client';
import { ExercisePicker } from '../src/features/workout/ExercisePicker';
import {
  Badge,
  Button,
  Card,
  DayActionModal,
  EmptyState,
  ErrorState,
  PressableScale,
  ProgressBar,
  ScreenSkeleton,
  SnapStatusButton,
  WeekCalendar,
} from '../src/components/ui';
import { radius, spacing, makeStyles, useTheme } from '../src/theme';
import { formatDateKey, formatDuration, formatVolume, toDateKey } from '../src/lib/format';
import { haptics } from '../src/lib/haptics';
import { invalidateWorkoutData } from '../src/lib/queries';
import type { RoutineExercise } from '../src/types';
import { getRoutineExerciseDisplayName } from '../src/lib/workout';
import { useCalendar } from '../src/providers/calendar';

const enter = (i: number) => FadeInDown.delay(60 + i * 60).duration(420);
const DAY_CHIP_WIDTH = 64;
const DAY_CHIP_HEIGHT = 68;
const DAY_GAP = spacing.xs + 2;

type ScheduleFilter = 'ALL' | 'COMPLETED' | 'UPCOMING' | 'REST';

function cleanWorkoutTitle(value?: string | null) {
  return value?.replace(/^Day\s+\d+(?:\s*\(Optional\))?\s*:\s*/i, '').trim() || '';
}

function templateDayLabel(value?: string | null) {
  const match = value?.match(/^Day\s+(\d+)/i);
  return match ? `Weekly rotation · Day ${match[1]}` : null;
}

// Server progression recommendation first, then routine default weight.
function plannedLoad(ex: RoutineExercise) {
  const raw = ex as any;
  return ex.progression?.recommended_weight_kg ?? ex.suggested_weight_kg ?? raw.suggestedWeight ?? null;
}

function dayTone(day: ProgramDay, currentDay: number) {
  if (day.status === 'COMPLETED') return { label: 'Completed', tone: 'emerald' as const };
  if (day.status === 'REST') return { label: 'Rest Day', tone: 'cyan' as const };
  if (day.status === 'MISSED') return { label: 'Skipped', tone: 'amber' as const };
  if (day.day_number === currentDay) return { label: 'Today', tone: 'cyan' as const };
  return { label: 'Upcoming', tone: 'slate' as const };
}

export default function PlanScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedDate: calendarDate, setSelectedDate: setCalendarDate } = useCalendar();
  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['workoutPlan'],
    queryFn: () => api.getWorkoutPlan(),
  });

  const { data: stats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => api.getDashboardStats(),
  });

  const program = data?.program ?? null;
  const days = data?.days ?? [];
  const currentDay = program?.current_day ?? 1;
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('ALL');
  const [showMissedExercises, setShowMissedExercises] = useState(false);
  const [activeDayModal, setActiveDayModal] = useState<string | null>(null);

  // The calendar can represent a completed session on its actual date, while
  // ProgramDay.calendar_date is the original scheduled date. Prefer the calendar
  // mapping for the day shown so opening the plan on a completed date does not
  // fall back to an older/missed prescription.
  const calendarMappedDay = stats?.calendar_days?.[calendarDate]?.program_day?.day_number;
  const shownDay = selectedDay ?? calendarMappedDay ?? currentDay;
  const day = days.find((d) => d.day_number === shownDay);
  const routine = day?.routine_details;
  const exercises = routine?.exercises ?? [];
  const payloadExercises = exercises.length === 0 ? (day?.workout_payload ?? []) : [];
  const completed = days.filter((d) => d.status === 'COMPLETED').length;
  const planState = data?.plan_state;
  const duration = planState?.effective_duration_days ?? program?.duration_days ?? days.length;
  const completedWorkouts = planState?.completed_workout_count ?? completed;
  const completionPercent = planState?.calendar_progress_percent ?? (completed / Math.max(duration, 1)) * 100;
  const remaining = planState?.remaining_calendar_days ?? Math.max(duration - completed, 0);
  const workoutTitle = cleanWorkoutTitle(routine?.name) || cleanWorkoutTitle(day?.label) || 'Plan day unavailable';
  const workoutTemplateLabel = templateDayLabel(day?.label || routine?.name);

  // Retained for the legacy plan-day strip below; the WeekCalendar is the only
  // visible calendar and is the source of truth for day navigation.
  const filteredDays = useMemo(() => {
    if (scheduleFilter === 'COMPLETED') return days.filter((d) => d.status === 'COMPLETED');
    if (scheduleFilter === 'UPCOMING') return days.filter((d) => d.status === 'UPCOMING' || d.day_number >= currentDay);
    if (scheduleFilter === 'REST') return days.filter((d) => d.status === 'REST' || d.is_optional);
    return days;
  }, [days, scheduleFilter, currentDay]);
  const upcomingCount = useMemo(() => days.filter((d) => d.status === 'UPCOMING').length, [days]);
  const restCount = useMemo(() => days.filter((d) => d.status === 'REST' || d.is_optional).length, [days]);

  // Sync with matching calendar day from dashboard stats
  // Sync with matching calendar day from dashboard stats
  const matchingCalendarDay = useMemo(() => {
    if (!stats?.calendar_days) return null;
    // 1. If currently viewing a calendar date and it has info for this day:
    if (calendarDate && stats.calendar_days[calendarDate]) {
      const cd = stats.calendar_days[calendarDate];
      if (cd.program_day?.day_number === shownDay || cd.has_workout || cd.status === 'COMPLETED') {
        return cd;
      }
    }
    // 2. Find any calendar day where this program day was actually completed / has workout:
    const completedEntry = Object.values(stats.calendar_days).find(
      (cd) =>
        cd.program_day?.day_number === shownDay &&
        (cd.has_workout || cd.status === 'COMPLETED' || (cd as any).session_id)
    );
    if (completedEntry) return completedEntry;

    // 3. Find any calendar day mapping to this program day:
    const mappedEntry = Object.values(stats.calendar_days).find(
      (cd) => cd.program_day?.day_number === shownDay
    );
    if (mappedEntry) return mappedEntry;

    // 4. Fallback to calendar date or day's scheduled date:
    if (calendarDate && stats.calendar_days[calendarDate]) {
      return stats.calendar_days[calendarDate];
    }
    if (day?.calendar_date && stats.calendar_days[day.calendar_date]) {
      return stats.calendar_days[day.calendar_date];
    }
    return null;
  }, [stats?.calendar_days, calendarDate, day?.calendar_date, shownDay]);

  const completedSessionId = day?.completed_session_id || (matchingCalendarDay as any)?.session_id || null;
  const completedDurationSeconds =
    day?.completed_duration_seconds ||
    (matchingCalendarDay?.duration_min ? matchingCalendarDay.duration_min * 60 : null);
  const completedVolumeKg = day?.completed_volume_kg || matchingCalendarDay?.volume_kg || null;
  const completedExerciseCount =
    day?.completed_exercise_count ||
    matchingCalendarDay?.exercises_count ||
    (routine?.exercises?.length || 0);
  const completedSessionTitle =
    day?.completed_session_title ||
    matchingCalendarDay?.workout_title ||
    (matchingCalendarDay as any)?.session_title ||
    routine?.name ||
    day?.label ||
    'Workout Session';
  const completedExercises = (day?.completed_session?.exercises || (matchingCalendarDay as any)?.session?.exercises || []) as any[];

  // True if day was missed or skipped on calendar and no actual workout was logged
  const hasLoggedSession = Boolean(
    completedSessionId || matchingCalendarDay?.has_workout || (matchingCalendarDay as any)?.session_id
  );
  const calendarMarkedCompleted = matchingCalendarDay?.status === 'COMPLETED';
  const displayedDayStatus =
    hasLoggedSession || calendarMarkedCompleted || day?.status === 'COMPLETED'
      ? 'COMPLETED'
      : day?.status;
  const isMissedOrSkipped =
    displayedDayStatus !== 'COMPLETED' &&
    day?.status !== 'COMPLETED' &&
    (day?.status === 'MISSED' || matchingCalendarDay?.status === 'SKIPPED') &&
    !hasLoggedSession &&
    !calendarMarkedCompleted;

  const statusMutation = useMutation({
    mutationFn: (newStatus: 'COMPLETED' | 'MISSED' | 'UPCOMING' | 'REST') =>
      api.updateProgramDay({ day_number: shownDay, status: newStatus }),
    onSuccess: async () => {
      haptics.success();
      await invalidateWorkoutData(queryClient);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['todaysWorkout'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['workoutSessions'] });
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't update plan day", extractErrorMessage(err));
    },
  });

  const [swapTarget, setSwapTarget] = useState<{ dayNumber: number; routineExerciseId: string } | null>(null);
  const swapMutation = useMutation({
    mutationFn: (payload: { day_number: number; routine_exercise_id: string; exercise_id: string }) =>
      api.swapExercise(payload),
    onSuccess: async () => {
      haptics.success();
      await invalidateWorkoutData(queryClient);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['todaysWorkout'] });
      setSwapTarget(null);
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't swap exercise", extractErrorMessage(err));
    },
  });

  const planDayDate = calendarDate || day?.calendar_date || null;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // The plan can also be opened directly (for example from a deep link or
    // browser refresh), where there is no navigation history to pop.
    router.replace('/(tabs)/workouts');
  };

  const selectedDayDate = calendarDate
    ? {
        formattedShort: formatDateKey(calendarDate, { day: 'numeric', month: 'short' }),
        formattedFull: formatDateKey(calendarDate, { weekday: 'short', day: 'numeric', month: 'short' }),
      }
    : null;

  const currentDayEntry = days.find((item) => item.day_number === currentDay);
  const currentDayDate = currentDayEntry?.calendar_date
    ? { formattedShort: formatDateKey(currentDayEntry.calendar_date, { day: 'numeric', month: 'short' }) }
    : null;

  const stripRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (!program || filteredDays.length === 0) return;
    const activeIndex = filteredDays.findIndex((d) => d.day_number === shownDay);
    if (activeIndex >= 0) {
      const x = Math.max(0, (activeIndex - 2) * (DAY_CHIP_WIDTH + DAY_GAP));
      stripRef.current?.scrollTo({ x, animated: selectedDay !== null });
    }
  }, [shownDay, program, selectedDay, filteredDays]);

  const selectDay = (n: number) => {
    haptics.selection();
    setSelectedDay(Math.min(Math.max(1, n), Math.max(duration, 1)));
    setShowMissedExercises(false);
  };

  const selectCalendarDate = (dateKey: string) => {
    haptics.selection();
    setCalendarDate(dateKey);
    // Analytics carries the drift-corrected program-day mapping for completed
    // sessions; fall back to the plan's scheduled date for future days.
    const mappedDayNumber =
      stats?.calendar_days?.[dateKey]?.program_day?.day_number ??
      days.find((item) => item.calendar_date === dateKey)?.day_number;
    if (mappedDayNumber) {
      selectDay(mappedDayNumber);
    }
  };

  const handleRefresh = async () => {
    haptics.light();
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] }),
      queryClient.invalidateQueries({ queryKey: ['todaysWorkout'] }),
    ]);
  };

  const header = (
    <View style={styles.topBar}>
      <PressableScale haptic="selection" onPress={goBack} style={styles.iconBtn} accessibilityLabel="Back">
        <ChevronLeft size={22} color={colors.textPrimary} />
      </PressableScale>
      <Text style={styles.topTitle}>Workout plan</Text>
      <PressableScale
        haptic="selection"
        onPress={() => router.push('/plan-select')}
        style={[styles.iconBtn, styles.iconBtnTinted]}
        accessibilityLabel="Change plan"
      >
        <SlidersHorizontal size={18} color={colors.primaryLight} />
      </PressableScale>
    </View>
  );

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {header}
        <ScreenSkeleton />
      </SafeAreaView>
    );
  }

  if (isError && !data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {header}
        <ErrorState
          title="Couldn't load your plan"
          message={extractErrorMessage(error)}
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primaryLight}
            colors={[colors.primaryLight]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {!program ? (
          <EmptyState
            icon={<CalendarDays size={26} color={colors.primaryLight} />}
            title="No active plan"
            description="Pick a goal — Cut, Bulk, Focus, Recomp or Habit — and FitLog schedules your training days."
            action={
              <Button
                title="Choose a plan"
                icon={<SlidersHorizontal size={16} color="#FFFFFF" />}
                iconPosition="left"
                onPress={() => router.push('/plan-select')}
              />
            }
          />
        ) : (
          <>
            {/* Overview Card */}
            <Animated.View entering={enter(0)}>
              <Text style={styles.eyebrow}>
                {(program.mode_label || 'Workout plan') + ` · ${duration} days`}
              </Text>
              <Text style={styles.title}>{program.name}</Text>

              <Card elevated style={styles.overviewCard}>
                <View style={styles.overviewRow}>
                  <Text style={styles.overviewStrong}>Day {currentDay} of {duration}</Text>
                  <Text style={styles.overviewMuted}>
                    {currentDayDate ? `${currentDayDate.formattedShort} · ` : ''}
                    {completedWorkouts} completed
                  </Text>
                </View>

                <ProgressBar percentage={completionPercent} height={8} />

                <View style={styles.progressMeta}>
                  <View>
                    <Text style={styles.progressMetaLabel}>Journey progress</Text>
                    <Text style={styles.progressMetaValue}>{Math.round(completionPercent)}%</Text>
                  </View>
                  <View style={styles.progressMetaCenter}>
                    <Text style={styles.progressMetaLabel}>Completed</Text>
                    <Text style={styles.progressMetaValue}>{completedWorkouts} workouts</Text>
                  </View>
                  <View style={styles.progressMetaRight}>
                    <Text style={styles.progressMetaLabel}>Remaining</Text>
                    <Text style={styles.progressMetaValue}>{remaining} days</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <CalendarDays size={14} color={colors.textMuted} />
                    <Text style={styles.metaText}>Started {program.start_date}</Text>
                  </View>
                  {program.start_weight_kg && program.target_weight_kg ? (
                    <View style={styles.metaItem}>
                      <Flag size={14} color={colors.textMuted} />
                      <Text style={styles.metaText}>
                        {program.start_weight_kg} → {program.target_weight_kg} kg
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.planStateRow}>
                  <Text style={styles.metaText}>
                    Ends {planState?.effective_end_date || program.effective_end_date || '—'}
                  </Text>
                  <Text style={styles.metaText}>
                    {planState?.missed_workout_count ?? 0} missed
                  </Text>
                </View>
                {planState?.near_completion ? (
                  <Text style={styles.nearCompletionText}>3 days left — finish your scheduled workouts.</Text>
                ) : null}
              </Card>
            </Animated.View>

            {/* Calendar view: keeps real completion dates aligned with program days. */}
            <Animated.View entering={enter(1)} style={styles.calendarSection}>
              <WeekCalendar
                selectedDate={calendarDate}
                onSelectDate={selectCalendarDate}
                calendarDays={stats?.calendar_days}
                heatmap={stats?.activity_heatmap || {}}
                workoutsThisWeek={stats?.workouts_this_week}
                weeklyTarget={stats?.weekly_workouts_target}
                showMonth
              />
            </Animated.View>

            {false && (
              /* Legacy plan-day strip replaced by the single WeekCalendar above. */
            <Animated.View entering={enter(1)} style={styles.filterSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionHeading}>Plan Schedule &amp; Days</Text>
                <Text style={styles.sectionSubtitle}>
                  {filteredDays.length} {scheduleFilter.toLowerCase()} days shown
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterTabsStrip}
              >
                <PressableScale
                  haptic="selection"
                  onPress={() => setScheduleFilter('ALL')}
                  style={[styles.filterChip, scheduleFilter === 'ALL' && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, scheduleFilter === 'ALL' && styles.filterChipTextActive]}>
                    All ({days.length})
                  </Text>
                </PressableScale>

                <PressableScale
                  haptic="selection"
                  onPress={() => setScheduleFilter('COMPLETED')}
                  style={[styles.filterChip, scheduleFilter === 'COMPLETED' && styles.filterChipActiveCompleted]}
                >
                  <Check
                    size={12}
                    color={scheduleFilter === 'COMPLETED' ? '#10B981' : colors.textMuted}
                    strokeWidth={2.8}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      scheduleFilter === 'COMPLETED' && styles.filterChipTextCompleted,
                    ]}
                  >
                    Completed ({completed})
                  </Text>
                </PressableScale>

                <PressableScale
                  haptic="selection"
                  onPress={() => setScheduleFilter('UPCOMING')}
                  style={[styles.filterChip, scheduleFilter === 'UPCOMING' && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, scheduleFilter === 'UPCOMING' && styles.filterChipTextActive]}>
                    Upcoming ({upcomingCount})
                  </Text>
                </PressableScale>

                <PressableScale
                  haptic="selection"
                  onPress={() => setScheduleFilter('REST')}
                  style={[styles.filterChip, scheduleFilter === 'REST' && styles.filterChipActiveRest]}
                >
                  <Moon
                    size={12}
                    color={scheduleFilter === 'REST' ? colors.cyan : colors.textMuted}
                    strokeWidth={2.4}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      scheduleFilter === 'REST' && styles.filterChipTextRest,
                    ]}
                  >
                    Rest ({restCount})
                  </Text>
                </PressableScale>
              </ScrollView>

              {/* Day strip */}
              <ScrollView
                ref={stripRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.strip}
              >
                {filteredDays.map((d) => {
                  const selected = d.day_number === shownDay;
                  const done = d.status === 'COMPLETED';
                  const isRest = d.status === 'REST';
                  const isMissed = d.status === 'MISSED';
                  const isToday = d.day_number === currentDay;
                  const dayDate = d.calendar_date
                    ? {
                        formattedShort: formatDateKey(d.calendar_date, { day: 'numeric', month: 'short' }),
                      }
                    : null;

                  return (
                    <PressableScale
                      key={d.id}
                      onPress={() => selectDay(d.day_number)}
                      style={[
                        styles.dayChip,
                        done && styles.dayChipDone,
                        isRest && styles.dayChipRest,
                        isMissed && styles.dayChipMissed,
                        isToday && styles.dayChipToday,
                        d.is_optional && !done && !isRest && styles.dayChipOptional,
                        selected && styles.dayChipSelected,
                      ]}
                      accessibilityLabel={`Day ${d.day_number}: ${d.label}`}
                      accessibilityState={{ selected }}
                    >
                      <View style={styles.dayChipTopRow}>
                        {done ? (
                          <View style={styles.miniCheckIcon}>
                            <Check size={9} color="#10B981" strokeWidth={3} />
                          </View>
                        ) : isToday ? (
                          <View style={styles.miniTodayDot} />
                        ) : isRest ? (
                          <Moon size={10} color={colors.cyan} strokeWidth={2.2} />
                        ) : isMissed ? (
                          <FastForward size={10} color={colors.warning} strokeWidth={2.2} />
                        ) : (
                          <View style={styles.miniDotPlaceholder} />
                        )}
                      </View>

                      <Text
                        style={[
                          styles.dayChipNumber,
                          (done || isRest || isMissed || selected) && styles.dayChipTextStrong,
                          selected && styles.dayChipTextSelected,
                        ]}
                      >
                        D{d.day_number}
                      </Text>

                      {dayDate ? (
                        <Text
                          style={[
                            styles.dayChipDate,
                            (done || isRest || isMissed || selected) && styles.dayChipDateStrong,
                            selected && styles.dayChipDateSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {dayDate.formattedShort}
                        </Text>
                      ) : null}
                    </PressableScale>
                  );
                })}
              </ScrollView>

              <View style={styles.navRow}>
                <Button
                  title="Prev"
                  size="sm"
                  variant="secondary"
                  icon={<ChevronLeft size={16} color={colors.textPrimary} />}
                  iconPosition="left"
                  disabled={shownDay <= 1}
                  onPress={() => selectDay(shownDay - 1)}
                  style={styles.navBtn}
                />
                <Button
                  title={`Today (D${currentDay})`}
                  size="sm"
                  variant={shownDay === currentDay ? 'primary' : 'secondary'}
                  icon={
                    <Play
                      size={13}
                      color={shownDay === currentDay ? '#052b20' : colors.cyan}
                      fill={shownDay === currentDay ? '#052b20' : colors.cyan}
                    />
                  }
                  iconPosition="left"
                  onPress={() => selectDay(currentDay)}
                  style={styles.navBtn}
                />
                <Button
                  title="Next"
                  size="sm"
                  variant="secondary"
                  icon={<ChevronRight size={16} color={colors.textPrimary} />}
                  disabled={shownDay >= duration}
                  onPress={() => selectDay(shownDay + 1)}
                  style={styles.navBtn}
                />
              </View>
            </Animated.View>
            )}

            {/* Selected Day Details Card */}
            <Animated.View entering={enter(2)}>
              <Card elevated highlighted={shownDay === currentDay} style={styles.dayCard}>
                {isMissedOrSkipped ? (
                  /* Missed / Skipped Day feature — matches Home Page calendar card */
                  <View style={styles.missedCalendarCard}>
                    <View style={styles.missedCardHeader}>
                      <View style={styles.missedCol}>
                        <View style={styles.badgeRow}>
                          <Badge label="Skipped Day" tone="amber" />
                          <Text style={styles.dayNumber}>
                            Day {shownDay}
                            {selectedDayDate ? ` · ${selectedDayDate.formattedFull}` : ''}
                          </Text>
                        </View>

                        <Text style={styles.missedTitle}>
                          {workoutTitle || 'Skipped Training'}
                        </Text>

                        <Text style={styles.missedMeta}>
                          {matchingCalendarDay?.notes ||
                            routine?.description ||
                            'Scheduled workout was skipped. No training session was recorded for this day. You can catch up and log this workout, mark as rest, or update status.'}
                        </Text>
                      </View>

                      <View style={styles.missedIconCircle}>
                        <FastForward size={22} color={colors.warning} />
                      </View>
                    </View>

                    {/* 1-tap quick status selector (identical to Home Page calendar card) */}
                    <View style={styles.statusRow}>
                      <SnapStatusButton
                        label="Done"
                        icon={
                          <Check
                            size={14}
                            color={colors.textSecondary}
                          />
                        }
                        active={false}
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
                            color={displayedDayStatus === 'REST' ? colors.cyan : colors.textSecondary}
                          />
                        }
                        active={displayedDayStatus === 'REST'}
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
                            color={displayedDayStatus === 'MISSED' ? colors.warning : colors.textSecondary}
                          />
                        }
                        active={displayedDayStatus === 'MISSED'}
                        activeColor={colors.warning}
                        activeBackground={colors.amberGlow}
                        onPress={() => statusMutation.mutate('MISSED')}
                        disabled={statusMutation.isPending}
                      />
                      <SnapStatusButton
                        icon={<RotateCcw size={13} color={colors.textMuted} />}
                        flex={0.5}
                        onPress={() => statusMutation.mutate('UPCOMING')}
                        disabled={statusMutation.isPending}
                        accessibilityLabel="Reset status to upcoming"
                      />
                    </View>

                    {/* Primary Action Button: Log workout for this day */}
                    <Button
                      title={`Log workout for ${selectedDayDate ? selectedDayDate.formattedShort : `Day ${shownDay}`}`}
                      icon={<Plus size={18} color="#FFFFFF" />}
                      iconPosition="left"
                      onPress={() =>
                        router.push({
                          pathname: '/workout/log',
                          params: {
                            plan: '1',
                            routineId: routine?.id,
                            dayNumber: String(shownDay),
                            date: planDayDate || undefined,
                          },
                        })
                      }
                      style={styles.dayAction}
                    />

                    {/* Day Options button (opens Home Page Calendar DayActionModal) */}
                    <PressableScale
                      haptic="selection"
                      onPress={() => setActiveDayModal(planDayDate || todayKey)}
                      style={styles.dayOptionsBtn}
                      accessibilityLabel="Open calendar day options"
                    >
                      <SlidersHorizontal size={14} color={colors.primaryLight} />
                      <Text style={styles.dayOptionsBtnText}>More day options</Text>
                    </PressableScale>

                    {/* Collapsible Scheduled Routine preview */}
                    {(exercises.length > 0 || payloadExercises.length > 0) && (
                      <View style={styles.missedExercisesSection}>
                        <PressableScale
                          haptic="selection"
                          onPress={() => setShowMissedExercises((v) => !v)}
                          style={styles.missedExercisesToggle}
                          accessibilityLabel={
                            showMissedExercises
                              ? 'Hide scheduled exercises'
                              : 'View scheduled exercises'
                          }
                        >
                          <View style={styles.missedToggleLeft}>
                            <Dumbbell size={15} color={colors.textSecondary} />
                            <Text style={styles.missedToggleText}>
                              Scheduled Routine ({exercises.length || payloadExercises.length} movements)
                            </Text>
                          </View>
                          <ChevronDown
                            size={16}
                            color={colors.textSecondary}
                            style={{
                              transform: [{ rotate: showMissedExercises ? '180deg' : '0deg' }],
                            }}
                          />
                        </PressableScale>

                        {showMissedExercises && (
                          <View style={styles.missedExercisesList}>
                            {exercises.map((ex, i) => {
                              const raw = ex as any;
                              const load = plannedLoad(ex);
                              const displayName = getRoutineExerciseDisplayName(ex);
                              const muscleFocus =
                                ex.swap?.primary_muscle || ex.focus || ex.primary_muscle || raw.muscle;
                              const targetSets = ex.target_sets ?? raw.targetSets ?? '--';
                              const targetReps = ex.target_reps ?? raw.targetReps ?? '--';
                              const restSeconds = ex.rest_seconds ?? raw.restSeconds ?? 90;

                              return (
                                <View key={ex.id || i} style={styles.exerciseCard}>
                                  <View style={styles.exerciseCardHeader}>
                                    <View style={styles.exerciseHeaderLeft}>
                                      <View style={styles.exerciseIndexBadge}>
                                        <Text style={styles.exerciseIndexBadgeText}>{i + 1}</Text>
                                      </View>
                                      <View style={styles.exerciseTitleCol}>
                                        <Text style={styles.exerciseName} numberOfLines={2}>
                                          {displayName}
                                        </Text>
                                        {muscleFocus ? (
                                          <Text style={styles.exerciseMuscle}>{muscleFocus}</Text>
                                        ) : null}
                                      </View>
                                    </View>
                                  </View>

                                  <View style={styles.statGrid}>
                                    <View style={styles.statBox}>
                                      <Text style={styles.statBoxLabel}>SETS</Text>
                                      <Text style={styles.statBoxValue}>{targetSets}</Text>
                                    </View>
                                    <View style={styles.statBox}>
                                      <Text style={styles.statBoxLabel}>REPS</Text>
                                      <Text style={styles.statBoxValue}>{targetReps}</Text>
                                    </View>
                                    <View style={styles.statBox}>
                                      <Text style={styles.statBoxLabel}>REST</Text>
                                      <Text style={styles.statBoxValue}>{restSeconds}s</Text>
                                    </View>
                                    <View style={styles.statBox}>
                                      <Text style={styles.statBoxLabel}>LOAD</Text>
                                      <Text style={styles.statBoxValue}>
                                        {load ? `${load} kg` : '--'}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ) : (
                  /* Standard / Completed / Active Day layout */
                  <>
                    <View style={styles.dayHeaderRow}>
                      {day ? (
                        <Badge
                          label={displayedDayStatus === 'COMPLETED' ? 'Completed' : dayTone(day, currentDay).label + (day.is_optional ? ' · Optional' : '')}
                          tone={displayedDayStatus === 'COMPLETED' ? 'emerald' : dayTone(day, currentDay).tone}
                        />
                      ) : null}
                      <Text style={styles.dayNumber}>
                        Day {shownDay}
                        {selectedDayDate ? ` · ${selectedDayDate.formattedFull}` : ''}
                      </Text>
                    </View>

                    <Text style={styles.dayTitle}>{workoutTitle}</Text>
                    {workoutTemplateLabel ? (
                      <Text style={styles.templateLabel}>{workoutTemplateLabel}</Text>
                    ) : null}

                    {selectedDayDate ? (
                      <PressableScale
                        haptic="selection"
                        onPress={() => setActiveDayModal(planDayDate || todayKey)}
                        style={styles.datePillRow}
                        accessibilityLabel="Open calendar day options"
                      >
                        <CalendarDays size={13} color={colors.primaryLight} />
                        <Text style={styles.datePillText}>
                          Calendar Date: {selectedDayDate.formattedFull}
                          {shownDay === currentDay ? ' (Today)' : ''}
                        </Text>
                        <ChevronRight size={13} color={colors.primaryLight} />
                      </PressableScale>
                    ) : null}

                    {displayedDayStatus === 'COMPLETED' ? (
                      <>
                        {/* Synced Completed Workout Hero Card */}
                        <View style={styles.completedSessionHero}>
                          <View style={styles.completedHeroHeader}>
                            <View style={styles.completedHeroIcon}>
                              <Check size={18} color="#10B981" strokeWidth={3} />
                            </View>
                            <View style={styles.completedHeroTitleCol}>
                              <Text style={styles.completedHeroEyebrow}>Workout Completed</Text>
                              <Text style={styles.completedHeroTitle}>{completedSessionTitle}</Text>
                            </View>
                          </View>

                          <View style={styles.completedHeroStatsRow}>
                            {completedDurationSeconds ? (
                              <View style={styles.completedStatPill}>
                                <Clock size={12} color={colors.textSecondary} />
                                <Text style={styles.completedStatText}>
                                  {formatDuration(completedDurationSeconds)}
                                </Text>
                              </View>
                            ) : null}
                            {completedVolumeKg ? (
                              <View style={styles.completedStatPill}>
                                <Layers size={12} color={colors.cyan} />
                                <Text style={styles.completedStatText}>
                                  {formatVolume(completedVolumeKg)}
                                </Text>
                              </View>
                            ) : null}
                            <View style={styles.completedStatPill}>
                              <Dumbbell size={12} color={colors.primaryLight} />
                              <Text style={styles.completedStatText}>
                                {completedExercises.length || completedExerciseCount} exercises logged
                              </Text>
                            </View>
                          </View>

                          {completedSessionId ? (
                            <PressableScale
                              haptic="selection"
                              onPress={() => router.push(`/workout/${completedSessionId}`)}
                              style={styles.viewSessionBtn}
                              accessibilityLabel="View workout session details"
                            >
                              <Text style={styles.viewSessionBtnText}>View session details</Text>
                              <ChevronRight size={15} color={colors.primaryLight} />
                            </PressableScale>
                          ) : null}
                        </View>

                        {/* Completed Exercises with Logged Data (Nothing extra!) */}
                        {completedExercises.length > 0 && (
                          <View style={styles.completedExercisesSection}>
                            <View style={styles.exerciseSectionHeader}>
                              <Text style={styles.exerciseSectionTitle}>Completed Exercises</Text>
                              <Text style={styles.exerciseSectionCount}>
                                {completedExercises.length} movements
                              </Text>
                            </View>

                            {completedExercises.map((ex: any, i: number) => {
                              const sets = ex.sets || [];
                              const maxWeight = Math.max(...sets.map((s: any) => s.weight_kg || 0), 0);
                              const exName = ex.exercise_name || ex.exercise?.name || 'Exercise';
                              const muscle = ex.primary_muscle || ex.exercise?.primary_muscle?.name;

                              return (
                                <View key={ex.id || i} style={styles.completedExerciseCard}>
                                  <View style={styles.completedExerciseHeader}>
                                    <View style={styles.exerciseHeaderLeft}>
                                      <View style={styles.completedIndexBadge}>
                                        <Check size={12} color="#10B981" strokeWidth={3} />
                                      </View>
                                      <View style={styles.exerciseTitleCol}>
                                        <Text style={styles.exerciseName} numberOfLines={2}>
                                          {exName}
                                        </Text>
                                        {muscle ? (
                                          <Text style={styles.exerciseMuscle}>{muscle}</Text>
                                        ) : null}
                                      </View>
                                    </View>
                                    <View style={styles.completedSummaryBadge}>
                                      <Text style={styles.completedSummaryBadgeText}>
                                        {sets.length} {sets.length === 1 ? 'set' : 'sets'}
                                        {maxWeight > 0 ? ` · ${maxWeight} kg` : ''}
                                      </Text>
                                    </View>
                                  </View>

                                  {sets.length > 0 ? (
                                    <View style={styles.completedSetsTable}>
                                      <View style={styles.setsTableHeader}>
                                        <Text style={[styles.setsTableColHeader, { flex: 0.8 }]}>SET</Text>
                                        <Text style={[styles.setsTableColHeader, { flex: 1.4 }]}>LOAD</Text>
                                        <Text style={[styles.setsTableColHeader, { flex: 1.2 }]}>REPS</Text>
                                        <Text style={[styles.setsTableColHeader, { flex: 0.9 }]}>RPE</Text>
                                      </View>
                                      {sets.map((s: any, sIdx: number) => {
                                        const loadText =
                                          s.weight_kg > 0
                                            ? `${s.weight_kg} kg`
                                            : s.duration_seconds
                                            ? formatDuration(s.duration_seconds)
                                            : 'Bodyweight';
                                        const repsText =
                                          s.reps > 0
                                            ? `${s.reps} reps`
                                            : s.distance_km
                                            ? `${s.distance_km} km`
                                            : s.duration_seconds
                                            ? s.intensity || 'Completed'
                                            : '--';
                                        const rpeText = s.rpe != null ? `@${s.rpe}` : '--';

                                        return (
                                          <View key={s.id || sIdx} style={styles.setsTableRow}>
                                            <Text style={[styles.setsTableCell, styles.setNumberText, { flex: 0.8 }]}>
                                              {s.set_number || sIdx + 1}
                                            </Text>
                                            <Text style={[styles.setsTableCell, styles.setValueText, { flex: 1.4 }]}>
                                              {loadText}
                                            </Text>
                                            <Text style={[styles.setsTableCell, styles.setValueText, { flex: 1.2 }]}>
                                              {repsText}
                                            </Text>
                                            <Text style={[styles.setsTableCell, styles.setMutedText, { flex: 0.9 }]}>
                                              {rpeText}
                                            </Text>
                                          </View>
                                        );
                                      })}
                                    </View>
                                  ) : null}
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </>
                    ) : (
                      <>
                        {routine?.description ? (
                          <Text style={styles.dayDesc}>{routine.description}</Text>
                        ) : null}

                        {/* Exercises Section */}
                        {exercises.length > 0 && (
                          <View style={styles.exerciseSectionHeader}>
                            <Text style={styles.exerciseSectionTitle}>Prescribed Exercises</Text>
                            <Text style={styles.exerciseSectionCount}>
                              {exercises.length} movements
                            </Text>
                          </View>
                        )}

                        {exercises.map((ex, i) => {
                          const raw = ex as any;
                          const load = plannedLoad(ex);
                          const displayName = getRoutineExerciseDisplayName(ex);
                          const isSwapped = !!ex.swap;
                          const muscleFocus = isSwapped
                            ? ex.swap?.primary_muscle || ex.focus
                            : ex.focus || ex.primary_muscle || raw.muscle;
                          const targetSets = ex.target_sets ?? raw.targetSets ?? '--';
                          const targetReps = ex.target_reps ?? raw.targetReps ?? '--';
                          const restSeconds = ex.rest_seconds ?? raw.restSeconds ?? 90;

                          return (
                            <View key={ex.id || i} style={styles.exerciseCard}>
                              <View style={styles.exerciseCardHeader}>
                                <View style={styles.exerciseHeaderLeft}>
                                  <View style={styles.exerciseIndexBadge}>
                                    <Text style={styles.exerciseIndexBadgeText}>{i + 1}</Text>
                                  </View>
                                  <View style={styles.exerciseTitleCol}>
                                    <View style={styles.exerciseNameRow}>
                                      <Text style={styles.exerciseName} numberOfLines={2}>
                                        {displayName}
                                      </Text>
                                      {isSwapped && <Badge label="Swapped" tone="amber" />}
                                    </View>
                                    {muscleFocus ? (
                                      <Text style={styles.exerciseMuscle}>{muscleFocus}</Text>
                                    ) : null}
                                  </View>
                                </View>
                              </View>

                              {/* 4-Column Aligned Stat Grid */}
                              <View style={styles.statGrid}>
                                <View style={styles.statBox}>
                                  <Text style={styles.statBoxLabel}>SETS</Text>
                                  <Text style={styles.statBoxValue}>{targetSets}</Text>
                                </View>
                                <View style={styles.statBox}>
                                  <Text style={styles.statBoxLabel}>REPS</Text>
                                  <Text style={styles.statBoxValue}>{targetReps}</Text>
                                </View>
                                <View style={styles.statBox}>
                                  <Text style={styles.statBoxLabel}>REST</Text>
                                  <Text style={styles.statBoxValue}>{restSeconds}s</Text>
                                </View>
                                <View style={styles.statBox}>
                                  <Text style={styles.statBoxLabel}>LOAD</Text>
                                  <Text style={styles.statBoxValue}>{load ? `${load} kg` : '--'}</Text>
                                </View>
                              </View>

                              {/* RPE & Notes callouts */}
                              {(ex.target_rpe || ex.notes) ? (
                                <View style={styles.exerciseDetailsRow}>
                                  {ex.target_rpe ? (
                                    <View style={styles.rpePill}>
                                      <Text style={styles.rpePillText}>Target RPE {ex.target_rpe}</Text>
                                    </View>
                                  ) : null}
                                  {ex.notes ? (
                                    <Text style={styles.exerciseCoachingNote} numberOfLines={2}>
                                      {ex.notes}
                                    </Text>
                                  ) : null}
                                </View>
                              ) : null}

                              {/* Action buttons */}
                              <View style={styles.exerciseCardFooter}>
                                <PressableScale
                                  haptic="selection"
                                  onPress={() => setSwapTarget({ dayNumber: shownDay, routineExerciseId: ex.id })}
                                  style={styles.swapActionBtn}
                                  accessibilityLabel={`Swap ${displayName}`}
                                >
                                  <Repeat size={13} color={colors.primaryLight} strokeWidth={2.4} />
                                  <Text style={styles.swapActionBtnText}>Swap exercise</Text>
                                </PressableScale>

                                {isSwapped && (
                                  <PressableScale
                                    haptic="selection"
                                    onPress={() =>
                                      swapMutation.mutate({
                                        day_number: shownDay,
                                        routine_exercise_id: ex.id,
                                        exercise_id: ex.exercise,
                                      })
                                    }
                                    style={styles.revertActionBtn}
                                    accessibilityLabel={`Revert ${displayName} to recommended exercise`}
                                  >
                                    <RotateCcw size={13} color={colors.textMuted} strokeWidth={2.2} />
                                    <Text style={styles.revertActionBtnText}>Revert to original</Text>
                                  </PressableScale>
                                )}
                              </View>
                            </View>
                          );
                        })}

                        {/* Blueprint Payload Exercises fallback */}
                        {payloadExercises.map((ex, i) => (
                          <View key={i} style={styles.exerciseCard}>
                            <View style={styles.exerciseCardHeader}>
                              <View style={styles.exerciseHeaderLeft}>
                                <View style={styles.exerciseIndexBadge}>
                                  <Text style={styles.exerciseIndexBadgeText}>{i + 1}</Text>
                                </View>
                                <View style={styles.exerciseTitleCol}>
                                  <View style={styles.exerciseNameRow}>
                                    <Text style={styles.exerciseName} numberOfLines={2}>
                                      {ex.exercise_name || 'Exercise'}
                                    </Text>
                                    {ex.is_cardio && <Badge label="Cardio" tone="amber" />}
                                  </View>
                                </View>
                              </View>
                            </View>

                            <View style={styles.statGrid}>
                              <View style={styles.statBox}>
                                <Text style={styles.statBoxLabel}>SETS</Text>
                                <Text style={styles.statBoxValue}>{ex.sets ?? '--'}</Text>
                              </View>
                              <View style={styles.statBox}>
                                <Text style={styles.statBoxLabel}>REPS</Text>
                                <Text style={styles.statBoxValue}>{ex.reps ?? '--'}</Text>
                              </View>
                              <View style={styles.statBox}>
                                <Text style={styles.statBoxLabel}>REST</Text>
                                <Text style={styles.statBoxValue}>
                                  {ex.rest_seconds ? `${ex.rest_seconds}s` : '--'}
                                </Text>
                              </View>
                              <View style={styles.statBox}>
                                <Text style={styles.statBoxLabel}>RPE</Text>
                                <Text style={styles.statBoxValue}>
                                  {ex.rpe != null ? String(ex.rpe) : '--'}
                                </Text>
                              </View>
                            </View>

                            {ex.progression_rule ? (
                              <View style={styles.exerciseDetailsRow}>
                                <Text style={styles.exerciseCoachingNote} numberOfLines={2}>
                                  {ex.progression_rule}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        ))}

                        {/* Rest Day State */}
                        {exercises.length === 0 && payloadExercises.length === 0 && (
                          <View style={styles.restDayCard}>
                            <View style={styles.restDayIconWrap}>
                              <Moon size={28} color={colors.cyan} strokeWidth={2.4} />
                            </View>
                            <Text style={styles.restDayTitle}>Rest &amp; Active Recovery</Text>
                            <Text style={styles.restDayDesc}>
                              {routine?.description ||
                                'No heavy lifting scheduled today. Focus on mobility, light walking, hydration and nutrition — recovery is where muscle adaptations occur.'}
                            </Text>
                          </View>
                        )}

                        {/* 1-tap quick status selector */}
                        <View style={styles.statusRow}>
                          <SnapStatusButton
                            label="Done"
                            icon={
                              <Check
                                size={14}
                                color={day?.status === 'COMPLETED' ? colors.primaryLight : colors.textSecondary}
                              />
                            }
                            active={day?.status === 'COMPLETED'}
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
                                color={day?.status === 'REST' ? colors.cyan : colors.textSecondary}
                              />
                            }
                            active={day?.status === 'REST'}
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
                                color={day?.status === 'MISSED' ? colors.warning : colors.textSecondary}
                              />
                            }
                            active={day?.status === 'MISSED'}
                            activeColor={colors.warning}
                            activeBackground={colors.amberGlow}
                            onPress={() => statusMutation.mutate('MISSED')}
                            disabled={statusMutation.isPending}
                          />

                          {day?.status && day.status !== 'UPCOMING' && (
                            <SnapStatusButton
                              icon={<RotateCcw size={13} color={colors.textMuted} />}
                              flex={0.5}
                              onPress={() => statusMutation.mutate('UPCOMING')}
                              disabled={statusMutation.isPending}
                              accessibilityLabel="Reset status"
                            />
                          )}
                        </View>

                        {exercises.length > 0 ? (
                          <Button
                            title="Start & log this workout"
                            icon={<Dumbbell size={18} color="#FFFFFF" />}
                            iconPosition="left"
                            onPress={() =>
                              router.push({
                                pathname: '/workout/log',
                                params: {
                                  plan: '1',
                                  routineId: routine?.id,
                                  dayNumber: String(shownDay),
                                  date: planDayDate || undefined,
                                },
                              })
                            }
                            style={styles.dayAction}
                          />
                        ) : null}
                      </>
                    )}
                  </>
                )}
              </Card>

              <Text style={styles.footnote}>
                The program day advances when you complete a session — missed calendar days never skip training.
              </Text>
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* Exercise Picker for Swapping */}
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

      {/* Calendar Day Action Modal (Identical feature to Home Page WeekCalendar) */}
      {activeDayModal && (
        <DayActionModal
          visible={!!activeDayModal}
          dateKey={activeDayModal}
          dayInfo={stats?.calendar_days ? stats.calendar_days[activeDayModal] : null}
          onClose={() => setActiveDayModal(null)}
          onStatusUpdated={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
            queryClient.invalidateQueries({ queryKey: ['todaysWorkout'] });
          }}
        />
      )}
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnTinted: {
    backgroundColor: colors.primarySurface,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  overviewCard: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  overviewStrong: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  overviewMuted: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 2,
  },
  progressMetaCenter: {
    alignItems: 'center',
  },
  progressMetaRight: {
    alignItems: 'flex-end',
  },
  progressMetaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  progressMetaValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  planStateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  nearCompletionText: {
    color: colors.amber,
    fontSize: 12,
    fontWeight: '700',
    paddingTop: spacing.xs,
  },
  calendarSection: {
    marginTop: spacing.lg,
  },
  filterSection: {
    marginTop: spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs + 2,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterTabsStrip: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryLight,
  },
  filterChipActiveCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  filterChipActiveRest: {
    backgroundColor: colors.cyanGlow,
    borderColor: colors.cyan,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.primaryLight,
  },
  filterChipTextCompleted: {
    color: '#10B981',
  },
  filterChipTextRest: {
    color: colors.cyan,
  },
  strip: {
    gap: DAY_GAP,
    paddingVertical: spacing.sm,
  },
  dayChip: {
    width: DAY_CHIP_WIDTH,
    height: DAY_CHIP_HEIGHT,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  dayChipTopRow: {
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCheckIcon: {
    width: 13,
    height: 13,
    borderRadius: radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTodayDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.cyan,
  },
  miniDotPlaceholder: {
    width: 4,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  dayChipNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  dayChipDate: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  dayChipDateStrong: {
    color: colors.textSecondary,
  },
  dayChipDateSelected: {
    color: colors.textPrimary,
  },
  dayChipDone: {
    backgroundColor: colors.primarySurface,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  dayChipRest: {
    backgroundColor: colors.cyanGlow,
    borderColor: 'rgba(2, 132, 199, 0.35)',
  },
  dayChipMissed: {
    backgroundColor: colors.amberGlow,
    borderColor: 'rgba(217, 119, 6, 0.35)',
  },
  dayChipToday: {
    borderColor: colors.cyan,
  },
  dayChipOptional: {
    borderStyle: 'dashed',
  },
  dayChipSelected: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primaryLight,
    borderWidth: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  dayChipTextStrong: {
    color: colors.textPrimary,
  },
  dayChipTextSelected: {
    color: colors.primaryLight,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  navBtn: {
    flex: 1,
  },
  dayCard: {
    marginTop: spacing.lg,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  templateLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
    marginTop: 3,
  },
  datePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: spacing.xs,
  },
  datePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  dayDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 19,
  },
  /* Missed / Skipped Day feature styles matching calendar card */
  missedCalendarCard: {
    gap: spacing.sm,
  },
  missedCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  missedCol: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  missedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  missedMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: 4,
  },
  missedIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.amberGlow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
  },
  dayOptionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  dayOptionsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  missedExercisesSection: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  missedExercisesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  missedToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  missedToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  missedExercisesList: {
    marginTop: spacing.xs,
  },
  /* Completed Hero styles */
  completedSessionHero: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySurface,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    gap: spacing.sm,
  },
  completedHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  completedHeroIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  completedHeroTitleCol: {
    flex: 1,
  },
  completedHeroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#059669',
  },
  completedHeroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 1,
  },
  completedHeroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginTop: 2,
  },
  completedStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  completedStatText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  viewSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 2,
  },
  viewSessionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  completedExercisesSection: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  completedExerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  completedExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedSummaryBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  completedSummaryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  completedSetsTable: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  setsTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  setsTableColHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  setsTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  setsTableCell: {
    fontSize: 12,
  },
  setNumberText: {
    fontWeight: '700',
    color: colors.textMuted,
  },
  setValueText: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  setMutedText: {
    fontWeight: '600',
    color: colors.textSecondary,
  },
  exerciseSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exerciseSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  exerciseSectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    flex: 1,
  },
  exerciseIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  exerciseIndexBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  exerciseTitleCol: {
    flex: 1,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  exerciseMuscle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 7,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBoxLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statBoxValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  exerciseDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  rpePill: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rpePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  exerciseCoachingNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  exerciseCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.md,
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  swapActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
  },
  swapActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  revertActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  revertActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  restDayCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  restDayIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.cyanGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  restDayTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  restDayDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  dayAction: {
    marginTop: spacing.md,
  },
  footnote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 17,
  },
}));
