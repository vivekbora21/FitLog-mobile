import React from 'react';
import { View, Text } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { Badge, ErrorState, PressableScale, Skeleton } from '../ui';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { isNoSupportedSplitResult, type PlanPreviewResult, type TrainingSplit } from '../../types';
import { EQUIPMENT_OPTIONS } from './constants';
import type { PlanWizardState } from './types';

interface TrainingStyleStepProps {
  state: PlanWizardState;
  onChange: (patch: Partial<PlanWizardState>) => void;
  splits: TrainingSplit[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  recommendedSlug: string | null;
  preview: { data?: PlanPreviewResult };
}

const equipmentLabel = (level: string) => EQUIPMENT_OPTIONS.find((o) => o.value === level)?.label ?? level;

/** Step 4 "Training style". The list comes from the server's approved
 * catalog and is already filtered by frequency and equipment. */
export function TrainingStyleStep({
  state,
  onChange,
  splits,
  isLoading,
  isError,
  onRetry,
  recommendedSlug,
  preview,
}: TrainingStyleStepProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  if (isLoading) {
    return (
      <View>
        <Skeleton height={90} borderRadius={radius.lg} style={styles.skeletonSpacing} />
        <Skeleton height={90} borderRadius={radius.lg} style={styles.skeletonSpacing} />
      </View>
    );
  }
  if (isError) {
    return <ErrorState message="Couldn't load training splits." onRetry={onRetry} />;
  }

  const noSupportedSplit = preview.data && isNoSupportedSplitResult(preview.data) ? preview.data : null;
  const others = (splits ?? []).filter((s) => s.slug !== recommendedSlug);
  const recommended = (splits ?? []).find((s) => s.slug === recommendedSlug) ?? null;
  const selectedSlug = state.splitSlug ?? recommendedSlug;

  return (
    <View>
      <Text style={styles.heading}>Training style</Text>
      <Text style={styles.body}>How your weekly volume is organized across {state.daysPerWeek} days a week.</Text>

      {noSupportedSplit ? (
        <View style={styles.blockBox}>
          <Text style={styles.blockTitle}>No approved split for this combination yet</Text>
          <Text style={styles.blockBody}>{noSupportedSplit.detail}</Text>
          <Text style={styles.blockSubtitle}>Try one of these instead:</Text>
          {noSupportedSplit.supported_combinations.map((combo, idx) => (
            <PressableScale
              key={idx}
              haptic="selection"
              onPress={() =>
                onChange({
                  daysPerWeek: combo.days_per_week,
                  equipment: combo.equipment_level,
                  splitSlug: combo.split_slug,
                })
              }
              style={styles.comboChip}
            >
              <Text style={styles.comboChipText}>
                {combo.days_per_week} days/week · {equipmentLabel(combo.equipment_level)}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : (
        <>
          {recommended ? (
            <PressableScale
              haptic="selection"
              scaleTo={0.98}
              onPress={() => onChange({ splitSlug: recommended.slug })}
              style={[styles.card, selectedSlug === recommended.slug && styles.cardSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedSlug === recommended.slug }}
              accessibilityLabel={recommended.name}
            >
              <View style={styles.headerRow}>
                <Text style={styles.name}>{recommended.name}</Text>
                <Badge label={`Recommended for ${state.daysPerWeek} days/week`} tone="emerald" />
              </View>
              <Text style={styles.desc}>{recommended.description}</Text>
              <Text style={styles.meta}>{recommended.estimated_session_minutes} min · {recommended.experience_levels.join(', ').toLowerCase()} · {recommended.muscle_groups.slice(0, 4).join(', ')}</Text>
            </PressableScale>
          ) : (
            <Text style={styles.emptyText}>No training split is available for {state.daysPerWeek} days/week yet.</Text>
          )}

          {others.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>See other options</Text>
              {others.map((split) => {
                const selected = selectedSlug === split.slug;
                return (
                  <PressableScale
                    key={split.slug}
                    haptic="selection"
                    scaleTo={0.98}
                    onPress={() => onChange({ splitSlug: split.slug })}
                    style={[styles.card, selected && styles.cardSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={split.name}
                  >
                    <View style={styles.headerRow}>
                      <Text style={styles.name}>{split.name}</Text>
                      <View style={styles.daysBadge}>
                        <CalendarDays size={12} color={colors.textMuted} />
                        <Text style={styles.daysText}>{split.days_per_week}x/week</Text>
                      </View>
                    </View>
                    <Text style={styles.desc}>{split.description}</Text>
                    <Text style={styles.meta}>{split.estimated_session_minutes} min · {split.experience_levels.join(', ').toLowerCase()}</Text>
                  </PressableScale>
                );
              })}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  skeletonSpacing: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySurface,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  daysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  daysText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  desc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
    lineHeight: 17,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  blockBox: {
    backgroundColor: colors.errorBackground,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  blockBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  blockSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  comboChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  comboChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
}));
