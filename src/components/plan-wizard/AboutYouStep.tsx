import React from 'react';
import { View, Text } from 'react-native';
import { Ruler, Scale, User } from 'lucide-react-native';
import { ChipGroup, Input, Button } from '../ui';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { isNoSupportedSplitResult, type PlanPreviewResult } from '../../types';
import { MIN_BUILDER_AGE, RECOMP_DIRECTION_OPTIONS, SEX_OPTIONS } from './constants';
import { blockMessages, extendToDaysFrom, infoMessages, messageText, warnMessages } from './messageCopy';
import type { PlanWizardState } from './types';

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
}

/** Step 2 "About you" (spec v1.6 section 8.2). */
export function AboutYouStep({ state, onChange, preview, onExtendDuration }: AboutYouStepProps) {
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

  return (
    <View>
      <Text style={styles.heading}>About you</Text>
      <Text style={styles.body}>We use this to work out your baseline calories and a sensible pace.</Text>

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
        />
        <Input
          label="Height (cm)"
          keyboardType="decimal-pad"
          value={state.height}
          onChangeText={(v) => onChange({ height: v })}
          leftIcon={<Ruler size={18} color={colors.textSecondary} />}
          containerStyle={styles.half}
        />
      </View>

      <View style={styles.row}>
        <Input
          label="Current weight (kg)"
          keyboardType="decimal-pad"
          value={state.currentWeight}
          onChangeText={(v) => onChange({ currentWeight: v })}
          leftIcon={<Scale size={18} color={colors.primaryLight} />}
          containerStyle={styles.half}
        />
        {mode !== 'FOCUS' ? (
          <Input
            label={needsGoalWeight ? 'Goal weight (kg)' : 'Goal weight (kg) · optional'}
            keyboardType="decimal-pad"
            value={state.goalWeight}
            onChangeText={(v) => onChange({ goalWeight: v })}
            leftIcon={<Scale size={18} color={colors.primaryLight} />}
            containerStyle={styles.half}
            hint={!needsGoalWeight ? 'Only used to suggest a direction below' : undefined}
          />
        ) : (
          <View style={styles.half} />
        )}
      </View>

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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
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
