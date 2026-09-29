import React, { useState } from 'react';
import { View, Alert, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { api, extractErrorMessage } from '../src/api/client';
import { Badge, Button, ChipGroup, Input, SheetScreen, Skeleton } from '../src/components/ui';
import { radius, spacing, makeStyles } from '../src/theme';
import type { UserProfile } from '../src/types';
import { parseNumberInput, toDateKey, calculateAge, formatDobDisplay, isValidDateKey } from '../src/lib/format';
import { useAuth } from '../src/providers/auth';
import { invalidateTrackingData } from '../src/lib/queries';
import { haptics } from '../src/lib/haptics';

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

const GOAL_DESCRIPTIONS: Record<string, string> = {
  STRENGTH: 'Powerlifting & heavy compound focus',
  HYPERTROPHY: 'Maximise muscle volume & progressive overload',
  FAT_LOSS: 'Caloric deficit & sustained fat reduction',
  ENDURANCE: 'Cardiovascular output & stamina conditioning',
  GENERAL_FITNESS: 'Holistic movement, mobility & vitality',
};

export default function EditProfileScreen() {
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const profile = user?.profile;

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [dob, setDob] = useState(profile?.date_of_birth ?? '');
  const [sex, setSex] = useState<Sex | null>((profile?.sex as Sex) || null);
  const [weight, setWeight] = useState(profile?.weight_kg != null ? String(profile.weight_kg) : '');
  const [height, setHeight] = useState(profile?.height_cm != null ? String(profile.height_cm) : '');
  const [activity, setActivity] = useState<ActivityLevel>(profile?.activity_level ?? 'MODERATE');
  const [goal, setGoal] = useState(profile?.fitness_goal ?? 'HYPERTROPHY');

  const saveMutation = useMutation({
    mutationFn: async () => {
      const weightVal = parseNumberInput(weight);
      const heightVal = parseNumberInput(height);
      const cleanDob = dob.trim();
      if (cleanDob && !isValidDateKey(cleanDob)) {
        throw new Error('Please enter date of birth as YYYY-MM-DD (e.g. 1998-05-15)');
      }

      await api.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        profile: {
          date_of_birth: cleanDob || null,
          sex: sex || undefined,
          weight_kg: weightVal,
          height_cm: heightVal,
          activity_level: activity,
          fitness_goal: goal,
        },
      });
      // A changed body weight is also a weigh-in, so it shows up in progress history.
      if (weightVal != null && weightVal > 0 && weightVal !== profile?.weight_kg) {
        const today = toDateKey(new Date());
        const existing = (await api.getWeights()).find((w) => w.date === today);
        if (existing) await api.updateWeight(existing.id, weightVal);
        else await api.logWeight(today, weightVal);
      }
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
      Alert.alert("Couldn't save profile", extractErrorMessage(err));
    },
  });

  if (!user) {
    return (
      <SheetScreen title="Edit profile">
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          <View style={styles.row}>
            <Skeleton height={56} borderRadius={radius.md} style={styles.half} />
            <Skeleton height={56} borderRadius={radius.md} style={styles.half} />
          </View>
          <Skeleton height={56} borderRadius={radius.md} />
          <Skeleton height={20} width="40%" />
          <Skeleton height={44} borderRadius={radius.md} />
          <View style={styles.row}>
            <Skeleton height={56} borderRadius={radius.md} style={styles.half} />
            <Skeleton height={56} borderRadius={radius.md} style={styles.half} />
          </View>
          <Skeleton height={44} borderRadius={radius.md} />
        </View>
      </SheetScreen>
    );
  }

  const parsedAge = calculateAge(dob.trim());

  return (
    <SheetScreen
      title="Edit profile"
      footer={
        <Button title="Save changes" size="lg" loading={saveMutation.isPending} onPress={() => saveMutation.mutate()} />
      }
    >
      <Animated.View entering={FadeInDown.delay(50).duration(340)} style={styles.row}>
        <Input label="First name" value={firstName} onChangeText={setFirstName} containerStyle={styles.half} />
        <Input label="Last name" value={lastName} onChangeText={setLastName} containerStyle={styles.half} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(110).duration(340)}>
        <Input
          label="Date of birth (YYYY-MM-DD)"
          placeholder="e.g. 1998-05-15"
          value={dob}
          onChangeText={setDob}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={10}
          hint={
            dob.trim() && isValidDateKey(dob.trim())
              ? `${parsedAge != null ? `${parsedAge} years old · ` : ''}Born ${formatDobDisplay(dob.trim())}`
              : 'Used to calculate age, metabolic rate (BMR) & daily calorie targets'
          }
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(170).duration(340)}>
        <ChipGroup
          label="Biological sex (used for BMR & target calories)"
          options={SEX_OPTIONS}
          value={sex}
          onChange={setSex}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(230).duration(340)} style={styles.row}>
        <Input
          label="Weight (kg)"
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={setWeight}
          containerStyle={styles.half}
        />
        <Input
          label="Height (cm)"
          keyboardType="decimal-pad"
          value={height}
          onChangeText={setHeight}
          containerStyle={styles.half}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(290).duration(340)}>
        <ChipGroup label="Activity level" options={ACTIVITY_OPTIONS} value={activity} onChange={setActivity} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(350).duration(340)}>
        <View style={styles.goalHeaderRow}>
          <Text style={styles.goalLabel}>Fitness goal</Text>
          {goal && GOAL_DESCRIPTIONS[goal] && (
            <Animated.View entering={FadeIn.duration(200)}>
              <Badge label={GOAL_DESCRIPTIONS[goal]} tone="emerald" />
            </Animated.View>
          )}
        </View>
        <ChipGroup options={GOAL_OPTIONS} value={goal} onChange={setGoal} />
      </Animated.View>
    </SheetScreen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  goalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
}));
