import React, { useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInRight, ZoomIn } from 'react-native-reanimated';
import { ArrowRight, Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { api, extractErrorMessage } from '../src/api/client';
import { Button, ChipGroup, Input, PressableScale, ProgressBar, SheetScreen } from '../src/components/ui';
import { radius, spacing, makeStyles, useTheme } from '../src/theme';
import type { Blueprint, JourneyMode, UserProfile } from '../src/types';
import { calculateAge, formatDobDisplay, isValidDateKey, parseNumberInput, toDateKey } from '../src/lib/format';
import { useAuth } from '../src/providers/auth';
import { invalidateTrackingData } from '../src/lib/queries';
import { haptics } from '../src/lib/haptics';
import { setFlag } from '../src/lib/secureStore';
import { onboardingSkipKey } from '../src/lib/onboarding';
import {
  DetailsStep,
  ModeStep,
  RoadmapPreview,
  defaultWizardDetails,
  validateDetails,
  type WizardDetails,
  type WizardPath,
} from '../src/components/plan-wizard';

type ActivityLevel = NonNullable<UserProfile['activity_level']>;
type Sex = 'MALE' | 'FEMALE';
type PlanSubStep = 'select' | 'details' | 'preview';

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'SEDENTARY', label: 'Sedentary' },
  { value: 'LIGHT', label: 'Light' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'HIGH', label: 'High' },
  { value: 'ATHLETE', label: 'Athlete' },
];

const GOAL_OPTIONS = [
  { value: 'HYPERTROPHY', label: 'Muscle gain' },
  { value: 'FAT_LOSS', label: 'Fat loss' },
  { value: 'STRENGTH', label: 'Strength' },
  { value: 'ENDURANCE', label: 'Endurance' },
  { value: 'GENERAL_FITNESS', label: 'General fitness' },
];

