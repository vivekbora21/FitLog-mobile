import React, { useState } from 'react';
import { Text, Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeIn, FadeOut } from 'react-native-reanimated';
import { Footprints, Moon, Scale, Zap } from 'lucide-react-native';
import { api, extractErrorMessage } from '../src/api/client';
import { Badge, Button, DateNavigator, Input, PressableScale, SheetScreen, Skeleton } from '../src/components/ui';
import { radius, spacing, makeStyles, useTheme } from '../src/theme';
import { isValidDateKey, parseNumberInput, toDateKey } from '../src/lib/format';
import { invalidateTrackingData } from '../src/lib/queries';
import { useAuth } from '../src/providers/auth';
import type { DailyLog, WeightEntry } from '../src/types';
import { haptics } from '../src/lib/haptics';

const RATING_VALUES = [1, 2, 3, 4, 5];

const SLEEP_DESCRIPTIONS: Record<number, { text: string; tone: 'rose' | 'amber' | 'cyan' | 'emerald' }> = {
  1: { text: 'Poor / Restless sleep', tone: 'rose' },
  2: { text: 'Subpar / Fragmented', tone: 'amber' },
  3: { text: 'Fair / Moderate', tone: 'cyan' },
  4: { text: 'Good / Restful', tone: 'emerald' },
  5: { text: 'Excellent / Deep sleep', tone: 'emerald' },
};

const ENERGY_DESCRIPTIONS: Record<number, { text: string; tone: 'rose' | 'amber' | 'cyan' | 'emerald' }> = {
  1: { text: 'Drained / Exhausted', tone: 'rose' },
  2: { text: 'Low energy', tone: 'amber' },
  3: { text: 'Moderate energy', tone: 'cyan' },
  4: { text: 'Good / Energised', tone: 'emerald' },
  5: { text: 'Peak / Dialed in', tone: 'emerald' },
};

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
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Skeleton height={56} borderRadius={radius.md} style={{ flex: 1 }} />
            <Skeleton height={56} borderRadius={radius.md} style={{ flex: 1 }} />
          </View>
          <Skeleton height={18} width="50%" />
          <Skeleton height={46} borderRadius={radius.md} />
          <Skeleton height={18} width="50%" />
          <Skeleton height={46} borderRadius={radius.md} />
          <Skeleton height={56} borderRadius={radius.md} />
          <Skeleton height={90} borderRadius={radius.md} />
        </View>
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

function ReactiveRatingPicker({
  label,
  icon,
  value,
  onChange,
  descriptions,
}: {
  label: string;
  icon: React.ReactNode;
  value: number | null;
  onChange: (v: number) => void;
  descriptions: Record<number, { text: string; tone: 'rose' | 'amber' | 'cyan' | 'emerald' }>;
}) {
  const styles = useStyles();

  return (
    <View style={styles.ratingGroup}>
      <View style={styles.ratingHeader}>
        <View style={styles.ratingLabelRow}>
          {icon}
          <Text style={styles.ratingLabel}>{label}</Text>
        </View>
        {value != null && descriptions[value] && (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <Badge label={descriptions[value].text} tone={descriptions[value].tone} />
          </Animated.View>
        )}
      </View>
      <View style={styles.ratingRow} accessibilityRole="radiogroup">
        {RATING_VALUES.map((n) => {
          const selected = value === n;
          return (
            <PressableScale
              key={n}
              onPress={() => {
                haptics.selection();
                onChange(n);
              }}
              scaleTo={0.92}
              style={[
                styles.ratingChip,
                selected && styles.ratingChipSelected,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label} ${n}`}
            >
              <Text style={[styles.ratingChipText, selected && styles.ratingChipTextSelected]}>
                {n}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
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
  const { colors } = useTheme();
  const styles = useStyles();
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

      <Animated.View entering={FadeInDown.delay(50).duration(350)} style={styles.row}>
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
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(350)}>
        <ReactiveRatingPicker
          label="Sleep quality"
          icon={<Moon size={14} color={colors.violet} />}
          value={sleepQuality}
          onChange={setSleepQuality}
          descriptions={SLEEP_DESCRIPTIONS}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(190).duration(350)}>
        <ReactiveRatingPicker
          label="Energy level"
          icon={<Zap size={14} color={colors.amber} />}
          value={energy}
          onChange={setEnergy}
          descriptions={ENERGY_DESCRIPTIONS}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(260).duration(350)}>
        <Input
          label="Body weight (kg)"
          placeholder="Optional"
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={setWeight}
          leftIcon={<Scale size={18} color={colors.primaryLight} />}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(330).duration(350)}>
        <Input
          label="Recovery notes"
          placeholder="Soreness, stress, anything worth remembering"
          value={notes}
          onChangeText={setNotes}
          multiline
          style={styles.notes}
        />
      </Animated.View>

      <Text style={styles.hint}>Leave a field blank to skip it. You can come back and edit any day.</Text>
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
  ratingGroup: {
    marginBottom: spacing.md,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  ratingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  ratingChip: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingChipSelected: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryLight,
  },
  ratingChipText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  ratingChipTextSelected: {
    color: colors.primaryLight,
    fontWeight: '900',
  },
  notes: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
}));
