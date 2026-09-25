import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractErrorMessage } from '../src/api/client';
import { Button, ChipGroup, Input, SheetScreen } from '../src/components/ui';
import { spacing } from '../src/theme';
import type { UserProfile } from '../src/types';
import { parseNumberInput, toDateKey } from '../src/lib/format';
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

export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const profile = user?.profile;

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [sex, setSex] = useState<Sex | null>((profile?.sex as Sex) || null);
  const [weight, setWeight] = useState(profile?.weight_kg != null ? String(profile.weight_kg) : '');
  const [height, setHeight] = useState(profile?.height_cm != null ? String(profile.height_cm) : '');
  const [activity, setActivity] = useState<ActivityLevel>(profile?.activity_level ?? 'MODERATE');
  const [goal, setGoal] = useState(profile?.fitness_goal ?? 'HYPERTROPHY');

  const saveMutation = useMutation({
    mutationFn: async () => {
      const weightVal = parseNumberInput(weight);
      const heightVal = parseNumberInput(height);
      await api.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        profile: {
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

  return (
    <SheetScreen
      title="Edit profile"
      footer={
        <Button title="Save changes" size="lg" loading={saveMutation.isPending} onPress={() => saveMutation.mutate()} />
      }
    >
      <View style={styles.row}>
        <Input label="First name" value={firstName} onChangeText={setFirstName} containerStyle={styles.half} />
        <Input label="Last name" value={lastName} onChangeText={setLastName} containerStyle={styles.half} />
      </View>
      <ChipGroup
        label="Biological sex (used for BMR & target calories)"
        options={SEX_OPTIONS}
        value={sex}
        onChange={setSex}
      />
      <View style={styles.row}>
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
      </View>
      <ChipGroup label="Activity level" options={ACTIVITY_OPTIONS} value={activity} onChange={setActivity} />
      <ChipGroup label="Fitness goal" options={GOAL_OPTIONS} value={goal} onChange={setGoal} />
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
});
