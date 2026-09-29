import React, { useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { Badge, ChipGroup, ErrorState, Skeleton } from '../ui';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
// (colors are read via useTheme() in the component; the styles factory below stays theme-only)
import type { FeasibilityStatus, PlanDayRoadmap, PlanRoadmap } from '../../types';

type Tab = 'workouts' | 'meals' | 'targets';

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: 'workouts', label: 'Workouts' },
  { value: 'meals', label: 'Meals' },
  { value: 'targets', label: 'Targets' },
];

const FEASIBILITY_TONE: Record<FeasibilityStatus, 'emerald' | 'amber' | 'rose'> = {
  safe: 'emerald',
  aggressive: 'amber',
  unrealistic: 'rose',
};

interface RoadmapPreviewProps {
  roadmap: PlanRoadmap | null | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
}

/** Step 3: full roadmap preview — summary, feasibility, phase timeline, and Workouts/Meals/Targets tabs. */
export function RoadmapPreview({ roadmap, isLoading, isError, errorMessage, onRetry }: RoadmapPreviewProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('workouts');
  const phaseColors = [colors.primary, colors.primaryLight, colors.surfaceElevated];

  if (isLoading) {
    return (
      <View>
        <Skeleton width="70%" height={16} />
        <Skeleton width="50%" height={28} style={styles.skeletonSpacing} />
        <Skeleton height={64} borderRadius={radius.lg} style={styles.skeletonSpacing} />
        <Skeleton height={220} borderRadius={radius.lg} style={styles.skeletonSpacing} />
      </View>
    );
  }

  if (isError || !roadmap) {
    return <ErrorState message={errorMessage || "Couldn't build your plan preview."} onRetry={onRetry} />;
  }

  const { summary, feasibility, phases, days, meal_template, targets } = roadmap;
  const goalWeight = summary.goal_weight_kg ?? summary.start_weight_kg;
  const totalDays = summary.duration_days || 1;
  const trainingDays = days.filter((d) => !d.is_rest);

  return (
    <View>
      <Text style={styles.summaryLine}>
        {summary.duration_days} days · {summary.workouts_per_week} workouts/week · {summary.start_weight_kg} →{' '}
        {goalWeight} kg · {summary.daily_calories} kcal/day
      </Text>

      <View style={styles.feasibilityRow}>
        <Badge label={feasibility.status} tone={FEASIBILITY_TONE[feasibility.status]} />
      </View>
      <Text style={styles.feasibilityMessage}>{feasibility.message}</Text>

      {roadmap.warnings.length > 0 ? (
        <View style={styles.warningsBox}>
          {roadmap.warnings.map((w, idx) => (
            <Text key={idx} style={styles.warningText}>
              • {w}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Plan phases</Text>
      <View style={styles.phaseStrip}>
        {phases.map((phase, idx) => {
          const span = phase.end_day - phase.start_day + 1;
          const widthPct = Math.max(8, (span / totalDays) * 100);
          const color = phaseColors[idx % phaseColors.length];
          return (
            <View
              key={`${phase.name}-${idx}`}
              style={[styles.phaseSegment, { flexGrow: widthPct, backgroundColor: color }]}
            />
          );
        })}
      </View>
      <View style={styles.phaseLabelsRow}>
        {phases.map((phase, idx) => (
          <View key={`${phase.name}-label-${idx}`} style={styles.phaseLabelCol}>
            <Text style={styles.phaseLabelName} numberOfLines={1}>
              {phase.name}
            </Text>
            <Text style={styles.phaseLabelRange}>
              Day {phase.start_day}–{phase.end_day}
            </Text>
          </View>
        ))}
      </View>

      <ChipGroup options={TAB_OPTIONS} value={tab} onChange={setTab} />

      {tab === 'workouts' ? (
        <FlatList
          data={trainingDays}
          keyExtractor={(item) => String(item.day_number)}
          renderItem={({ item }) => <WorkoutDayCard day={item} />}
          scrollEnabled={false}
          nestedScrollEnabled
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={<Text style={styles.emptyText}>No training days in this plan.</Text>}
        />
      ) : null}

      {tab === 'meals' ? (
        <View>
          {Object.entries(meal_template).map(([slot, meal]) => (
            <View key={slot} style={styles.mealCard}>
              <Text style={styles.mealSlot}>{slot}</Text>
              <Text style={styles.mealMacros}>
                {meal.kcal} kcal · {meal.protein_g}g protein · {meal.fat_g}g fat
              </Text>
              <Text style={styles.mealFoods}>{meal.sample_foods.join(', ')}</Text>
              {meal.swap_options.length > 0 ? (
                <Text style={styles.mealSwaps}>Swap: {meal.swap_options.join(', ')}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {tab === 'targets' ? (
        <View style={styles.targetsRow}>
          <TargetsCard title="Training day" targets={targets.training_day} />
          <TargetsCard title="Rest day" targets={targets.rest_day} />
        </View>
      ) : null}
    </View>
  );
}

function WorkoutDayCard({ day }: { day: PlanDayRoadmap }) {
  const styles = useStyles();
  return (
    <View style={styles.dayCard}>
      <View style={styles.dayHeaderRow}>
        <Text style={styles.dayNumber}>Day {day.day_number}</Text>
        <Text style={styles.dayPhase}>{day.phase}</Text>
      </View>
      {(day.workout ?? []).map((ex, idx) => (
        <View key={idx} style={styles.exerciseRow}>
          <Text style={styles.exerciseName}>{ex.exercise_name}</Text>
          <Text style={styles.exerciseMeta}>
            {ex.sets} × {ex.reps}
            {ex.rpe != null ? ` @RPE ${ex.rpe}` : ''} · rest {ex.rest_seconds}s
          </Text>
          {ex.progression_rule ? <Text style={styles.exerciseRule}>{ex.progression_rule}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function TargetsCard({ title, targets }: { title: string; targets: PlanRoadmap['targets']['training_day'] }) {
  const styles = useStyles();
  return (
    <View style={styles.targetsCard}>
      <Text style={styles.targetsTitle}>{title}</Text>
      <TargetRow label="Calories" value={`${targets.daily_calories} kcal`} />
      <TargetRow label="Protein" value={`${targets.protein_g} g`} />
      <TargetRow label="Carbs" value={`${targets.carbs_g} g`} />
      <TargetRow label="Fat" value={`${targets.fat_g} g`} />
    </View>
  );
}

function TargetRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.targetRow}>
      <Text style={styles.targetLabel}>{label}</Text>
      <Text style={styles.targetValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => {
  return {
    skeletonSpacing: {
      marginTop: spacing.md,
    },
    summaryLine: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: 21,
      marginBottom: spacing.md,
    },
    feasibilityRow: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    feasibilityMessage: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: spacing.md,
    },
    warningsBox: {
      backgroundColor: colors.errorBackground,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    warningText: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: spacing.xs + 2,
      letterSpacing: 0.2,
    },
    phaseStrip: {
      flexDirection: 'row',
      height: 10,
      borderRadius: radius.full,
      overflow: 'hidden',
      gap: 2,
    },
    phaseSegment: {
      height: '100%',
    },
    phaseLabelsRow: {
      flexDirection: 'row',
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },
    phaseLabelCol: {
      flex: 1,
      paddingRight: spacing.xs,
    },
    phaseLabelName: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    phaseLabelRange: {
      fontSize: 10,
      color: colors.textMuted,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    dayCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    dayHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    dayNumber: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    dayPhase: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    exerciseRow: {
      paddingVertical: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    exerciseName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    exerciseMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    exerciseRule: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      fontStyle: 'italic',
    },
    mealCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    mealSlot: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
      textTransform: 'capitalize',
    },
    mealMacros: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryLight,
      marginTop: 2,
    },
    mealFoods: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: spacing.xs,
      lineHeight: 18,
    },
    mealSwaps: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    targetsRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    targetsCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    targetsTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    targetRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    targetLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    targetValue: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
  };
});
