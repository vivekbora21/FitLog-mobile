import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { AlertTriangle, Ruler, Scale, Sparkles, User } from 'lucide-react-native';
import { api } from '../../api/client';
import { ChipGroup, Input, Button, PressableScale } from '../ui';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { isNoSupportedSplitResult, type PlanPreviewResult } from '../../types';
import {
  calculateRecommendedGoalWeight,
  DURATION_PRESETS,
  MAX_PLAN_DAYS,
  MIN_BUILDER_AGE,
  MIN_PLAN_DAYS,
  RECOMP_DIRECTION_OPTIONS,
  SEX_OPTIONS,
} from './constants';
import { blockMessages, extendToDaysFrom, infoMessages, messageText, warnMessages } from './messageCopy';
import type { PlanWizardState } from './types';
import { haptics } from '../../lib/haptics';

interface AboutYouStepProps {
  state: PlanWizardState;
  onChange: (patch: Partial<PlanWizardState>) => void;
  preview: {
    data?: PlanPreviewResult;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
  };
  onExtendDuration: (days: number) => void;
  /** True when the user's profile has no height/date_of_birth on file yet, so the field
   * was filled in fresh here rather than prefilled -- surfaced as a hint that it'll be
   * saved to the profile on plan creation (see `syncMissingProfileFields` in plan-select). */
  heightMissingFromProfile?: boolean;
  ageMissingFromProfile?: boolean;
}