const WORKOUT_OPTIONS = [2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}×` }));

interface StepBadgeItemProps {
  stepNumber: number;
  label: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

function StepBadgeItem({ stepNumber, label, isCompleted, isCurrent }: StepBadgeItemProps) {
  const styles = useStyles();

  return (
    <View
      style={[
        styles.stepDot,
        isCurrent && styles.stepDotActive,
        isCompleted && styles.stepDotCompleted,
      ]}
    >
      {isCompleted ? (
        <Animated.View entering={ZoomIn.duration(200)} style={styles.stepCheckCircle}>
          <Check size={10} color="#FFFFFF" strokeWidth={3} />
        </Animated.View>
      ) : (
        <View style={[styles.stepNumCircle, isCurrent && styles.stepNumCircleCurrent]}>
          <Text style={[styles.stepNumText, isCurrent && styles.stepNumTextCurrent]}>
            {stepNumber}
          </Text>
        </View>
      )}
      <Text
        style={[
          styles.stepDotText,
          isCurrent && styles.stepDotTextActive,
          isCompleted && styles.stepDotTextCompleted,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const profile = user?.profile;

  const [step, setStep] = useState<0 | 1 | 2>(0);

  // Step 0: Profile & Measurements
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [sex, setSex] = useState<Sex | null>(profile?.sex as Sex || null);
  const [dob, setDob] = useState(profile?.date_of_birth ?? '');
  const [height, setHeight] = useState(profile?.height_cm != null ? String(profile.height_cm) : '');
  const [weight, setWeight] = useState(profile?.weight_kg != null ? String(profile.weight_kg) : '');

  // Step 1: Goals & Activity
  const [goal, setGoal] = useState(profile?.fitness_goal || 'HYPERTROPHY');
  const [activity, setActivity] = useState<ActivityLevel>(profile?.activity_level ?? 'MODERATE');
  const [workouts, setWorkouts] = useState(4);

  // Step 2: Choose Plan (a small self-contained wizard: pick mode -> details -> preview)
  const [planSubStep, setPlanSubStep] = useState<PlanSubStep>('select');
  const [planPath, setPlanPath] = useState<WizardPath>('blueprint');
  const [mode, setMode] = useState<JourneyMode | null>(null);
  const [blueprintSlug, setBlueprintSlug] = useState<string | null>(null);
  const [skipPlan, setSkipPlan] = useState(false);
  const [planDetails, setPlanDetails] = useState<WizardDetails>(() => defaultWizardDetails());
  const [planDetailsError, setPlanDetailsError] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const cleanDob = dob.trim();
  const dobAge = calculateAge(cleanDob);
  const heightVal = parseNumberInput(height);
  const weightVal = parseNumberInput(weight);

  // Recommended mode based on the user's goal from step 1.
  const recommendedMode: JourneyMode = useMemo(() => {
    if (goal === 'FAT_LOSS') return 'CUT';
    if (goal === 'HYPERTROPHY') return 'BULK';
    if (goal === 'STRENGTH') return 'FOCUS';
    return 'HABIT';
  }, [goal]);

  const blueprintsQuery = useQuery({
    queryKey: ['blueprints'],
    queryFn: () => api.getBlueprints(),
    enabled: step === 2 && planPath === 'blueprint',
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      api.previewPlan({
        blueprint_slug: planPath === 'blueprint' ? blueprintSlug ?? undefined : undefined,
        mode: planPath === 'custom' ? mode ?? undefined : undefined,
        duration_days: Math.round(parseNumberInput(planDetails.duration) ?? 0),
        days_per_week: planDetails.daysPerWeek,
        weekdays: planDetails.weekdays,
        current_weight_kg: weightVal ?? 0,
        goal_weight_kg: parseNumberInput(planDetails.goalWeight) ?? undefined,
        height_cm: heightVal ?? 0,
        age: dobAge ?? 0,
        sex: sex ?? 'MALE',
      }),
  });

  const patchPlanDetails = (patch: Partial<WizardDetails>) => setPlanDetails((prev) => ({ ...prev, ...patch }));

  const onChangeMode = (m: JourneyMode, bp: Blueprint | null) => {
    setMode(m);
    setBlueprintSlug(bp?.slug ?? null);
    setSkipPlan(false);
    if (bp) {
      patchPlanDetails({ duration: String(bp.default_duration_days), daysPerWeek: bp.default_days_per_week });
    }
  };

  const validateStep0 = () => {
    const next: Record<string, string> = {};
    if (!sex) next.sex = 'Please select biological sex';
    if (!cleanDob) {
      next.dob = 'Date of birth is required';
    } else if (!isValidDateKey(cleanDob) || dobAge == null) {
      next.dob = 'Please enter date as YYYY-MM-DD (e.g. 1998-05-15)';
    } else if (dobAge < 13) {
      next.dob = 'Must be at least 13 years old';
    } else if (dobAge > 100) {
      next.dob = 'Age must be 100 or younger';
    }
    if (heightVal == null || heightVal < 100 || heightVal > 250) next.height = '100–250 cm';
    if (weightVal == null || weightVal < 30 || weightVal > 300) next.weight = '30–300 kg';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const skip = async () => {
    haptics.light();
    if (user) {
      await setFlag(onboardingSkipKey(user.id));
    }
    router.replace('/(tabs)');
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Save Profile Details
      await api.updateMe({
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        profile: {
          sex: sex!,
          date_of_birth: cleanDob,
          height_cm: heightVal,
          weight_kg: weightVal,
          activity_level: activity,
          fitness_goal: goal,
        },
      });

      // 2. Initial weight entry
      const today = toDateKey(new Date());
      const existing = (await api.getWeights()).find((w) => w.date === today);
      if (existing) await api.updateWeight(existing.id, weightVal!);
      else await api.logWeight(today, weightVal!);

      // 3. Macro targets
      await api.updateMacroTargets({ weekly_workouts: workouts });
      await api.applyRecommendedTargets();

      // 4. Create the guided plan (if the user didn't choose to skip it)
      if (!skipPlan && mode) {
        await api.createPlan({
          blueprint_slug: planPath === 'blueprint' ? blueprintSlug ?? undefined : undefined,
          mode: planPath === 'custom' ? mode : undefined,
          duration_days: Math.round(parseNumberInput(planDetails.duration) ?? 0),
          days_per_week: planDetails.daysPerWeek,
          weekdays: planDetails.weekdays,
          current_weight_kg: weightVal!,
          goal_weight_kg: parseNumberInput(planDetails.goalWeight) ?? undefined,
          height_cm: heightVal!,
          age: dobAge!,
          sex: sex!,
        });
      }

      // 5. Mark onboarding as completed/skipped
      if (user) {
        await setFlag(onboardingSkipKey(user.id));
      }

      // 6. Refresh Auth User
      await refreshUser();
    },
    onSuccess: async () => {
      haptics.success();
      await Promise.all([
        invalidateTrackingData(queryClient),
        queryClient.invalidateQueries({ queryKey: ['weights'] }),
        queryClient.invalidateQueries({ queryKey: ['workoutPlan'] }),
        queryClient.invalidateQueries({ queryKey: ['todaysWorkout'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboardStats'] }),
      ]);
      router.replace('/(tabs)');
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't save your details", extractErrorMessage(err));
    },
  });

  const onNext = () => {
    if (step === 0) {
      if (validateStep0()) {
        haptics.selection();
        setStep(1);
      } else {
        haptics.error();
      }
      return;
    }
    if (step === 1) {
      haptics.selection();
      // Reset the plan sub-wizard and preselect the recommended mode from the goal just picked.
      setMode(recommendedMode);
      setBlueprintSlug(null);
      setPlanPath('blueprint');
      setPlanSubStep('select');
      setSkipPlan(false);
      setStep(2);
      return;
    }
    // step === 2
    if (skipPlan) {
      saveMutation.mutate();
      return;
    }
    if (planSubStep === 'select') {
      if (!mode || (planPath === 'blueprint' && !blueprintSlug)) {
        haptics.error();
        return;
      }
      haptics.selection();
      setPlanSubStep('details');
      return;
    }
    if (planSubStep === 'details') {
      const err = validateDetails(planDetails, mode);
      if (err) {
        setPlanDetailsError(err);
        haptics.error();
        return;
      }
      setPlanDetailsError(null);
      haptics.selection();
      previewMutation.mutate();
      setPlanSubStep('preview');
      return;
    }
    // planSubStep === 'preview'
    saveMutation.mutate();
  };

  const onBack = () => {
    haptics.selection();
    if (step === 2) {
      if (planSubStep === 'preview') {
        setPlanSubStep('details');
        return;
      }
      if (planSubStep === 'details') {
        setPlanSubStep('select');
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) setStep(0);
  };

  const userDisplayName = firstName.trim() || user?.first_name?.trim();

  const stepSubtitles = [
    'Step 1 of 3: Profile Details',
    'Step 2 of 3: Fitness Goals',
    'Step 3 of 3: Choose Plan',
  ];

  const nextTitle = (() => {
    if (step === 0) return 'Continue';
    if (step === 1) return 'Next: Choose Plan';
    if (skipPlan) return 'Finish Setup';
    if (planSubStep === 'select') return 'Next: Plan Details';
    if (planSubStep === 'details') return 'Preview My Plan';
    return 'Start Plan & Finish';
  })();

  const skipHeaderButton = (
    <PressableScale
      onPress={skip}
      style={styles.skipHeaderBtn}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel="Skip profile and plan setup"
    >
      <Text style={styles.skipHeaderText}>Skip</Text>
      <ChevronRight size={14} color={colors.textMuted} />
    </PressableScale>
  );

  return (
    <SheetScreen
      title={userDisplayName ? `Welcome, ${userDisplayName}` : 'Welcome to FitLog'}
      subtitle={stepSubtitles[step]}
      rightAction={skipHeaderButton}
      onClose={skip}
      footer={
        <View style={styles.footerCol}>
          <View style={styles.footerRow}>
            {step > 0 ? (
              <Button
                title="Back"
                variant="secondary"
                size="lg"
                onPress={onBack}
                icon={<ChevronLeft size={18} color={colors.textPrimary} />}
                iconPosition="left"
                style={styles.backBtn}
              />
            ) : null}
            <Button
              title={nextTitle}
              size="lg"
              loading={saveMutation.isPending}
              disabled={
                step === 2 &&
                planSubStep === 'preview' &&
                !skipPlan &&
                (previewMutation.isPending || !previewMutation.data)
              }
              onPress={onNext}
              icon={step < 2 || (step === 2 && !skipPlan && planSubStep !== 'preview') ? (
                <ArrowRight size={18} color="#FFFFFF" />
              ) : (
                <Check size={18} color="#FFFFFF" />
              )}
              iconPosition="right"
              style={styles.flex}
            />
          </View>
          <PressableScale
            onPress={skip}
            style={styles.skipFooterLink}
            haptic="selection"
            hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            accessibilityRole="button"
            accessibilityLabel="Skip setup for now"
          >
            <Text style={styles.skipFooterText}>Skip setup for now (you can fill this anytime)</Text>
          </PressableScale>
        </View>
      }
    >
      {/* Progress Indicator */}
      <View style={styles.progressSection}>
        <ProgressBar
          percentage={step === 0 ? 33 : step === 1 ? 66 : 100}
          style={styles.progress}
        />
        <View style={styles.stepBadgesRow}>
          <StepBadgeItem stepNumber={1} label="Profile" isCompleted={step > 0} isCurrent={step === 0} />
          <View style={[styles.stepDotDivider, step > 0 && styles.stepDotDividerActive]} />
          <StepBadgeItem stepNumber={2} label="Goals" isCompleted={step > 1} isCurrent={step === 1} />
          <View style={[styles.stepDotDivider, step > 1 && styles.stepDotDividerActive]} />
          <StepBadgeItem stepNumber={3} label="Plan" isCompleted={step === 2 && skipPlan} isCurrent={step === 2} />
        </View>
      </View>

      {/* STEP 0: PROFILE & MEASUREMENTS */}
      {step === 0 ? (
        <Animated.View entering={FadeInDown.duration(350)}>
          <Text style={styles.heading}>Tell us about yourself</Text>
          <Text style={styles.body}>
            We use these measurements to calculate your baseline metabolic rate, macro split, and calorie target.
          </Text>

          <View style={styles.row}>
            <Input
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="e.g. Alex"
              containerStyle={styles.flex}
            />
            <Input
              label="Last name"
              value={lastName}
              onChangeText={setLastName}
              placeholder="e.g. Smith"
              containerStyle={styles.flex}
            />
          </View>

          <ChipGroup label="Biological sex" options={SEX_OPTIONS} value={sex} onChange={setSex} />
          {errors.sex ? <Text style={styles.error}>{errors.sex}</Text> : null}

          <Input
            label="Date of birth (YYYY-MM-DD)"
            placeholder="e.g. 1998-05-15"
            value={dob}
            onChangeText={setDob}
            error={errors.dob}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
            hint={
              cleanDob && isValidDateKey(cleanDob) && dobAge != null
                ? `${dobAge} years old · Born ${formatDobDisplay(cleanDob)}`
                : 'Used to calculate metabolic rate (BMR) & daily calorie targets'
            }
          />

          <View style={styles.row}>
            <Input
              label="Height (cm)"
              keyboardType="decimal-pad"
              value={height}
              onChangeText={setHeight}
              error={errors.height}
              placeholder="178"
              containerStyle={styles.flex}
            />
            <Input
              label="Weight (kg)"
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
              error={errors.weight}
              placeholder="75.0"
              containerStyle={styles.flex}
            />
          </View>
        </Animated.View>
      ) : null}

      {/* STEP 1: GOALS & ACTIVITY */}
      {step === 1 ? (
        <Animated.View entering={FadeInRight.duration(350)}>
          <Text style={styles.heading}>Your goals & routine</Text>
          <Text style={styles.body}>
            Tell us what you want to achieve. This helps us calibrate workout volume and nutritional surplus or deficit.
          </Text>

          <ChipGroup label="Primary fitness goal" options={GOAL_OPTIONS} value={goal} onChange={setGoal} />
          <ChipGroup
            label="Daily activity level (outside workouts)"
            options={ACTIVITY_OPTIONS}
            value={activity}
            onChange={setActivity}
          />
          <ChipGroup
            label="Planned workout sessions per week"
            options={WORKOUT_OPTIONS}
            value={workouts}
            onChange={setWorkouts}
          />
        </Animated.View>
      ) : null}

      {/* STEP 2: CHOOSE PLAN (mode -> details -> preview) */}
      {step === 2 ? (
        <Animated.View entering={FadeInRight.duration(350)}>
          {planSubStep === 'select' ? (
            <>
              <Text style={styles.heading}>Choose your starting plan</Text>
              <Text style={styles.body}>
                We recommend a mode based on your goal. You can pick a different one, or build a fully custom plan.
              </Text>

              <View style={styles.pathToggleRow}>
                <PressableScale
                  haptic="selection"
                  onPress={() => setPlanPath('blueprint')}
                  style={[styles.pathToggle, planPath === 'blueprint' && styles.pathToggleActive]}
                >
                  <Text style={[styles.pathToggleText, planPath === 'blueprint' && styles.pathToggleTextActive]}>
                    Ready-made
                  </Text>
                </PressableScale>
                <PressableScale
                  haptic="selection"
                  onPress={() => setPlanPath('custom')}
                  style={[styles.pathToggle, planPath === 'custom' && styles.pathToggleActive]}
                >
                  <Text style={[styles.pathToggleText, planPath === 'custom' && styles.pathToggleTextActive]}>
                    Build my own
                  </Text>
                </PressableScale>
              </View>

              <ModeStep
                path={planPath}
                value={skipPlan ? null : mode}
                onChange={onChangeMode}
                blueprints={blueprintsQuery.data?.blueprints}
                isLoading={blueprintsQuery.isLoading}
                isError={blueprintsQuery.isError}
                onRetry={() => blueprintsQuery.refetch()}
                recommendedMode={recommendedMode}
              >
                <PressableScale
                  haptic="selection"
                  scaleTo={0.98}
                  onPress={() => setSkipPlan(true)}
                  style={[styles.laterCard, skipPlan && styles.laterCardSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: skipPlan }}
                  accessibilityLabel="I'll choose a plan later"
                >
                  <View style={styles.laterContent}>
                    <View style={styles.laterTextCol}>
                      <Text style={styles.laterTitle}>I&apos;ll choose a plan later</Text>
                      <Text style={styles.laterDesc}>
                        Finish setting up your profile now and select a workout plan later from the Workouts tab.
                      </Text>
                    </View>
                    <View style={[styles.radioCircle, skipPlan && styles.radioCircleActive]}>
                      {skipPlan ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                  </View>
                </PressableScale>
              </ModeStep>
            </>
          ) : null}

          {planSubStep === 'details' ? (
            <DetailsStep mode={mode} details={planDetails} onChange={patchPlanDetails} errorMessage={planDetailsError} />
          ) : null}

          {planSubStep === 'preview' ? (
            <RoadmapPreview
              roadmap={previewMutation.data}
              isLoading={previewMutation.isPending}
              isError={previewMutation.isError}
              errorMessage={previewMutation.error ? extractErrorMessage(previewMutation.error) : undefined}
              onRetry={() => previewMutation.mutate()}
            />
          ) : null}
        </Animated.View>
      ) : null}
    </SheetScreen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressSection: {
    marginBottom: spacing.lg,
  },
  progress: {
    marginBottom: spacing.sm,
  },
  stepBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  stepDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryLight,
  },
  stepDotCompleted: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primaryLight,
  },
  stepCheckCircle: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumCircle: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumCircleCurrent: {
    backgroundColor: colors.primaryLight,
  },
  stepNumText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  stepNumTextCurrent: {
    color: '#FFFFFF',
  },
  stepDotText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  stepDotTextActive: {
    color: colors.primaryLight,
    fontWeight: '700',
  },
  stepDotTextCompleted: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  stepDotDivider: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
    borderRadius: radius.full,
  },
  stepDotDividerActive: {
    backgroundColor: colors.primaryLight,
  },
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
  error: {
    color: colors.error,
    fontSize: 12,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
  },
  // Skip buttons
  skipHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  skipFooterLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginTop: 2,
  },
  skipFooterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
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
  // Plan path toggle
  pathToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  pathToggle: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  pathToggleActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryLight,
  },
  pathToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  pathToggleTextActive: {
    color: colors.primaryLight,
  },
  // "Choose later" card
  laterCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  laterCardSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySurface,
  },
  laterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  laterTextCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  laterTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  laterDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  radioCircleActive: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primaryLight,
  },
}));
