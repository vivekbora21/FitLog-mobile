import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Flame,
  Dumbbell,
  Trophy,
  Sparkles,
  Droplet,
  Footprints,
  ChevronRight,
  Target,
  Scale,
  Check,
  Plus,
  ClipboardCheck,
} from 'lucide-react-native';
import { useAuth } from '../../src/providers/auth';
import { api, extractErrorMessage } from '../../src/api/client';
import {
  Card,
  Badge,
  MetricCard,
  Avatar,
  ProgressRing,
  ProgressBar,
  PressableScale,
  ScreenSkeleton,
  ErrorState,
  Stepper,
} from '../../src/components/ui';
import { useTabBarClearance } from '../../src/components/navigation/TabBar';
import { colors, radius, spacing } from '../../src/theme';
import { formatNumber, calculateMacroPercentage } from '../../src/types';
import { formatVolume, getGreeting, getLastSevenDays, toDateKey } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { invalidateTrackingData } from '../../src/lib/queries';

const enter = (i: number) => FadeInDown.delay(80 + i * 70).duration(450);

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const bottomClearance = useTabBarClearance();

  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: isStatsError,
    error: statsError,
    refetch: refetchStats,
    isRefetching: isStatsRefetching,
  } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => api.getDashboardStats(),
  });

  const {
    data: todayWorkout,
    refetch: refetchWorkout,
    isRefetching: isWorkoutRefetching,
  } = useQuery({
    queryKey: ['todaysWorkout'],
    queryFn: () => api.getTodaysWorkout(),
  });

  const isRefreshing = isStatsRefetching || isWorkoutRefetching;

  const onRefresh = async () => {
    haptics.light();
    await Promise.all([refetchStats(), refetchWorkout()]);
  };

  const weekDays = useMemo(() => getLastSevenDays(), []);
  const todayKey = toDateKey(new Date());

  const waterMutation = useMutation({
    mutationFn: (ml: number) => api.updateWater(todayKey, ml),
    onSuccess: () => invalidateTrackingData(queryClient),
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't update water", extractErrorMessage(err));
    },
  });

  const openDay = (key: string) => router.navigate({ pathname: '/(tabs)/nutrition', params: { date: key } });

  if (isStatsLoading && !stats) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenSkeleton />
      </SafeAreaView>
    );
  }

  if (isStatsError && !stats) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ErrorState
          title="Unable to load dashboard"
          message={extractErrorMessage(statsError)}
          onRetry={onRefresh}
          retrying={isRefreshing}
        />
      </SafeAreaView>
    );
  }

  const nutrition = stats?.nutrition;
  const journey = stats?.journey;
  const dailyLog = stats?.daily_log;
  const pacing = stats?.journey_pacing;
  const prs = stats?.recent_prs || [];
  const heatmap = stats?.activity_heatmap || {};

  const today = todayWorkout?.today;
  const routineDetails = today?.routine_details;
  const routineName = routineDetails?.name || today?.label || 'Active Rest & Recovery';
  const exerciseCount = routineDetails?.exercises?.length || 0;
  const isWorkoutDone = today?.status === 'COMPLETED';

  const calConsumed = nutrition?.calories_consumed || 0;
  const calTarget = nutrition?.calories_target || 0;
  const calPct = calculateMacroPercentage(calConsumed, calTarget);
  const calRemaining = Math.max(0, calTarget - calConsumed);

  const macros = [
    {
      label: 'Protein',
      consumed: nutrition?.protein_consumed || 0,
      target: nutrition?.protein_target || 0,
      color: colors.cyan,
    },
    {
      label: 'Carbs',
      consumed: nutrition?.carbs_consumed || 0,
      target: nutrition?.carbs_target || 0,
      color: colors.amber,
    },
    {
      label: 'Fat',
      consumed: nutrition?.fat_consumed || 0,
      target: nutrition?.fat_target || 0,
      color: colors.violet,
    },
  ];

  const waterMl = nutrition?.water_consumed_ml || 0;
  const waterCups = Math.round(waterMl / 250);
  const waterTargetCups = Math.round((nutrition?.water_target_ml || 2500) / 250);
  const waterPct = calculateMacroPercentage(waterCups, waterTargetCups);
  const steps = dailyLog?.steps || 0;

  const workoutsThisWeek = stats?.workouts_this_week ?? 0;
  const weeklyTarget = stats?.weekly_workouts_target ?? journey?.weekly_workouts_target ?? 4;

  const programDay = pacing?.current_day || journey?.program_day;
  const programLength = pacing?.duration_days || journey?.program_length || 60;
  const programPct =
    journey?.program_completion_percent ??
    (programDay ? Math.round((programDay / programLength) * 100) : 0);
  const insight = journey?.copilot_insight || pacing?.copilot_insight;
  const targetWeight = journey?.target_weight || pacing?.target_weight;

  const displayName = user?.first_name || user?.username || 'Athlete';

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
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <PressableScale
            haptic="selection"
            onPress={() => router.navigate('/(tabs)/profile')}
            accessibilityLabel="Open profile"
            style={styles.headerLeft}
          >
            <Avatar name={user?.full_name || displayName} imageUrl={user?.avatar_url} size={46} />
            <View style={styles.headerText}>
              <Text style={styles.greetingEyebrow}>{getGreeting()}</Text>
              <Text style={styles.greeting} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
          </PressableScale>
          <View
            style={styles.streakBadge}
            accessible
            accessibilityLabel={`${stats?.streak_days ?? 0} day streak`}
          >
            <Flame size={18} color={colors.warning} fill={colors.warning} />
            <Text style={styles.streakValue}>{stats?.streak_days ?? 0}</Text>
          </View>
        </Animated.View>

        {/* Week strip */}
        <Animated.View entering={enter(0)}>
          <Card style={styles.weekCard}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekTitle}>This week</Text>
              <Text style={styles.weekCount}>
                <Text style={styles.weekCountStrong}>{workoutsThisWeek}</Text> / {weeklyTarget} workouts
              </Text>
            </View>
            <View style={styles.weekRow}>
              {weekDays.map((d) => {
                const key = toDateKey(d);
                const active = (heatmap[key] || 0) > 0;
                const isToday = key === todayKey;
                return (
                  <PressableScale
                    key={key}
                    haptic="selection"
                    onPress={() => openDay(key)}
                    style={styles.dayCol}
                    accessibilityLabel={`${d.toLocaleDateString('en-US', { weekday: 'long' })}: ${
                      active ? 'trained' : 'no workout'
                    }`}
                    accessibilityHint="Opens that day's log"
                  >
                    <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                      {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                    </Text>
                    <View
                      style={[
                        styles.dayDot,
                        active && styles.dayDotActive,
                        isToday && !active && styles.dayDotToday,
                      ]}
                    >
                      {active ? (
                        <Check size={14} color={colors.textInverse} strokeWidth={3} />
                      ) : (
                        <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{d.getDate()}</Text>
                      )}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </Card>
        </Animated.View>

        {/* Quick actions */}
        <Animated.View entering={enter(0)} style={styles.quickRow}>
          <QuickAction
            icon={<Plus size={18} color={colors.primaryLight} />}
            label="Log food"
            onPress={() => router.push({ pathname: '/meal/add', params: { date: todayKey } })}
          />
          <QuickAction
            icon={<Dumbbell size={18} color={colors.cyan} />}
            label="Log workout"
            onPress={() =>
              router.push({
                pathname: '/workout/log',
                params: exerciseCount > 0 && !isWorkoutDone ? { plan: '1' } : {},
              })
            }
          />
          <QuickAction
            icon={<ClipboardCheck size={18} color={colors.amber} />}
            label="Check-in"
            onPress={() => router.push('/checkin')}
          />
        </Animated.View>

        {/* Nutrition hero */}
        <Animated.View entering={enter(1)}>
          <Card
            elevated
            onPress={() => router.navigate('/(tabs)/nutrition')}
            accessibilityHint="Opens nutrition details"
            style={styles.heroCard}
          >
            <View style={styles.heroRow}>
              <ProgressRing
                percentage={calPct}
                size={132}
                strokeWidth={12}
                color={colors.primaryLight}
                gradientTo={colors.cyan}
                delay={250}
              >
                <Text style={styles.ringValue}>{formatNumber(calRemaining)}</Text>
                <Text style={styles.ringLabel}>kcal left</Text>
              </ProgressRing>

              <View style={styles.macroCol}>
                {macros.map((m, i) => (
                  <View key={m.label} style={styles.macroItem}>
                    <View style={styles.macroTextRow}>
                      <Text style={styles.macroLabel}>{m.label}</Text>
                      <Text style={styles.macroValue}>
                        {formatNumber(m.consumed)}
                        <Text style={styles.macroTarget}>/{formatNumber(m.target)}g</Text>
                      </Text>
                    </View>
                    <ProgressBar
                      percentage={calculateMacroPercentage(m.consumed, m.target)}
                      color={m.color}
                      height={6}
                      delay={350 + i * 90}
                    />
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.heroFooter}>
              <Text style={styles.heroFooterText}>
                {formatNumber(calConsumed)} of {formatNumber(calTarget)} kcal eaten
              </Text>
              <ChevronRight size={16} color={colors.textMuted} />
            </View>
          </Card>
        </Animated.View>

        {/* Today's workout */}
        <Animated.View entering={enter(2)}>
          <Text style={styles.sectionTitle}>Today&apos;s workout</Text>
          <Card
            elevated
            highlighted={!isWorkoutDone && exerciseCount > 0}
            onPress={() => router.navigate('/(tabs)/workouts')}
            accessibilityHint="Opens today's workout"
            style={styles.todayCard}
          >
            <View style={styles.todayRow}>
              <View style={[styles.workoutIconBox, isWorkoutDone && styles.workoutIconDone]}>
                {isWorkoutDone ? (
                  <Check size={24} color={colors.textInverse} strokeWidth={3} />
                ) : (
                  <Dumbbell size={24} color={colors.primaryLight} />
                )}
              </View>
              <View style={styles.workoutInfo}>
                <Text style={styles.workoutName} numberOfLines={1}>
                  {routineName}
                </Text>
                <Text style={styles.workoutDetails}>
                  {isWorkoutDone
                    ? 'Completed — great work!'
                    : exerciseCount > 0
                      ? `${exerciseCount} exercises · ${today?.label || 'Scheduled'}`
                      : 'Rest day — recover well'}
                </Text>
              </View>
              <View style={styles.chevronCircle}>
                <ChevronRight size={18} color={colors.primaryLight} />
              </View>
            </View>

            {routineDetails?.exercises && exerciseCount > 0 && !isWorkoutDone && (
              <View style={styles.chipRow}>
                {routineDetails.exercises.slice(0, 3).map((ex, idx) => (
                  <View key={ex.id || idx} style={styles.exerciseChip}>
                    <Text style={styles.exerciseChipText} numberOfLines={1}>
                      {ex.exercise_name}
                    </Text>
                  </View>
                ))}
                {exerciseCount > 3 && (
                  <View style={[styles.exerciseChip, styles.exerciseChipMore]}>
                    <Text style={styles.exerciseChipMoreText}>+{exerciseCount - 3}</Text>
                  </View>
                )}
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Water + steps */}
        <Animated.View entering={enter(3)} style={styles.metricsGrid}>
          <MetricCard
            label="Water"
            value={`${waterCups}`}
            target={`${waterTargetCups} cups`}
            percentage={waterPct}
            accentColor={colors.blue}
            delay={500}
            icon={<Droplet size={14} color={colors.blue} />}
            footer={
              <View style={styles.metricFooter}>
                <Stepper
                  label="a cup of water"
                  accentColor={colors.blue}
                  disabled={waterMutation.isPending}
                  canDecrement={waterMl > 0}
                  onDecrement={() => waterMutation.mutate(Math.max(0, waterMl - 250))}
                  onIncrement={() => waterMutation.mutate(waterMl + 250)}
                />
              </View>
            }
          />
          <MetricCard
            label="Steps"
            value={steps ? formatNumber(steps) : '0'}
            target="10k"
            percentage={steps ? Math.min(100, Math.round((steps / 10000) * 100)) : 0}
            accentColor={colors.amber}
            delay={600}
            icon={<Footprints size={14} color={colors.amber} />}
            onPress={() => router.push('/checkin')}
            accessibilityHint="Opens the daily check-in to log steps and sleep"
            footer={<Text style={styles.metricFooterHint}>Tap to log steps & sleep</Text>}
          />
        </Animated.View>

        {/* Journey */}
        <Animated.View entering={enter(4)}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleInline}>Your journey</Text>
            <PressableScale haptic="selection" onPress={() => router.push('/progress')}>
              <Text style={styles.sectionAction}>Analytics &amp; charts →</Text>
            </PressableScale>
          </View>
          <Card
            elevated
            highlighted
            style={styles.journeyCard}
            onPress={() => router.push('/progress')}
            accessibilityHint="Opens full progress and analytics"
          >
            <View style={styles.badgeRow}>
              <Badge label={journey?.mode_label || pacing?.mode_label || 'Training'} tone="emerald" />
              {pacing?.pacing_status && pacing.pacing_status !== 'NO_PROGRAM' && (
                <Badge
                  label={pacing.pacing_status.replace(/_/g, ' ')}
                  tone={pacing.pacing_status === 'ON_TRACK' ? 'cyan' : 'amber'}
                />
              )}
            </View>
            <Text style={styles.journeyTitle}>{pacing?.program_name || 'Current training cycle'}</Text>

            {programDay ? (
              <View style={styles.programProgress}>
                <View style={styles.programProgressText}>
                  <Text style={styles.journeyDayText}>
                    Day {programDay} of {programLength}
                  </Text>
                  <Text style={styles.programPct}>{Math.min(100, programPct)}%</Text>
                </View>
                <ProgressBar percentage={programPct} height={8} delay={650} />
              </View>
            ) : null}

            {insight ? (
              <View style={styles.insightBox}>
                <Sparkles size={16} color={colors.primaryLight} />
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ) : null}

            <View style={styles.journeyMetricsRow}>
              <JourneyStat
                icon={<Scale size={14} color={colors.textSecondary} />}
                label="Current"
                value={journey?.current_weight ? `${journey.current_weight} kg` : '--'}
              />
              <View style={styles.metricDivider} />
              <JourneyStat
                icon={<Target size={14} color={colors.textSecondary} />}
                label="Target"
                value={targetWeight ? `${targetWeight} kg` : '--'}
              />
              <View style={styles.metricDivider} />
              <JourneyStat
                icon={<Dumbbell size={14} color={colors.textSecondary} />}
                label="Volume/wk"
                value={formatVolume(stats?.total_volume_kg_week)}
              />
            </View>

            <View style={styles.journeyFooter}>
              <Text style={styles.journeyFooterText}>View progress &amp; analytics</Text>
              <ChevronRight size={14} color={colors.primaryLight} />
            </View>
          </Card>
        </Animated.View>

        {/* PRs */}
        {prs.length > 0 && (
          <Animated.View entering={enter(5)}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleInline}>Recent PRs</Text>
              <PressableScale haptic="selection" onPress={() => router.push('/progress')}>
                <Text style={styles.sectionAction}>All records →</Text>
              </PressableScale>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.prScroll}
              style={styles.prScrollOuter}
              snapToInterval={172}
              decelerationRate="fast"
            >
              {prs.slice(0, 8).map((pr, idx) => (
                <View key={`${pr.exercise}-${idx}`} style={styles.prCard}>
                  <View style={styles.prIcon}>
                    <Trophy size={16} color={colors.warning} />
                  </View>
                  <Text style={styles.prExercise} numberOfLines={2}>
                    {pr.exercise}
                  </Text>
                  <Text style={styles.prWeight}>
                    {pr.max_weight_kg}
                    <Text style={styles.prUnit}> kg × {pr.reps}</Text>
                  </Text>
                  <Text style={styles.prSub}>e1RM {Math.round(pr.estimated_1rm)} kg</Text>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.quickAction} accessibilityLabel={label}>
      <View style={styles.quickIcon}>{icon}</View>
      <Text style={styles.quickLabel}>{label}</Text>
    </PressableScale>
  );
}

function JourneyStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.journeyMetricItem}>
      <View style={styles.journeyStatLabelRow}>
        {icon}
        <Text style={styles.metricItemLabel}>{label}</Text>
      </View>
      <Text style={styles.metricItemValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricFooter: {
    marginTop: spacing.sm,
    alignItems: 'flex-start',
  },
  metricFooterHint: {
    marginTop: spacing.sm,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  headerText: {
    flex: 1,
  },
  greetingEyebrow: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  streakValue: {
    color: colors.warning,
    fontWeight: '800',
    fontSize: 16,
  },
  weekCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weekTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  weekCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  weekCountStrong: {
    color: colors.primaryLight,
    fontWeight: '800',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  dayLabelToday: {
    color: colors.primaryLight,
  },
  dayDot: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotActive: {
    backgroundColor: colors.primaryLight,
  },
  dayDotToday: {
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySurface,
  },
  dayNum: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  dayNumToday: {
    color: colors.primaryLight,
  },
  heroCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  ringValue: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  ringLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  macroCol: {
    flex: 1,
    gap: spacing.md,
  },
  macroItem: {
    gap: 6,
  },
  macroTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  macroValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  macroTarget: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  heroFooterText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    letterSpacing: -0.3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionAction: {
    fontSize: 13,
    color: colors.primaryLight,
    fontWeight: '700',
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
    marginBottom: spacing.md,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  workoutIconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutIconDone: {
    backgroundColor: colors.primaryLight,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  workoutDetails: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
  },
  chevronCircle: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginTop: spacing.md,
  },
  exerciseChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.full,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    maxWidth: '60%',
  },
  exerciseChipText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  exerciseChipMore: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderGlow,
  },
  exerciseChipMoreText: {
    fontSize: 12,
    color: colors.primaryLight,
    fontWeight: '800',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  journeyCard: {
    padding: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  journeyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  programProgress: {
    marginTop: spacing.md,
    gap: spacing.xs + 2,
  },
  programProgressText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  journeyDayText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  programPct: {
    fontSize: 13,
    color: colors.primaryLight,
    fontWeight: '800',
  },
  insightBox: {
    flexDirection: 'row',
    backgroundColor: colors.primarySurface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 19,
    fontWeight: '500',
  },
  journeyMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  journeyMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  journeyStatLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  metricItemLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  metricItemValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  journeyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  journeyFooterText: {
    fontSize: 12,
    color: colors.primaryLight,
    fontWeight: '600',
  },
  prScrollOuter: {
    marginHorizontal: -spacing.lg,
  },
  prScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  prCard: {
    width: 160,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  prIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  prExercise: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    minHeight: 34,
  },
  prWeight: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  prUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  prSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
});
