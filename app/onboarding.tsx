import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Scale,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react-native';
import { api, extractErrorMessage } from '../src/api/client';
import { Badge, Button, ChipGroup, Input, PressableScale, ProgressBar, SheetScreen } from '../src/components/ui';
import { colors, radius, spacing } from '../src/theme';
import type { JourneyMode, UserProfile } from '../src/types';
import { parseNumberInput, toDateKey } from '../src/lib/format';
import { useAuth } from '../src/providers/auth';
import { invalidateTrackingData } from '../src/lib/queries';
import { haptics } from '../src/lib/haptics';
import { setFlag } from '../src/lib/secureStore';
import { onboardingSkipKey } from '../src/lib/onboarding';

type ActivityLevel = NonNullable<UserProfile['activity_level']>;
type Sex = 'MALE' | 'FEMALE';

interface Blueprint {
  id: string;
  name: string;
  mode: JourneyMode;
  modeLabel: string;
  color: string;
  tone: 'rose' | 'violet' | 'cyan' | 'amber';
  Icon: typeof Flame;
  durationDays: number;
  description: string;
  pacing: string;
  targetDeltaKg: number;
  matchingGoal: string;
}

const BLUEPRINTS: Blueprint[] = [
  {
    id: 'CUT_60',
    name: '60-Day Recomp & Shred',
    mode: 'CUT',
    modeLabel: 'Cut',
    color: colors.rose,
    tone: 'rose',
    Icon: Flame,
    durationDays: 60,
    description: 'Strip body fat and reveal definition while locking in compound anchor strength.',
    pacing: '-0.5 kg / week',
    targetDeltaKg: -4.3,
    matchingGoal: 'FAT_LOSS',
  },
  {
    id: 'BULK_90',
    name: '90-Day Mass Architecture',
    mode: 'BULK',
    modeLabel: 'Bulk',
    color: colors.violet,
    tone: 'violet',
    Icon: Dumbbell,
    durationDays: 90,
    description: 'Clean surplus pacing to maximise hypertrophy without excess fat gain.',
    pacing: '+0.3 kg / week',
    targetDeltaKg: 3.8,
    matchingGoal: 'HYPERTROPHY',
  },
  {
    id: 'FOCUS_30',
    name: '30-Day Strength Peak',
    mode: 'FOCUS',
    modeLabel: 'Focus',
    color: colors.cyan,
    tone: 'cyan',
    Icon: Target,
    durationDays: 30,
    description: 'Heavy compound progression (RPE 8.5–9.5) to break plateaus and set PRs.',
    pacing: 'Weight neutral',
    targetDeltaKg: 0,
    matchingGoal: 'STRENGTH',
  },
  {
    id: 'HABIT_21',
    name: '21-Day Habit Lock-in',
    mode: 'HABIT',
    modeLabel: 'Habit',
    color: colors.amber,
    tone: 'amber',
    Icon: Zap,
    durationDays: 21,
    description: '3 full-body sessions a week focused on consistency and routine momentum.',
    pacing: 'Consistency first',
    targetDeltaKg: 0,
    matchingGoal: 'GENERAL_FITNESS',
  },
];

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

const round1 = (n: number) => Number(n.toFixed(1));

function ageFromDob(dob?: string | null): string {
  if (!dob) return '';
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
  return age > 0 ? String(age) : '';
}

function dobFromAge(age: number, existing?: string | null): string {
  if (existing && ageFromDob(existing) === String(age)) return existing;
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return toDateKey(d);
}

