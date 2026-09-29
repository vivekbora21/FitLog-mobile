import React, { useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { ChevronLeft, Pencil, Play } from 'lucide-react-native';
import { api, extractErrorMessage } from '../src/api/client';
import { Button, ProgressBar, SheetScreen } from '../src/components/ui';
import { spacing, makeStyles, useTheme } from '../src/theme';
import { calculateAge, parseNumberInput } from '../src/lib/format';
import { haptics } from '../src/lib/haptics';
import { useAuth } from '../src/providers/auth';
import type { Blueprint, JourneyMode, PlanPreviewPayload } from '../src/types';
import {
  DetailsStep,
  MODE_META_BY_MODE,
  ModeStep,
  PathChoiceStep,
  RoadmapPreview,
  defaultWizardDetails,
  validateDetails,
  type WizardDetails,
  type WizardPath,
} from '../src/components/plan-wizard';

const STEP_COUNT = 4;

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
  const [path, setPath] = useState<WizardPath | null>(null);
  const [mode, setMode] = useState<JourneyMode | null>(null);
  const [blueprintSlug, setBlueprintSlug] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [details, setDetails] = useState<WizardDetails>(() =>
    defaultWizardDetails({
      currentWeight: profile?.weight_kg != null ? String(profile.weight_kg) : '',
      height: profile?.height_cm != null ? String(profile.height_cm) : '',
      age: (() => {
        const a = calculateAge(profile?.date_of_birth);
        return a != null ? String(a) : '';
      })(),
      sex: (profile?.sex as 'MALE' | 'FEMALE') || null,
    })
  );

  const patchDetails = (patch: Partial<WizardDetails>) => setDetails((prev) => ({ ...prev, ...patch }));

  const blueprintsQuery = useQuery({
    queryKey: ['blueprints'],
    queryFn: () => api.getBlueprints(),
    enabled: path === 'blueprint',
  });

  const onChangeMode = (m: JourneyMode, bp: Blueprint | null) => {
    setMode(m);
    setBlueprintSlug(bp?.slug ?? null);
    if (bp) {
      patchDetails({ duration: String(bp.default_duration_days), daysPerWeek: bp.default_days_per_week });
    }
  };

  const buildPreviewPayload = (): PlanPreviewPayload => ({
    blueprint_slug: path === 'blueprint' ? blueprintSlug ?? undefined : undefined,
    mode: path === 'custom' ? mode ?? undefined : undefined,
    duration_days: Math.round(parseNumberInput(details.duration) ?? 0),
    days_per_week: details.daysPerWeek,
    weekdays: details.weekdays,
    current_weight_kg: parseNumberInput(details.currentWeight) ?? 0,
    goal_weight_kg: parseNumberInput(details.goalWeight) ?? undefined,
    height_cm: parseNumberInput(details.height) ?? 0,
    age: Math.round(parseNumberInput(details.age) ?? 0),
    sex: details.sex ?? 'MALE',
  });

  const previewMutation = useMutation({
    mutationFn: (payload: PlanPreviewPayload) => api.previewPlan(payload),
  });

  useEffect(() => {
    if (step === 3) {
      previewMutation.mutate(buildPreviewPayload());
    }
    // Only re-fetch when the user (re-)enters step 3, not on every keystroke in step 2.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const startMutation = useMutation({
    mutationFn: () => api.createPlan(buildPreviewPayload()),
    onSuccess: async () => {
      haptics.success();
      await Promise.all([queryClient.invalidateQueries(), refreshUser()]);
      router.back();
    },
    onError: (err) => {
      haptics.error();
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
      router.back();
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

  const goNext = () => {
    if (step === 0) {
      if (!path) {
        haptics.error();
        return;
      }
      haptics.selection();
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!mode || (path === 'blueprint' && !blueprintSlug)) {
        haptics.error();
        return;
      }
      haptics.selection();
      setStep(2);
      return;
    }
    if (step === 2) {
      const err = validateDetails(details, mode);
      if (err) {
        setDetailsError(err);
        haptics.error();
        return;
      }
      setDetailsError(null);
      haptics.selection();
      setStep(3);
      return;
    }
    submit();
  };

  const canAdvance = useMemo(() => {
    if (step === 0) return !!path;
    if (step === 1) return !!mode && (path !== 'blueprint' || !!blueprintSlug);
    return true;
  }, [step, path, mode, blueprintSlug]);

  const modeMeta = mode ? MODE_META_BY_MODE[mode] : null;

  const summaryText =
    step >= 2 && mode
      ? `${modeMeta?.label ?? mode} · ${details.duration || '—'} days · ${details.daysPerWeek} days/wk`
      : null;

  const footer =
    step === 3 ? (
      <View style={styles.footerRow}>
        <Button
          title="Edit"
          variant="secondary"
          size="lg"
          icon={<Pencil size={16} color={colors.textPrimary} />}
          iconPosition="left"
          onPress={() => setStep(2)}
          style={styles.editBtn}
        />
        <Button
          title="Start this plan"
          size="lg"
          icon={<Play size={18} color="#FFFFFF" />}
          iconPosition="left"
          loading={startMutation.isPending}
          disabled={previewMutation.isPending || !previewMutation.data}
          onPress={submit}
          style={styles.flex}
        />
      </View>
    ) : (
      <View style={styles.footerCol}>
        {summaryText ? <Text style={styles.summaryText}>{summaryText}</Text> : null}
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
          <Button
            title={step === 2 ? 'Preview my plan' : 'Continue'}
            size="lg"
            onPress={goNext}
            disabled={!canAdvance}
            style={styles.flex}
          />
        </View>
      </View>
    );

  return (
    <SheetScreen title="Build your plan" subtitle={`Step ${step + 1} of ${STEP_COUNT}`} onClose={() => router.back()} footer={footer}>
      <ProgressBar percentage={((step + 1) / STEP_COUNT) * 100} style={styles.progress} />

      {step === 0 ? (
        <Animated.View key="step-0" entering={FadeInRight.duration(300).springify().damping(15)}>
          <PathChoiceStep value={path} onChange={setPath} />
        </Animated.View>
      ) : null}

      {step === 1 && path ? (
        <Animated.View key="step-1" entering={FadeInRight.duration(300).springify().damping(15)}>
          <ModeStep
            path={path}
            value={mode}
            onChange={onChangeMode}
            blueprints={blueprintsQuery.data?.blueprints}
            isLoading={blueprintsQuery.isLoading}
            isError={blueprintsQuery.isError}
            onRetry={() => blueprintsQuery.refetch()}
          />
        </Animated.View>
      ) : null}

      {step === 2 ? (
        <Animated.View key="step-2" entering={FadeInRight.duration(300).springify().damping(15)}>
          <DetailsStep mode={mode} details={details} onChange={patchDetails} errorMessage={detailsError} />
        </Animated.View>
      ) : null}

      {step === 3 ? (
        <Animated.View key="step-3" entering={FadeInRight.duration(300).springify().damping(15)}>
          <RoadmapPreview
            roadmap={previewMutation.data}
            isLoading={previewMutation.isPending}
            isError={previewMutation.isError}
            errorMessage={previewMutation.error ? extractErrorMessage(previewMutation.error) : undefined}
            onRetry={() => previewMutation.mutate(buildPreviewPayload())}
          />
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
  note: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: spacing.lg,
  },
}));
