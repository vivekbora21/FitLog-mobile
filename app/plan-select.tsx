import React, { useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { ChevronLeft, Pencil, Play } from 'lucide-react-native';
import { ApiError, api, extractErrorMessage } from '../src/api/client';
import { Button, ProgressBar, SheetScreen } from '../src/components/ui';
import { spacing, makeStyles, useTheme } from '../src/theme';
import { calculateAge, parseNumberInput } from '../src/lib/format';
import { haptics } from '../src/lib/haptics';
import { useAuth } from '../src/providers/auth';
import type { CreatePlanPayload } from '../src/types';
import {
  AboutYouStep,
  DEFAULT_DURATION_DAYS_BY_MODE,
  GoalStep,
  MAX_PLAN_DAYS,
  MIN_PLAN_DAYS,
  ReviewStep,
  ScheduleStep,
  TrainingStyleStep,
  buildPreviewPayload,
  defaultPlanWizardState,
  gateFromQuery,
  usePlanPreview,
  MODE_CARD_BY_MODE,
  type BuilderMode,
  type PlanWizardState,
} from '../src/components/plan-wizard';

const STEP_COUNT = 5;

export default function PlanSelectScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const profile = user?.profile;

  const planQuery = useQuery({ queryKey: ['workoutPlan'], queryFn: () => api.getWorkoutPlan() });
  const hasActivePlan = !!planQuery.data?.program;

  const [step, setStep] = useState(0);
  const [rawState, setRawState] = useState<PlanWizardState>(() => defaultPlanWizardState());

  const patch = (p: Partial<PlanWizardState>) => setRawState((prev) => ({ ...prev, ...p }));

  const safeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  // Profile fields prefill the wizard but never fight the user's own edits:
  // derived at render time (not copied into state via an effect) so a field
  // the user has touched always wins, and a profile that finishes loading
  // after mount still fills in anything still blank.
  const state: PlanWizardState = useMemo(() => {
    if (!profile) return rawState;
    return {
      ...rawState,
      sex: rawState.sex || ((profile.sex as 'MALE' | 'FEMALE') || null),
      currentWeight: rawState.currentWeight || (profile.weight_kg != null ? String(profile.weight_kg) : ''),
      height: rawState.height || (profile.height_cm != null ? String(profile.height_cm) : ''),
      age: rawState.age || (() => {
        const a = calculateAge(profile.date_of_birth);
        return a != null ? String(a) : '';
      })(),
    };
  }, [rawState, profile]);

  const blueprintsQuery = useQuery({ queryKey: ['blueprints'], queryFn: () => api.getBlueprints() });
  const splitsQuery = useQuery({ queryKey: ['trainingSplits'], queryFn: () => api.getTrainingSplits() });

  // Spec v1.6 section 7.4: one debounced preview query backs the live pace
  // line (About you), the schedule warnings (Your schedule), the split
  // recommendation / V-21 handling (Training style) and the review screen,
  // so every screen and the saved plan always agree (acceptance 11.4).
  const preview = usePlanPreview(state);

  const currentBlueprint = useMemo(
    () => blueprintsQuery.data?.blueprints.find((b) => b.mode === state.mode) ?? null,
    [blueprintsQuery.data, state.mode]
  );

  const candidateSplits = useMemo(
    () => (splitsQuery.data?.splits ?? []).filter((s) => s.days_per_week === state.daysPerWeek),
    [splitsQuery.data, state.daysPerWeek]
  );
  const recommendedSplitSlug = useMemo(() => {
    const defaultSlug = currentBlueprint?.default_training_split_slug;
    if (defaultSlug && candidateSplits.some((s) => s.slug === defaultSlug)) return defaultSlug;
    return candidateSplits[0]?.slug ?? null;
  }, [currentBlueprint, candidateSplits]);

  // D3 + spec 4.10: the Goal screen is the only entry point; changing the
  // goal later re-applies the mode's own defaults (duration, if the user
  // hasn't edited it; recomp direction) and keeps everything else, per the
  // "changing mode" table in section 4.10. Goal weight is kept but
  // re-validated by the engine for the new mode (surfaces as a block
  // message, e.g. GOAL_DIRECTION_INVALID, until the user fixes it).
  const onChangeMode = (mode: BuilderMode) => {
    setRawState((prev) => {
      const next: PlanWizardState = { ...prev, mode };
      if (!prev.durationEdited) {
        next.durationDays = String(DEFAULT_DURATION_DAYS_BY_MODE[mode]);
      }
      if (mode === 'RECOMP') {
        const goal = parseNumberInput(prev.goalWeight);
        const weight = parseNumberInput(prev.currentWeight);
        if (goal != null && weight != null) {
          next.recompDirection = goal < weight - 1 ? 'lean_out' : goal > weight + 1 ? 'lean_gain' : 'maintain';
        } else if (!prev.recompDirection) {
          next.recompDirection = 'lean_out';
        }
      }
      return next;
    });
  };

  const onExtendDuration = (days: number) => {
    haptics.selection();
    patch({ durationDays: String(days), durationEdited: true });
  };

  const buildSavePayload = (): CreatePlanPayload | null => {
    const payload = buildPreviewPayload(state);
    return payload;
  };

  const startMutation = useMutation({
    mutationFn: () => api.createPlan(buildSavePayload() as CreatePlanPayload),
    onSuccess: async () => {
      haptics.success();
      await Promise.all([queryClient.invalidateQueries(), refreshUser()]);
      safeBack();
    },
    onError: (err) => {
      haptics.error();
      if (err instanceof ApiError && err.data && (err.data as any).code === 'NO_SUPPORTED_SPLIT') {
        Alert.alert('No approved split for this setup', (err.data as any).detail || extractErrorMessage(err));
        setStep(3);
        return;
      }
      Alert.alert("Couldn't start plan", extractErrorMessage(err));
    },
  });

  const submit = () => {
    if (!hasActivePlan) {
      startMutation.mutate();
      return;
    }
    Alert.alert(
      'Switch plan?',
      'Your current plan will be archived. Workouts, weigh-ins and records are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start new plan', onPress: () => startMutation.mutate() },
      ]
    );
  };

  const goBackStep = () => {
    haptics.selection();
    if (step === 0) {
      safeBack();
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) {
        setStep((s) => Math.max(0, s - 1));
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  // Every step's gate (spec v1.6 section 8: "a disabled Continue shows the
  // reason beneath it" -- defect #7). Local reasons are presence-only; every
  // semantic rule comes from the engine via the shared preview query
  // (section 5: "the frontend never blocks on its own rules").
  const gate = useMemo(() => {
    if (step === 0) {
      return { canAdvance: !!state.mode, reason: state.mode ? null : 'Choose a goal to continue.' };
    }
    if (step === 1) {
      if (!state.sex) return { canAdvance: false, reason: 'Select your sex to continue.' };
      if (!state.age) return { canAdvance: false, reason: 'Enter your age to continue.' };
      if (!state.height) return { canAdvance: false, reason: 'Enter your height to continue.' };
      if (!state.currentWeight) return { canAdvance: false, reason: 'Enter your current weight to continue.' };
      return gateFromQuery(null, preview);
    }
    if (step === 2) {
      if (state.weekdays.length !== state.daysPerWeek) {
        return {
          canAdvance: false,
          reason: `Pick ${state.daysPerWeek} training day${state.daysPerWeek === 1 ? '' : 's'} (${state.weekdays.length} selected).`,
        };
      }
      const duration = parseNumberInput(state.durationDays);
      if (!duration || duration < MIN_PLAN_DAYS || duration > MAX_PLAN_DAYS) {
        return { canAdvance: false, reason: `Plan length must be between ${MIN_PLAN_DAYS} and ${MAX_PLAN_DAYS} days.` };
      }
      if (!state.experience) return { canAdvance: false, reason: 'Select your experience to continue.' };
      if (!state.equipment) return { canAdvance: false, reason: 'Select your equipment to continue.' };
      return gateFromQuery(null, preview);
    }
    if (step === 3) {
      return gateFromQuery(null, preview);
    }
    return gateFromQuery(null, preview);
  }, [step, state, preview]);

  const goNext = () => {
    if (!gate.canAdvance) {
      haptics.error();
      return;
    }
    if (step < STEP_COUNT - 1) {
      haptics.selection();
      setStep((s) => s + 1);
      return;
    }
    submit();
  };

  const modeLabel = state.mode ? MODE_CARD_BY_MODE[state.mode].subtitle : null;

  const summaryText =
    step >= 2 && modeLabel
      ? `${modeLabel} · ${state.durationDays || '—'} days · ${state.daysPerWeek} days/wk`
      : null;

  const footer =
    step === STEP_COUNT - 1 ? (
      <View style={styles.footerCol}>
        {!gate.canAdvance && gate.reason ? <Text style={styles.reasonText}>{gate.reason}</Text> : null}
        <View style={styles.footerRow}>
          <Button
            title="Edit"
            variant="secondary"
            size="lg"
            icon={<Pencil size={16} color={colors.textPrimary} />}
            iconPosition="left"
            onPress={() => setStep(3)}
            style={styles.editBtn}
          />
          <Button
            title="Start this plan"
            size="lg"
            icon={<Play size={18} color="#FFFFFF" />}
            iconPosition="left"
            loading={startMutation.isPending}
            disabled={!gate.canAdvance}
            onPress={submit}
            style={styles.flex}
          />
        </View>
      </View>
    ) : (
      <View style={styles.footerCol}>
        {summaryText ? <Text style={styles.summaryText}>{summaryText}</Text> : null}
        {!gate.canAdvance && gate.reason ? <Text style={styles.reasonText}>{gate.reason}</Text> : null}
        <View style={styles.footerRow}>
          {step > 0 ? (
            <Button
              title="Back"
              variant="secondary"
              size="lg"
              onPress={goBackStep}
              icon={<ChevronLeft size={18} color={colors.textPrimary} />}
              iconPosition="left"
              style={styles.backBtn}
            />
          ) : null}
          <Button title="Continue" size="lg" onPress={goNext} disabled={!gate.canAdvance} style={styles.flex} />
        </View>
      </View>
    );

  return (
    <SheetScreen title="Build your plan" subtitle={`Step ${step + 1} of ${STEP_COUNT}`} onClose={safeBack} footer={footer}>
      <ProgressBar percentage={((step + 1) / STEP_COUNT) * 100} style={styles.progress} />

      {step === 0 ? (
        <Animated.View key="step-0" entering={FadeInRight.duration(300).springify().damping(15)}>
          <GoalStep value={state.mode} onChange={onChangeMode} />
        </Animated.View>
      ) : null}

      {step === 1 ? (
        <Animated.View key="step-1" entering={FadeInRight.duration(300).springify().damping(15)}>
          <AboutYouStep state={state} onChange={patch} preview={preview} onExtendDuration={onExtendDuration} />
        </Animated.View>
      ) : null}

      {step === 2 ? (
        <Animated.View key="step-2" entering={FadeInRight.duration(300).springify().damping(15)}>
          <ScheduleStep state={state} onChange={patch} preview={preview} />
        </Animated.View>
      ) : null}

      {step === 3 ? (
        <Animated.View key="step-3" entering={FadeInRight.duration(300).springify().damping(15)}>
          <TrainingStyleStep
            state={state}
            onChange={patch}
            splits={candidateSplits}
            isLoading={splitsQuery.isLoading}
            isError={splitsQuery.isError}
            onRetry={() => splitsQuery.refetch()}
            recommendedSlug={recommendedSplitSlug}
            preview={preview}
          />
        </Animated.View>
      ) : null}

      {step === 4 ? (
        <Animated.View key="step-4" entering={FadeInRight.duration(300).springify().damping(15)}>
          <ReviewStep state={state} preview={preview} onRetry={() => preview.refetch()} />
        </Animated.View>
      ) : null}

      {step === 0 && hasActivePlan ? (
        <Text style={styles.note}>
          Switching plans archives your previous journey. Your workouts, weigh-ins and records stay in your history.
        </Text>
      ) : null}
    </SheetScreen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  progress: {
    marginBottom: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  footerCol: {
    gap: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  backBtn: {
    paddingHorizontal: spacing.md,
  },
  editBtn: {
    paddingHorizontal: spacing.lg,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.error,
    textAlign: 'center',
  },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: spacing.lg,
  },
}));
