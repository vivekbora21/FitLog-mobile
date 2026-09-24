import React, { useState } from 'react';
import { Text, StyleSheet, Alert, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Footprints, Moon, Scale } from 'lucide-react-native';
import { api, extractErrorMessage } from '../src/api/client';
import { Button, ChipGroup, DateNavigator, Input, SheetScreen } from '../src/components/ui';
import { colors, spacing } from '../src/theme';
import { isValidDateKey, parseNumberInput, toDateKey } from '../src/lib/format';
import { invalidateTrackingData } from '../src/lib/queries';
import { useAuth } from '../src/providers/auth';
import type { DailyLog, WeightEntry } from '../src/types';
import { haptics } from '../src/lib/haptics';

const RATING_OPTIONS = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));

const numText = (n?: number | null) => (n == null ? '' : String(n));

export default function CheckInScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(() => (isValidDateKey(params.date) ? params.date : toDateKey(new Date())));

  const logQuery = useQuery({
    queryKey: ['dailyLog', date],
    queryFn: () => api.getDailyLog(date),
  });

  const weightsQuery = useQuery({
    queryKey: ['weights'],
    queryFn: () => api.getWeights(),
  });

  if (logQuery.isPending || weightsQuery.isPending) {
    return (
      <SheetScreen title="Daily check-in" subtitle="Steps, sleep, recovery & weight">
        <DateNavigator date={date} onChange={setDate} />
        <ActivityIndicator color={colors.primaryLight} style={styles.loader} />
      </SheetScreen>
    );
  }

  // Keyed by date so switching days re-seeds the form from that day's saved values.
  return (
    <CheckInForm
      key={date}
      date={date}
      onChangeDate={setDate}
      log={logQuery.data ?? null}
      existingWeight={weightsQuery.data?.find((w) => w.date === date) ?? null}
    />
  );
}

function CheckInForm({
  date,
  onChangeDate,
  log,
  existingWeight,
}: {
  date: string;
  onChangeDate: (date: string) => void;
  log: DailyLog | null;
  existingWeight: WeightEntry | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  const [steps, setSteps] = useState(numText(log?.steps));
  const [sleepHours, setSleepHours] = useState(numText(log?.sleep_hours));
  const [sleepQuality, setSleepQuality] = useState<number | null>(log?.sleep_quality ?? null);
  const [energy, setEnergy] = useState<number | null>(log?.energy_level ?? null);
  const [notes, setNotes] = useState(log?.recovery_notes ?? '');
  const [weight, setWeight] = useState(numText(existingWeight?.weight_kg));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const stepsVal = parseNumberInput(steps);
      await api.saveDailyLog({
        date,
        steps: stepsVal == null ? null : Math.round(stepsVal),
        sleep_hours: parseNumberInput(sleepHours),
        sleep_quality: sleepQuality,
        energy_level: energy,
        recovery_notes: notes.trim(),
      });
      const weightVal = parseNumberInput(weight);
      if (weightVal != null && weightVal > 0 && weightVal !== existingWeight?.weight_kg) {
        // One weigh-in per day: correct the existing entry rather than adding a second.
        if (existingWeight) await api.updateWeight(existingWeight.id, weightVal);
        else await api.logWeight(date, weightVal);
        // Keep the profile's current weight in sync when logging today's weigh-in.
        if (date === toDateKey(new Date())) {
          await api.updateMe({ profile: { weight_kg: weightVal } });
          await refreshUser();
        }
      }
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
      Alert.alert("Couldn't save check-in", extractErrorMessage(err));
    },
  });

  return (
    <SheetScreen
      title="Daily check-in"
      subtitle="Steps, sleep, recovery & weight"
      footer={
        <Button
          title="Save check-in"
          size="lg"
          loading={saveMutation.isPending}
          onPress={() => saveMutation.mutate()}
        />
      }
    >
      <DateNavigator date={date} onChange={onChangeDate} />

      <View style={styles.row}>
        <Input
          label="Steps"
          placeholder="e.g. 8500"
          keyboardType="number-pad"
          value={steps}
          onChangeText={setSteps}
          leftIcon={<Footprints size={18} color={colors.amber} />}
          containerStyle={styles.half}
        />
        <Input
          label="Sleep (hours)"
          placeholder="e.g. 7.5"
          keyboardType="decimal-pad"
          value={sleepHours}
          onChangeText={setSleepHours}
          leftIcon={<Moon size={18} color={colors.violet} />}
          containerStyle={styles.half}
        />
      </View>

      <ChipGroup
        label="Sleep quality (1 = poor, 5 = great)"
        options={RATING_OPTIONS}
        value={sleepQuality}
        onChange={setSleepQuality}
      />
      <ChipGroup
        label="Energy level (1 = drained, 5 = energised)"
        options={RATING_OPTIONS}
        value={energy}
        onChange={setEnergy}
      />

      <Input
        label="Body weight (kg)"
        placeholder="Optional"
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={setWeight}
        leftIcon={<Scale size={18} color={colors.primaryLight} />}
      />

      <Input
        label="Recovery notes"
        placeholder="Soreness, stress, anything worth remembering"
        value={notes}
        onChangeText={setNotes}
        multiline
        style={styles.notes}
      />

      <Text style={styles.hint}>Leave a field blank to skip it. You can come back and edit any day.</Text>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
  notes: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