/** Step 2 "About you" (spec v1.6 section 8.2). */
export function AboutYouStep({
  state,
  onChange,
  preview,
  onExtendDuration,
  heightMissingFromProfile,
  ageMissingFromProfile,
}: AboutYouStepProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const mode = state.mode;
  const needsGoalWeight = mode === 'CUT' || mode === 'BULK';
  const roadmap = preview.data && !isNoSupportedSplitResult(preview.data) ? preview.data : null;
  const engine = roadmap?.engine;
  const messages = engine?.messages ?? [];
  const blocks = blockMessages(messages);
  const warns = warnMessages(messages);
  const infos = infoMessages(messages);
  const extendTo = extendToDaysFrom(messages);

  const ageNum = Number(state.age);
  const underage = state.age !== '' && Number.isFinite(ageNum) && ageNum < MIN_BUILDER_AGE;

  const [recommending, setRecommending] = useState(false);
  const durationDays = Number(state.durationDays);
  const isPresetDuration = DURATION_PRESETS.some((duration) => duration.value === durationDays);
  const [showCustomDuration, setShowCustomDuration] = useState(!isPresetDuration);
  const currentWeightNum = Number(state.currentWeight);
  const heightNum = Number(state.height);
  const durationDaysNum = Number(state.durationDays) || 60;
  const canRecommend = mode != null && state.currentWeight !== '' && !isNaN(currentWeightNum) && currentWeightNum > 0 && heightNum > 0;
  const healthyWeightRange = useMemo(() => {
    if (!heightNum || heightNum <= 0) return null;
    const heightM = heightNum / 100;
    return {
      min: Math.round(18.5 * heightM ** 2 * 10) / 10,
      max: Math.round(24.9 * heightM ** 2 * 10) / 10,
    };
  }, [heightNum]);

  const recommendGoalWeight = async () => {
    if (!canRecommend || recommending) return;
    haptics.selection();
    setRecommending(true);

    // Compute locally based on recommended weekly pace formula (same as website & backend)
    const localGoal = calculateRecommendedGoalWeight(mode, currentWeightNum, heightNum, durationDaysNum);

    try {
      const res = await api.recommendGoalWeight({
        mode: mode!,
        current_weight_kg: currentWeightNum,
        height_cm: heightNum,
        duration_days: durationDaysNum,
      });
      if (res?.goal_weight_kg != null) {
        onChange({ goalWeight: String(res.goal_weight_kg) });
      } else {
        onChange({ goalWeight: String(localGoal) });
      }
    } catch (err) {
      console.warn('Backend recommendation error, using formula calculation:', err);
      onChange({ goalWeight: String(localGoal) });
    } finally {
      setRecommending(false);
    }
  };

  const quickPicks = useMemo(() => {
    if (!canRecommend || !currentWeightNum || currentWeightNum <= 0) return [];
    if (mode === 'CUT') {
      return [
        { label: '-3 kg', weight: Math.round((currentWeightNum - 3) * 10) / 10 },
        { label: '-5 kg', weight: Math.round((currentWeightNum - 5) * 10) / 10 },
        { label: '-8 kg', weight: Math.round((currentWeightNum - 8) * 10) / 10 },
      ].filter((p) => p.weight > 30);
    }
    if (mode === 'BULK') {
      return [
        { label: '+2 kg', weight: Math.round((currentWeightNum + 2) * 10) / 10 },
        { label: '+4 kg', weight: Math.round((currentWeightNum + 4) * 10) / 10 },
        { label: '+6 kg', weight: Math.round((currentWeightNum + 6) * 10) / 10 },
      ];
    }
    if (mode === 'RECOMP') {
      return [
        { label: 'Lean out (-1.5kg)', weight: Math.round((currentWeightNum - 1.5) * 10) / 10 },
        { label: 'Maintain (0kg)', weight: Math.round(currentWeightNum * 10) / 10 },
        { label: 'Lean gain (+1.5kg)', weight: Math.round((currentWeightNum + 1.5) * 10) / 10 },
      ];
    }
    return [];
  }, [canRecommend, currentWeightNum, mode]);

  return (
    <View>
      <Text style={styles.heading}>About you</Text>
      <Text style={styles.body}>We use this to work out your baseline calories and a sensible pace.</Text>

      <Text style={styles.sectionLabel}>Plan length</Text>
      <ChipGroup
        options={[...DURATION_PRESETS, { value: 'custom' as const, label: 'Custom' }]}
        value={showCustomDuration || !isPresetDuration ? 'custom' : durationDays}
        onChange={(value) => {
          if (value === 'custom') {
            setShowCustomDuration(true);
            return;
          }
          setShowCustomDuration(false);
          onChange({ durationDays: String(value), durationEdited: true });
        }}
      />
      {showCustomDuration || !isPresetDuration ? (
        <Input
          label={`Custom length (${MIN_PLAN_DAYS}–${MAX_PLAN_DAYS} days)`}
          keyboardType="number-pad"
          value={state.durationDays}
          onChangeText={(value) => onChange({ durationDays: value, durationEdited: true })}
        />
      ) : null}

      <ChipGroup label="Sex" options={SEX_OPTIONS} value={state.sex} onChange={(v) => onChange({ sex: v })} />

      <View style={styles.row}>
        <Input
          label="Age"
          keyboardType="number-pad"
          value={state.age}
          onChangeText={(v) => onChange({ age: v })}
          leftIcon={<User size={18} color={colors.textSecondary} />}
          containerStyle={styles.half}
          error={underage ? `Must be ${MIN_BUILDER_AGE} or older` : undefined}
          hint={!underage && ageMissingFromProfile ? "Not on your profile yet — we'll save it there." : undefined}
        />
        <Input
          label="Height (cm)"
          keyboardType="decimal-pad"
          value={state.height}
          onChangeText={(v) => onChange({ height: v })}
          leftIcon={<Ruler size={18} color={colors.textSecondary} />}
          containerStyle={styles.half}
          hint={heightMissingFromProfile ? "Not on your profile yet — we'll save it there." : undefined}
        />
      </View>

      <Input
        label="Current weight (kg)"
        keyboardType="decimal-pad"
        value={state.currentWeight}
        onChangeText={(v) => onChange({ currentWeight: v })}
        leftIcon={<Scale size={18} color={colors.primaryLight} />}
      />

      {healthyWeightRange ? (
        <View style={styles.healthyRangeBox}>
          <Text style={styles.healthyRangeTitle}>Reference weight range</Text>
          <Text style={styles.healthyRangeText}>
            For {heightNum} cm, age {state.age || '—'}, and {state.sex === 'MALE' ? 'male' : state.sex === 'FEMALE' ? 'female' : 'your'} profile data, the standard adult BMI screening range (18.5–24.9) is approximately{' '}
            <Text style={styles.healthyRangeEmphasis}>{healthyWeightRange.min}–{healthyWeightRange.max} kg</Text>.
          </Text>
          {(currentWeightNum < healthyWeightRange.min || currentWeightNum > healthyWeightRange.max) ? (
            <View style={styles.rangeWarningRow}>
              <AlertTriangle size={14} color={colors.error} />
              <Text style={styles.rangeWarningText}>Current weight is outside this reference range.</Text>
            </View>
          ) : null}
          {Number(state.goalWeight) > 0 && (Number(state.goalWeight) < healthyWeightRange.min || Number(state.goalWeight) > healthyWeightRange.max) ? (
            <View style={styles.rangeWarningRow}>
              <AlertTriangle size={14} color={colors.error} />
              <Text style={styles.rangeWarningText}>Goal weight is outside this reference range.</Text>
            </View>
          ) : null}
          <Text style={styles.healthyRangeHint}>BMI is a screening estimate; it does not account for muscle mass or individual medical factors.</Text>
        </View>
      ) : null}

      {mode !== 'FOCUS' ? (
        <View style={styles.goalSection}>
          <Text style={styles.goalLabel}>
            {needsGoalWeight ? 'Goal weight (kg)' : 'Goal weight (kg) · optional'}
          </Text>
          <View style={styles.goalRow}>
            <View style={styles.goalInputWrap}>
              <Input
                keyboardType="decimal-pad"
                value={state.goalWeight}
                onChangeText={(v) => onChange({ goalWeight: v })}
                leftIcon={<Scale size={18} color={colors.primaryLight} />}
                placeholder="Enter goal or tap recommend"
                containerStyle={styles.goalInputNoMargin}
                hint={!needsGoalWeight ? 'Only used to suggest a direction below' : undefined}
              />
            </View>
            <Button
              title={recommending ? 'Calculating…' : 'Recommend'}
              variant="secondary"
              size="md"
              icon={<Sparkles size={14} color={colors.primary} />}
              iconPosition="left"
              loading={recommending}
              disabled={!canRecommend}
              onPress={recommendGoalWeight}
              style={styles.recommendBesideBtn}
            />
          </View>

          {quickPicks.length > 0 ? (
            <View style={styles.quickPicksContainer}>
              <Text style={styles.quickPicksHeader}>Quick select:</Text>
              <View style={styles.quickPicksRow}>
                {quickPicks.map((pick) => {
                  const isSelected = state.goalWeight === String(pick.weight);
                  return (
                    <PressableScale
                      key={pick.label}
                      onPress={() => {
                        haptics.selection();
                        onChange({ goalWeight: String(pick.weight) });
                      }}
                      style={[
                        styles.quickPickChip,
                        isSelected && styles.quickPickChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickPickText,
                          isSelected && styles.quickPickTextSelected,
                        ]}
                      >
                        {pick.label} ({pick.weight} kg)
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {mode === 'RECOMP' ? (
        <ChipGroup
          label="Direction"
          options={RECOMP_DIRECTION_OPTIONS}
          value={state.recompDirection}
          onChange={(v) => onChange({ recompDirection: v })}
        />
      ) : null}

      {/* Live pace line (Cut/Bulk only) -- spec 8.2: "Estimated: -4.3 kg in 60 days,
          about 0.50 kg/week. Within the typical range." Built only from fields the
          API actually returns (engine.predicted_weekly_change_kg, engine.pace_status) --
          never recomputed in TypeScript (working rule 2). */}
      {needsGoalWeight && engine && engine.precision === 'calorie_projected' ? (
        <View style={styles.paceBox}>
          <Text style={styles.paceLine}>
            Goal: {state.currentWeight || '—'} kg → {state.goalWeight || '—'} kg over {state.durationDays || '—'} days
          </Text>
          {engine.predicted_weekly_change_kg != null ? (
            <Text style={styles.paceLine}>
              Estimated pace: about {Math.abs(engine.predicted_weekly_change_kg).toFixed(2)} kg/week —{' '}
              {paceStatusPhrase(engine.pace_status)}
            </Text>
          ) : null}
          <Text style={styles.paceMeta}>
            This is a starting estimate. People on the same schedule can burn quite different amounts.
          </Text>
        </View>
      ) : null}

      {mode === 'RECOMP' && engine && engine.target_calories != null ? (
        <Text style={styles.directionalNote}>
          About {engine.target_calories} kcal/day. Scale weight may barely move — track strength and measurements
          instead.
        </Text>
      ) : null}

      {mode === 'FOCUS' && engine && engine.target_calories != null ? (
        <Text style={styles.directionalNote}>
          About {engine.target_calories} kcal/day (maintenance). No weight target — this plan is about performance.
        </Text>
      ) : null}

      {[...blocks, ...warns, ...infos].map((m, idx) => (
        <View key={`${m.code}-${idx}`} style={[styles.messageBox, m.severity === 'block' && styles.messageBoxBlock]}>
          <Text style={styles.messageText}>{messageText(m)}</Text>
          {extendTo != null && (m.code === 'PACE_ABOVE_LIMIT' || m.code === 'PACE_AGGRESSIVE') ? (
            <Button
              title={`Extend to ${extendTo} days`}
              variant="secondary"
              size="sm"
              onPress={() => onExtendDuration(extendTo)}
              style={styles.extendBtn}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function paceStatusPhrase(status: string): string {
  if (status === 'gentle') return 'a gentle pace. Progress will be gradual.';
  if (status === 'aggressive') return 'an aggressive pace.';
  if (status === 'typical') return 'within the typical range.';
  return 'an estimate.';
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
  sectionLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  goalSection: {
    marginBottom: spacing.lg,
  },
  goalLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs + 2,
    letterSpacing: 0.2,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  goalInputWrap: {
    flex: 1,
  },
  goalInputNoMargin: {
    marginBottom: 0,
  },
  recommendBesideBtn: {
    height: 50,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  quickPicksContainer: {
    marginTop: spacing.sm,
  },
  quickPicksHeader: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickPicksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quickPickChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  quickPickChipSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySurface,
  },
  quickPickText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  quickPickTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  paceBox: {
    backgroundColor: colors.primarySurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  paceLine: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  paceMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  directionalNote: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  healthyRangeBox: {
    backgroundColor: colors.primarySurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  healthyRangeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  healthyRangeText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  healthyRangeEmphasis: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  rangeWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rangeWarningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.error,
  },
  healthyRangeHint: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  messageBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
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
  extendBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
}));
