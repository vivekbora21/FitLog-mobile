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
  Dumbbell,
  Flag,
  SlidersHorizontal,
  Check,
  Moon,
  FastForward,
  RotateCcw,
} from 'lucide-react-native';
import { api, extractErrorMessage, type ProgramDay } from '../src/api/client';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PressableScale,
  ProgressBar,
  ScreenSkeleton,
} from '../src/components/ui';
import { radius, spacing, makeStyles, useTheme } from '../src/theme';
import { getProgramDayDate, toDateKey } from '../src/lib/format';
import { haptics } from '../src/lib/haptics';
import type { RoutineExercise } from '../src/types';

const DAY_CHIP_WIDTH = 58;
const DAY_CHIP_HEIGHT = 52;
const DAY_GAP = spacing.sm;
const enter = (i: number) => FadeInDown.delay(60 + i * 60).duration(420);

// Same source of truth as the workout logger: server progression, then routine default.
function plannedLoad(ex: RoutineExercise) {
  return ex.progression?.recommended_weight_kg ?? ex.suggested_weight_kg ?? null;
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
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['workoutPlan'],
    queryFn: () => api.getWorkoutPlan(),
  });

  const queryClient = useQueryClient();
  const program = data?.program ?? null;
  const days = data?.days ?? [];
  const currentDay = program?.current_day ?? 1;
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const shownDay = selectedDay ?? currentDay;
  const day = days.find((d) => d.day_number === shownDay);
  const routine = day?.routine_details;
  const exercises = routine?.exercises ?? [];
  const completed = days.filter((d) => d.status === 'COMPLETED').length;
  const duration = program?.duration_days ?? days.length;

  const statusMutation = useMutation({
    mutationFn: (newStatus: 'COMPLETED' | 'MISSED' | 'UPCOMING' | 'REST') =>
      api.updateProgramDay({ day_number: shownDay, status: newStatus }),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['workoutPlan'] });
      queryClient.invalidateQueries({ queryKey: ['todaysWorkout'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't update plan day", extractErrorMessage(err));
    },
  });

  const planDayDate = useMemo(() => {
    if (!program?.start_date) return null;
    const parts = program.start_date.split('-');
    if (parts.length !== 3) return null;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + (shownDay - 1));
    return toDateKey(d);
  }, [program?.start_date, shownDay]);

  const selectedDayDate = useMemo(() => {
    return getProgramDayDate(program?.start_date, shownDay);
  }, [program?.start_date, shownDay]);

  const currentDayDate = useMemo(() => {
    return getProgramDayDate(program?.start_date, currentDay);
  }, [program?.start_date, currentDay]);

  // Keep the selected day visible in the strip.
  const stripRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (!program) return;
    const x = Math.max(0, (shownDay - 3) * (DAY_CHIP_WIDTH + DAY_GAP));
    stripRef.current?.scrollTo({ x, animated: selectedDay !== null });
  }, [shownDay, program, selectedDay]);

  const selectDay = (n: number) => {
    haptics.selection();
    setSelectedDay(Math.min(Math.max(1, n), Math.max(duration, 1)));
  };

  const header = (
    <View style={styles.topBar}>
      <PressableScale haptic="selection" onPress={() => router.back()} style={styles.iconBtn} accessibilityLabel="Back">
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
            onRefresh={() => refetch()}
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
            {/* Overview */}
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
                    {completed} completed
                  </Text>
                </View>
                <ProgressBar percentage={(completed / Math.max(duration, 1)) * 100} height={8} />
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
              </Card>
            </Animated.View>

            {/* Day strip */}
            <Animated.View entering={enter(1)}>
              <ScrollView
                ref={stripRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.strip}
              >
                {days.map((d) => {
                  const selected = d.day_number === shownDay;
                  const done = d.status === 'COMPLETED';
                  const isRest = d.status === 'REST';
                  const isMissed = d.status === 'MISSED';
                  const isToday = d.day_number === currentDay;
                  const dayDate = getProgramDayDate(program?.start_date, d.day_number);

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
                      <Text
                        style={[
                          styles.dayChipNumber,
                          (done || isRest || isMissed || selected) && styles.dayChipTextStrong,
                        ]}
                      >
                        {d.day_number}
                      </Text>
                      {dayDate ? (
                        <Text
                          style={[
                            styles.dayChipDate,
                            (done || isRest || isMissed || selected) && styles.dayChipDateStrong,
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
                  title="Today"
                  size="sm"
                  variant="secondary"
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

            {/* Selected day */}
            <Animated.View entering={enter(2)}>
              <Card elevated highlighted={shownDay === currentDay} style={styles.dayCard}>
                <View style={styles.dayHeaderRow}>
                  {day ? (
                    <Badge
                      label={dayTone(day, currentDay).label + (day.is_optional ? ' · Optional' : '')}
                      tone={dayTone(day, currentDay).tone}
                    />
                  ) : null}
                  <Text style={styles.dayNumber}>
                    Day {shownDay}
                    {selectedDayDate ? ` · ${selectedDayDate.formattedFull}` : ''}
                  </Text>
                </View>
                <Text style={styles.dayTitle}>{day?.label || routine?.name || 'Plan day unavailable'}</Text>
                {selectedDayDate ? (
                  <View style={styles.datePillRow}>
                    <CalendarDays size={13} color={colors.primaryLight} />
                    <Text style={styles.datePillText}>
                      Calendar Date: {selectedDayDate.formattedFull}
                      {shownDay === currentDay ? ' (Today)' : ''}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.dayDesc}>
                  {routine?.description || (routine ? '' : 'Rest & recovery — no lifting scheduled.')}
                </Text>

                {exercises.map((ex, i) => {
                  const load = plannedLoad(ex);
                  return (
                    <View key={ex.id} style={[styles.exRow, i > 0 && styles.exRowBorder]}>
                      <View style={styles.exIndex}>
                        <Text style={styles.exIndexText}>{i + 1}</Text>
                      </View>
                      <View style={styles.exBody}>
                        <Text style={styles.exName}>{ex.exercise_name}</Text>
                        <Text style={styles.exFocus}>{ex.focus || ex.primary_muscle}</Text>
                        <View style={styles.exStats}>
                          <Stat label="Sets" value={`${ex.target_sets} × ${ex.target_reps}`} />
                          <Stat label="Rest" value={`${ex.rest_seconds}s`} />
                          <Stat label="RPE" value={String(ex.target_rpe || 8)} />
                          <Stat label="Load" value={load ? `${load} kg` : '--'} />
                        </View>
                        {ex.notes ? <Text style={styles.exNote}>{ex.notes}</Text> : null}
                      </View>
                    </View>
                  );
                })}

                {/* 1-tap quick status selector */}
                <View style={styles.statusRow}>
                  <PressableScale
                    style={[
                      styles.statusBtn,
                      day?.status === 'COMPLETED' && styles.statusBtnActiveDone,
                    ]}
                    onPress={() => statusMutation.mutate('COMPLETED')}
                    disabled={statusMutation.isPending}
                  >
                    <Check
                      size={14}
                      color={day?.status === 'COMPLETED' ? colors.primaryLight : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.statusBtnText,
                        day?.status === 'COMPLETED' && { color: colors.primaryLight },
                      ]}
                    >
                      Done
                    </Text>
                  </PressableScale>

                  <PressableScale
                    style={[
                      styles.statusBtn,
                      day?.status === 'REST' && styles.statusBtnActiveRest,
                    ]}
                    onPress={() => statusMutation.mutate('REST')}
                    disabled={statusMutation.isPending}
                  >
                    <Moon
                      size={14}
                      color={day?.status === 'REST' ? colors.cyan : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.statusBtnText,
                        day?.status === 'REST' && { color: colors.cyan },
                      ]}
                    >
                      Rest
                    </Text>
                  </PressableScale>

                  <PressableScale
                    style={[
                      styles.statusBtn,
                      day?.status === 'MISSED' && styles.statusBtnActiveSkip,
                    ]}
                    onPress={() => statusMutation.mutate('MISSED')}
                    disabled={statusMutation.isPending}
                  >
                    <FastForward
                      size={14}
                      color={day?.status === 'MISSED' ? colors.warning : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.statusBtnText,
                        day?.status === 'MISSED' && { color: colors.warning },
                      ]}
                    >
                      Skip
                    </Text>
                  </PressableScale>

                  {day?.status && day.status !== 'UPCOMING' && (
                    <PressableScale
                      style={[styles.statusBtn, { flex: 0.6 }]}
                      onPress={() => statusMutation.mutate('UPCOMING')}
                      disabled={statusMutation.isPending}
                    >
                      <RotateCcw size={13} color={colors.textMuted} />
                    </PressableScale>
                  )}
                </View>

                {exercises.length > 0 ? (
                  <Button
                    title={day?.status === 'COMPLETED' ? 'Log this workout again' : 'Start & log this workout'}
                    icon={<Dumbbell size={18} color="#FFFFFF" />}
                    iconPosition="left"
                    onPress={() =>
                      router.push({
                        pathname: '/workout/log',
                        params: {
                          plan: '1',
                          routineId: routine?.id,
                          date: planDayDate || undefined,
                        },
                      })
                    }
                    style={styles.dayAction}
                  />
                ) : null}
              </Card>
              <Text style={styles.footnote}>
                The program day advances when you complete a session — missed calendar days never skip training.
              </Text>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
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
    marginTop: spacing.lg,
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
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
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
  strip: {
    gap: DAY_GAP,
    paddingVertical: spacing.lg,
  },
  dayChip: {
    width: DAY_CHIP_WIDTH,
    height: DAY_CHIP_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 3,
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
    marginTop: 1,
  },
  dayChipDateStrong: {
    color: colors.textPrimary,
  },
  datePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: spacing.xs,
  },
  datePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  dayChipDone: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderGlow,
  },
  dayChipRest: {
    backgroundColor: colors.cyanGlow,
    borderColor: colors.cyan,
  },
  dayChipMissed: {
    backgroundColor: colors.amberGlow,
    borderColor: colors.warning,
  },
  dayChipToday: {
    borderColor: colors.cyan,
  },
  dayChipOptional: {
    borderStyle: 'dashed',
  },
  dayChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  dayChipTextStrong: {
    color: colors.textPrimary,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  dayDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 19,
  },
  exRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  exRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exIndex: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  exIndexText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  exBody: {
    flex: 1,
  },
  exName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  exFocus: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  exStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stat: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  exNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  dayAction: {
    marginTop: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
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
  statusBtnActiveDone: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderGlow,
  },
  statusBtnActiveRest: {
    backgroundColor: colors.cyanGlow,
    borderColor: colors.cyan,
  },
  statusBtnActiveSkip: {
    backgroundColor: colors.amberGlow,
    borderColor: colors.warning,
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  footnote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 17,
  },
}));
