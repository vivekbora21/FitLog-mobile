import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractErrorMessage } from '../src/api/client';
import { Button, ChipGroup, Input, ProgressBar, SheetScreen } from '../src/components/ui';
import { colors, spacing } from '../src/theme';
import type { UserProfile } from '../src/types';
import { parseNumberInput, toDateKey } from '../src/lib/format';
import { useAuth } from '../src/providers/auth';
import { invalidateTrackingData } from '../src/lib/queries';
import { haptics } from '../src/lib/haptics';
import { setFlag } from '../src/lib/secureStore';
import { onboardingSkipKey } from '../src/lib/onboarding';

type ActivityLevel = NonNullable<UserProfile['activity_level']>;
type Sex = 'MALE' | 'FEMALE';

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
  { value: 'STRENGTH', label: 'Strength' },
  { value: 'HYPERTROPHY', label: 'Muscle gain' },
  { value: 'FAT_LOSS', label: 'Fat loss' },
  { value: 'ENDURANCE', label: 'Endurance' },
  { value: 'GENERAL_FITNESS', label: 'General fitness' },
];

const WORKOUT_OPTIONS = [2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}×` }));

function ageFromDob(dob?: string | null): string {
  if (!dob) return '';
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
  return age > 0 ? String(age) : '';
}

// We only ask for age, so keep the stored birthday if the age still matches; otherwise use today's date `age` years back.
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

  const [step, setStep] = useState<0 | 1>(0);
  const [sex, setSex] = useState<Sex | null>(profile?.sex || null);
  const [age, setAge] = useState(ageFromDob(profile?.date_of_birth));
  const [height, setHeight] = useState(profile?.height_cm != null ? String(profile.height_cm) : '');
  const [weight, setWeight] = useState(profile?.weight_kg != null ? String(profile.weight_kg) : '');
  const [goal, setGoal] = useState(profile?.fitness_goal || 'HYPERTROPHY');
  const [activity, setActivity] = useState<ActivityLevel>(profile?.activity_level ?? 'MODERATE');
  const [workouts, setWorkouts] = useState(4);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const ageVal = parseNumberInput(age);
  const heightVal = parseNumberInput(height);
  const weightVal = parseNumberInput(weight);

  const validateBody = () => {
    const next: Record<string, string> = {};
    if (!sex) next.sex = 'Select one';
    if (ageVal == null || ageVal < 13 || ageVal > 100) next.age = '13–100';
    if (heightVal == null || heightVal < 100 || heightVal > 250) next.height = '100–250 cm';
    if (weightVal == null || weightVal < 30 || weightVal > 300) next.weight = '30–300 kg';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const skip = async () => {
    if (user) await setFlag(onboardingSkipKey(user.id));
    router.back();
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.updateMe({
        profile: {
          sex: sex!,
          date_of_birth: dobFromAge(Math.round(ageVal!), profile?.date_of_birth),
          height_cm: heightVal,
          weight_kg: weightVal,
          activity_level: activity,
          fitness_goal: goal,
        },
      });
      const today = toDateKey(new Date());
      const existing = (await api.getWeights()).find((w) => w.date === today);
      if (existing) await api.updateWeight(existing.id, weightVal!);
      else await api.logWeight(today, weightVal!);
      await api.updateMacroTargets({ weekly_workouts: workouts });
      // Calories and macros derived from the numbers above.
      await api.applyRecommendedTargets();
      await refreshUser();
    },
    onSuccess: async () => {
      haptics.success();
      await Promise.all([
        invalidateTrackingData(queryClient),
        queryClient.invalidateQueries({ queryKey: ['weights'] }),
      ]);
      router.back();
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't save your details", extractErrorMessage(err));
    },
  });

  const onPrimary = () => {
    if (step === 0) {
      if (validateBody()) setStep(1);
      else haptics.error();
    } else {
      saveMutation.mutate();
    }
  };

  const firstName = user?.first_name?.trim();

  return (
    <SheetScreen
      title={firstName ? `Welcome, ${firstName}` : 'Welcome to FitLog'}
      subtitle={`Step ${step + 1} of 2`}
      onClose={skip}
      footer={
        <View style={styles.footerRow}>
          {step === 1 ? (
            <Button title="Back" variant="secondary" size="lg" onPress={() => setStep(0)} style={styles.backBtn} />
          ) : null}
          <Button
            title={step === 0 ? 'Continue' : 'Finish setup'}
            size="lg"
            loading={saveMutation.isPending}
            onPress={onPrimary}
            style={styles.flex}
          />
        </View>
      }
    >
      <ProgressBar percentage={step === 0 ? 50 : 100} style={styles.progress} />

      {step === 0 ? (
        <>
          <Text style={styles.heading}>Your measurements</Text>
          <Text style={styles.body}>We use these to calculate your daily calorie and macro targets.</Text>

          <ChipGroup label="Sex" options={SEX_OPTIONS} value={sex} onChange={setSex} />
          {errors.sex ? <Text style={styles.error}>{errors.sex}</Text> : null}

          <Input
            label="Age"
            keyboardType="number-pad"
            value={age}
            onChangeText={setAge}
            error={errors.age}
            placeholder="e.g. 28"
          />
          <View style={styles.row}>
            <Input
              label="Height (cm)"
              keyboardType="decimal-pad"
              value={height}
              onChangeText={setHeight}
              error={errors.height}
              placeholder="175"
              containerStyle={styles.flex}
            />
            <Input
              label="Weight (kg)"
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
              error={errors.weight}
              placeholder="72.5"
              containerStyle={styles.flex}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.heading}>Your goals</Text>
          <Text style={styles.body}>You can change any of this later from your profile.</Text>

          <ChipGroup label="Main goal" options={GOAL_OPTIONS} value={goal} onChange={setGoal} />
          <ChipGroup label="Daily activity level" options={ACTIVITY_OPTIONS} value={activity} onChange={setActivity} />
          <ChipGroup label="Workouts per week" options={WORKOUT_OPTIONS} value={workouts} onChange={setWorkouts} />
        </>
      )}
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
  progress: {
    marginBottom: spacing.lg,
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
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  backBtn: {
    paddingHorizontal: spacing.lg,
  },
});
