import React, { useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { Info } from 'lucide-react-native';
import { Badge, ErrorState, PressableScale, Skeleton } from '../ui';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { isNoSupportedSplitResult, type PlanDayRoadmap, type PlanPreviewResult } from '../../types';
import { blockMessages, infoMessages, messageText, warnMessages } from './messageCopy';
import type { PlanWizardState } from './types';
import { MODE_CARD_BY_MODE } from './constants';

interface ReviewStepProps {
  state: PlanWizardState;
  preview: {
    data?: PlanPreviewResult;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
  };
  onRetry: () => void;
}

function formatRest(seconds: number): string {
  if (seconds >= 60) return `rest ${Math.round(seconds / 60)} min`;
  return `rest ${seconds}s`;
}

function paceZoneLabel(status: string): string {
  if (status === 'gentle') return 'Gentle';
  if (status === 'aggressive') return 'Aggressive';
  if (status === 'typical') return 'Typical';
  return '—';
}

/** Step 5 "Review and start" (spec v1.6 section 8.5). */
export function ReviewStep({ state, preview, onRetry }: ReviewStepProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [rpeHintOpen, setRpeHintOpen] = useState(false);

  if (preview.isLoading || (!preview.data && preview.isFetching)) {
    return (
      <View>
        <Skeleton width="70%" height={16} />
        <Skeleton width="50%" height={28} style={styles.skeletonSpacing} />
        <Skeleton height={64} borderRadius={radius.lg} style={styles.skeletonSpacing} />
        <Skeleton height={220} borderRadius={radius.lg} style={styles.skeletonSpacing} />
      </View>
    );
  }

  if (preview.isError || !preview.data) {
    return <ErrorState message="Couldn't build your plan preview." onRetry={onRetry} />;
  }

  if (isNoSupportedSplitResult(preview.data)) {
    return (
      <ErrorState
        message="No approved training split for this combination yet. Go back to Training style to pick another."
        onRetry={onRetry}
      />
    );
  }

  const roadmap = preview.data;
  const { summary, phases, days, meal_template, targets, engine } = roadmap;
  const modeLabel = state.mode ? MODE_CARD_BY_MODE[state.mode].subtitle : '';
  const isCalorieProjected = engine.precision === 'calorie_projected';
  const estimatedChange =
    isCalorieProjected && summary.goal_weight_kg != null
      ? summary.goal_weight_kg - summary.start_weight_kg
      : null;

  const blocks = blockMessages(engine.messages);
  const warns = warnMessages(engine.messages);
  const infos = infoMessages(engine.messages);
  const trainingDays = days.filter((d) => !d.is_rest);

  const whyThisPlan = buildWhyThisPlan(modeLabel, summary, engine);

  return (
    <View>
      <Text style={styles.heading}>Review and start</Text>

      <View style={styles.statGrid}>
        <StatTile label="Duration" value={`${summary.duration_days} days`} />
        <StatTile label="Days/week" value={`${summary.workouts_per_week}×`} />
        <StatTile
          label="Estimated weight change"
          value={estimatedChange != null ? `${estimatedChange > 0 ? '+' : ''}${estimatedChange.toFixed(1)} kg` : 'Not targeted'}
        />
        <StatTile label="Daily calories" value={`${summary.daily_calories} kcal`} />
      </View>

      <View style={styles.whyBox}>
        <Text style={styles.whyLabel}>Why this plan?</Text>
        <Text style={styles.whyText}>{whyThisPlan}</Text>
      </View>

      {isCalorieProjected ? (
        <View style={styles.paceBarSection}>
          <Text style={styles.sectionLabel}>Pace</Text>
          <View style={styles.paceBarRow}>
            {(['gentle', 'typical', 'aggressive'] as const).map((zone) => (
              <View
                key={zone}
                style={[
                  styles.paceZone,
                  engine.pace_status === zone && styles.paceZoneActive,
                  zone === 'typical' && styles.paceZoneTypical,
                ]}
              />
            ))}
          </View>
          <Text style={styles.paceCaption}>
            {paceZoneLabel(engine.pace_status)}
            {engine.predicted_weekly_change_kg != null
              ? ` — about ${Math.abs(engine.predicted_weekly_change_kg).toFixed(2)} kg/week`
              : ''}
          </Text>
          <Text style={styles.paceMeta}>
            This is a starting estimate. People with the same training schedule can burn quite different amounts.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Calories & macros</Text>
      <View style={styles.targetsRow}>
        <TargetsCard title="Training day" targets={targets.training_day} />
        <TargetsCard title="Rest day" targets={targets.rest_day} />
      </View>
      <Text style={styles.estimateNote}>
        Your calorie target is a starting estimate. Adjust after 2-3 weeks of weigh-ins.
      </Text>
      <Text style={styles.estimateNote}>
        Target editing isn&apos;t available in this build yet — your plan starts with the suggested values above.
      </Text>

      {blocks.length > 0 ? (
        <View style={[styles.messageBox, styles.messageBoxBlock]}>
          {blocks.map((m, idx) => (
            <Text key={idx} style={styles.messageText}>
              {messageText(m)}
            </Text>
          ))}
        </View>
      ) : null}
      {[...warns, ...infos].map((m, idx) => (
        <View key={`${m.code}-${idx}`} style={styles.messageBox}>
          <Text style={styles.messageText}>{messageText(m)}</Text>
        </View>
      ))}

      <Text style={styles.sectionLabel}>Plan phases</Text>
      <View style={styles.phaseStrip}>
        {phases.map((phase, idx) => {
          const span = phase.end_day - phase.start_day + 1;
          const widthPct = Math.max(8, (span / summary.duration_days) * 100);
          const phaseColors = [colors.primary, colors.primaryLight, colors.surfaceElevated];
          return (
            <View
              key={`${phase.name}-${idx}`}
              style={[styles.phaseSegment, { flexGrow: widthPct, backgroundColor: phaseColors[idx % phaseColors.length] }]}
            />
          );
        })}
      </View>
      {phases.map((phase, idx) => (
        <View key={`${phase.name}-desc-${idx}`} style={styles.phaseDescRow}>
          <Text style={styles.phaseDescName}>
            {phase.name} (Day {phase.start_day}–{phase.end_day})
          </Text>
          <Text style={styles.phaseDescText}>{phase.description}</Text>
        </View>
      ))}

      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>Workouts</Text>
        <PressableScale onPress={() => setRpeHintOpen((v) => !v)} haptic="selection" style={styles.rpeInfoBtn}>
          <Info size={14} color={colors.textMuted} />
          <Text style={styles.rpeInfoText}>What&apos;s RPE?</Text>
        </PressableScale>
      </View>
      {rpeHintOpen ? (
        <Text style={styles.rpeHintText}>RPE 7.5 means about 2-3 reps left in the tank.</Text>
      ) : null}

      <FlatList
        data={buildWorkoutListItems(trainingDays)}
        keyExtractor={(item) => (item.type === 'week' ? `week-${item.week}` : `day-${item.day.day_number}`)}
        renderItem={({ item }) =>
          item.type === 'week' ? (
            <Text style={styles.weekHeader}>Week {item.week}</Text>
          ) : (
            <WorkoutDayCard day={item.day} />
          )
        }
        scrollEnabled={false}
        nestedScrollEnabled
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={<Text style={styles.emptyText}>No training days in this plan.</Text>}
      />

      <Text style={styles.sectionLabel}>Meals</Text>
      {Object.entries(meal_template).map(([slot, meal]) => (
        <View key={slot} style={styles.mealCard}>
          <Text style={styles.mealSlot}>{slot}</Text>
          <Text style={styles.mealMacros}>
            {meal.kcal} kcal · {meal.protein_g}g protein · {meal.fat_g}g fat
          </Text>
          <Text style={styles.mealFoods}>{meal.sample_foods.join(', ')}</Text>
          {meal.swap_options.length > 0 ? <Text style={styles.mealSwaps}>Swap: {meal.swap_options.join(', ')}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function buildWhyThisPlan(
  modeLabel: string,
  summary: { duration_days: number; workouts_per_week: number },
  engine: { precision: string; pace_status: string; calories_clamped: boolean }
): string {
  const parts = [`${modeLabel} over ${summary.duration_days} days, training ${summary.workouts_per_week}×/week.`];
  if (engine.precision === 'calorie_projected') {
    if (engine.pace_status === 'gentle') parts.push('A gentle pace — progress will be gradual.');
    else if (engine.pace_status === 'typical') parts.push('Within the typical range for this goal.');
    else if (engine.pace_status === 'aggressive') parts.push('An aggressive pace — proceed with caution.');
  } else if (engine.precision === 'directional') {
    parts.push('Calories stay close to maintenance; training drives the change.');
  } else {
    parts.push('Calories are set at maintenance — this plan is about performance, not weight.');
  }
  if (engine.calories_clamped) {
    parts.push('Your calorie target was raised to a sensible minimum, which changes the estimated pace.');
  }
  return parts.join(' ');
}

type WorkoutListItem = { type: 'week'; week: number } | { type: 'day'; day: PlanDayRoadmap };

function buildWorkoutListItems(trainingDays: PlanDayRoadmap[]): WorkoutListItem[] {
  const items: WorkoutListItem[] = [];
  let lastWeek = 0;
  for (const day of trainingDays) {
    const week = Math.ceil(day.day_number / 7);
    if (week !== lastWeek) {
      items.push({ type: 'week', week });
      lastWeek = week;
    }
    items.push({ type: 'day', day });
  }
  return items;
}

function WorkoutDayCard({ day }: { day: PlanDayRoadmap }) {
  const styles = useStyles();
  return (
    <View style={styles.dayCard}>
      <Text style={styles.dayLabel}>{day.label}</Text>
      {(day.workout ?? []).map((ex, idx) => (
        <View key={idx} style={styles.exerciseRow}>
          <View style={styles.exerciseNameRow}>
            <Text style={styles.exerciseName}>{ex.exercise_name}</Text>
            {ex.is_cardio ? <Badge label="Cardio" tone="amber" /> : null}
          </View>
          <Text style={styles.exerciseMeta}>
            {ex.sets} × {ex.reps}
            {ex.rpe != null ? ` @RPE ${ex.rpe}` : ''} · {formatRest(ex.rest_seconds)}
          </Text>
          {ex.progression_rule ? <Text style={styles.exerciseRule}>{ex.progression_rule}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TargetsCard({ title, targets }: { title: string; targets: { daily_calories: number; protein_g: number; carbs_g: number; fat_g: number } }) {
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

const useStyles = makeStyles(({ colors }) => ({
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: spacing.md,
  },
  skeletonSpacing: {
    marginTop: spacing.md,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statTile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  whyBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  whyLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  whyText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 19,
  },
  sectionLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rpeInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rpeInfoText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  rpeHintText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  paceBarSection: {
    marginBottom: spacing.md,
  },
  paceBarRow: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.full,
    overflow: 'hidden',
    gap: 2,
  },
  paceZone: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
  },
  paceZoneActive: {
    backgroundColor: colors.primaryLight,
  },
  paceZoneTypical: {
    opacity: 1,
  },
  paceCaption: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  paceMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
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
  estimateNote: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  messageBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  messageBoxBlock: {
    backgroundColor: colors.errorBackground,
    borderColor: colors.errorBorder,
  },
  messageText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
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
  phaseDescRow: {
    marginTop: spacing.sm,
  },
  phaseDescName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  phaseDescText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  weekHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
  dayLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  exerciseRow: {
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
}));