export default function OnboardingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const profile = user?.profile;

  const [step, setStep] = useState<0 | 1 | 2>(0);

  // Step 0: Profile & Measurements
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [sex, setSex] = useState<Sex | null>(profile?.sex as Sex || null);
  const [age, setAge] = useState(ageFromDob(profile?.date_of_birth));
  const [height, setHeight] = useState(profile?.height_cm != null ? String(profile.height_cm) : '');
  const [weight, setWeight] = useState(profile?.weight_kg != null ? String(profile.weight_kg) : '');

  // Step 1: Goals & Activity
  const [goal, setGoal] = useState(profile?.fitness_goal || 'HYPERTROPHY');
  const [activity, setActivity] = useState<ActivityLevel>(profile?.activity_level ?? 'MODERATE');
  const [workouts, setWorkouts] = useState(4);

  // Step 2: Choose Plan
  const [selectedPlanId, setSelectedPlanId] = useState<string>('CUT_60');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const ageVal = parseNumberInput(age);
  const heightVal = parseNumberInput(height);
  const weightVal = parseNumberInput(weight);

  // Recommended plan based on user goal
  const recommendedPlanId = useMemo(() => {
    if (goal === 'FAT_LOSS') return 'CUT_60';
    if (goal === 'HYPERTROPHY') return 'BULK_90';
    if (goal === 'STRENGTH') return 'FOCUS_30';
    return 'HABIT_21';
  }, [goal]);

  const validateStep0 = () => {
    const next: Record<string, string> = {};
    if (!sex) next.sex = 'Please select biological sex';
    if (ageVal == null || ageVal < 13 || ageVal > 100) next.age = 'Age must be 13–100';
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
          date_of_birth: dobFromAge(Math.round(ageVal!), profile?.date_of_birth),
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

      // 4. Start Journey Plan (if chosen)
      if (selectedPlanId && selectedPlanId !== 'LATER') {
        const bp = BLUEPRINTS.find((b) => b.id === selectedPlanId);
        if (bp) {
          await api.startJourney({
            blueprint: bp.id,
            name: bp.name,
            mode: bp.mode,
            duration_days: bp.durationDays,
            start_weight_kg: weightVal || undefined,
            target_weight_kg: weightVal ? round1(weightVal + bp.targetDeltaKg) : undefined,
          });
        }
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
    } else if (step === 1) {
      haptics.selection();
      // Auto-preselect the recommended plan if user hasn't explicitly changed it
      setSelectedPlanId(recommendedPlanId);
      setStep(2);
    } else {
      saveMutation.mutate();
    }
  };

  const onBack = () => {
    haptics.selection();
    if (step === 2) setStep(1);
    else if (step === 1) setStep(0);
  };

  const userDisplayName = firstName.trim() || user?.first_name?.trim();

  const stepSubtitles = [
    'Step 1 of 3: Profile Details',
    'Step 2 of 3: Fitness Goals',
    'Step 3 of 3: Choose Plan',
  ];

  const skipHeaderButton = (
    <TouchableOpacity
      onPress={skip}
      style={styles.skipHeaderBtn}
      accessibilityRole="button"
      accessibilityLabel="Skip profile and plan setup"
      activeOpacity={0.7}
    >
      <Text style={styles.skipHeaderText}>Skip</Text>
      <ChevronRight size={14} color={colors.textMuted} />
    </TouchableOpacity>
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
              title={
                step === 0
                  ? 'Continue'
                  : step === 1
                  ? 'Next: Choose Plan'
                  : selectedPlanId === 'LATER'
                  ? 'Finish Setup'
                  : 'Start Plan & Finish'
              }
              size="lg"
              loading={saveMutation.isPending}
              onPress={onNext}
              icon={step < 2 ? <ArrowRight size={18} color="#FFFFFF" /> : <Check size={18} color="#FFFFFF" />}
              iconPosition="right"
              style={styles.flex}
            />
          </View>
          <TouchableOpacity onPress={skip} style={styles.skipFooterLink} activeOpacity={0.6}>
            <Text style={styles.skipFooterText}>Skip setup for now (you can fill this anytime)</Text>
          </TouchableOpacity>
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
          <View style={[styles.stepDot, step >= 0 && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, step >= 0 && styles.stepDotTextActive]}>1. Profile</Text>
          </View>
          <View style={styles.stepDotDivider} />
          <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, step >= 1 && styles.stepDotTextActive]}>2. Goals</Text>
          </View>
          <View style={styles.stepDotDivider} />
          <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, step >= 2 && styles.stepDotTextActive]}>3. Plan</Text>
          </View>
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
            label="Age"
            keyboardType="number-pad"
            value={age}
            onChangeText={setAge}
            error={errors.age}
            placeholder="e.g. 26"
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

      {/* STEP 2: CHOOSE PLAN */}
      {step === 2 ? (
        <Animated.View entering={FadeInRight.duration(350)}>
          <Text style={styles.heading}>Choose your starting plan</Text>
          <Text style={styles.body}>
            Select the structured blueprint you will be working towards. You can change or adjust this plan anytime in your workouts tab.
          </Text>

          {BLUEPRINTS.map((bp) => {
            const isSelected = selectedPlanId === bp.id;
            const isRecommended = bp.id === recommendedPlanId;
            const projectedWeight =
              weightVal && bp.targetDeltaKg !== 0 ? round1(weightVal + bp.targetDeltaKg) : null;

            return (
              <PressableScale
                key={bp.id}
                haptic="selection"
                scaleTo={0.98}
                onPress={() => setSelectedPlanId(bp.id)}
                style={[
                  styles.bpCard,
                  isSelected && styles.bpCardSelected,
                  isRecommended && !isSelected && styles.bpCardRecommended,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={bp.name}
              >
                {/* Header row with badges */}
                <View style={styles.bpTopRow}>
                  <View style={styles.bpBadgeRow}>
                    <View style={[styles.bpModeBadge, { backgroundColor: `${bp.color}22` }]}>
                      <bp.Icon size={13} color={bp.color} />
                      <Text style={[styles.bpModeText, { color: bp.color }]}>{bp.modeLabel}</Text>
                    </View>
                    <View style={styles.bpDurationBadge}>
                      <Clock size={12} color={colors.textMuted} />
                      <Text style={styles.bpDurationText}>{bp.durationDays} days</Text>
                    </View>
                  </View>

                  <View style={styles.bpRightRow}>
                    {isRecommended ? (
                      <View style={styles.recommendedBadge}>
                        <Sparkles size={11} color={colors.primaryLight} />
                        <Text style={styles.recommendedText}>Recommended</Text>
                      </View>
                    ) : null}

                    <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                      {isSelected ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                  </View>
                </View>

                {/* Plan Title & Description */}
                <Text style={styles.bpName}>{bp.name}</Text>
                <Text style={styles.bpDesc}>{bp.description}</Text>

                {/* Footer specs: pacing and projected weight */}
                <View style={styles.bpFooterRow}>
                  <Text style={styles.bpPacing}>Pacing: {bp.pacing}</Text>
                  {projectedWeight ? (
                    <View style={styles.projectedWeightBadge}>
                      <Scale size={12} color={colors.textSecondary} />
                      <Text style={styles.projectedWeightText}>
                        Target ~{projectedWeight} kg ({bp.targetDeltaKg > 0 ? `+${bp.targetDeltaKg}` : bp.targetDeltaKg} kg)
                      </Text>
                    </View>
                  ) : null}
                </View>
              </PressableScale>
            );
          })}

          {/* Option to choose plan later */}
          <PressableScale
            haptic="selection"
            scaleTo={0.98}
            onPress={() => setSelectedPlanId('LATER')}
            style={[
              styles.bpCardLater,
              selectedPlanId === 'LATER' && styles.bpCardSelected,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedPlanId === 'LATER' }}
            accessibilityLabel="I'll choose a plan later"
          >
            <View style={styles.bpLaterContent}>
              <View style={styles.bpLaterTextCol}>
                <Text style={styles.bpLaterTitle}>I&apos;ll choose a plan later</Text>
                <Text style={styles.bpLaterDesc}>
                  Finish setting up your profile now and select a workout plan later from the Workouts tab.
                </Text>
              </View>
              <View style={[styles.radioCircle, selectedPlanId === 'LATER' && styles.radioCircleActive]}>
                {selectedPlanId === 'LATER' ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </View>
          </PressableScale>
        </Animated.View>
      ) : null}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
  },
  stepDotActive: {
    backgroundColor: colors.primarySurface,
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
  stepDotDivider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
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
  // Blueprint cards
  bpCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bpCardSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySurface,
  },
  bpCardRecommended: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  bpTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bpBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bpModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  bpModeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bpDurationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
  },
  bpDurationText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  bpRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  recommendedText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryLight,
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
  bpName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  bpDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  bpFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  bpPacing: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  projectedWeightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projectedWeightText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  bpCardLater: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bpLaterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bpLaterTextCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  bpLaterTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bpLaterDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
});
