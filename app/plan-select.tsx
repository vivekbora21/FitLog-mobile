import React, { useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Dumbbell, Flame, Play, Scale, Target, TrendingDown, TrendingUp, Zap } from 'lucide-react-native';
import { api, extractErrorMessage } from '../src/api/client';
import { Button, ChipGroup, Input, PressableScale, SheetScreen } from '../src/components/ui';
import { radius, spacing, makeStyles, useTheme } from '../src/theme';
import { parseNumberInput } from '../src/lib/format';
import { haptics } from '../src/lib/haptics';
import { useAuth } from '../src/providers/auth';
import type { JourneyMode } from '../src/types';

interface Blueprint {
  id: string;
  name: string;
  mode: JourneyMode;
  modeLabel: string;
  /** Palette key, resolved against the active theme when rendered. */
  color: 'rose' | 'violet' | 'cyan' | 'amber';
  Icon: typeof Flame;
  durationDays: number;
  description: string;
  pacing: string;
  targetDeltaKg: number;
}

// Mirrors the web PlanSelectorModal blueprints; the backend recognises these ids.
const BLUEPRINTS: Blueprint[] = [
  {
    id: 'CUT_60',
    name: '60-Day Recomp & Shred',
    mode: 'CUT',
    modeLabel: 'Cut',
    color: 'rose',
    Icon: Flame,
    durationDays: 60,
    description: 'Strip body fat and reveal definition while locking in compound anchor strength.',
    pacing: '-0.5 kg / week',
    targetDeltaKg: -4.3,
  },
  {
    id: 'BULK_90',
    name: '90-Day Mass Architecture',
    mode: 'BULK',
    modeLabel: 'Bulk',
    color: 'violet',
    Icon: Dumbbell,
    durationDays: 90,
    description: 'Clean surplus pacing to maximise hypertrophy without excess fat gain.',
    pacing: '+0.3 kg / week',
    targetDeltaKg: 3.8,
  },
  {
    id: 'FOCUS_30',
    name: '30-Day Strength Peak',
    mode: 'FOCUS',
    modeLabel: 'Focus',
    color: 'cyan',
    Icon: Target,
    durationDays: 30,
    description: 'Heavy compound progression (RPE 8.5–9.5) to break plateaus and set PRs.',
    pacing: 'Weight neutral',
    targetDeltaKg: 0,
  },
  {
    id: 'HABIT_21',
    name: '21-Day Habit Lock-in',
    mode: 'HABIT',
    modeLabel: 'Habit',
    color: 'amber',
    Icon: Zap,
    durationDays: 21,
    description: '3 full-body sessions a week focused on consistency and routine momentum.',
    pacing: 'Consistency first',
    targetDeltaKg: 0,
  },
];

const MODE_OPTIONS: { value: JourneyMode; label: string }[] = [
  { value: 'CUT', label: 'Cut' },
  { value: 'BULK', label: 'Bulk' },
  { value: 'FOCUS', label: 'Focus' },
  { value: 'RECOMP', label: 'Recomp' },
  { value: 'HABIT', label: 'Habit' },
];

const MODE_TARGET_DELTA: Record<JourneyMode, number> = { CUT: -4, BULK: 3, FOCUS: 0, RECOMP: -1.5, HABIT: 0 };
const DURATION_PRESETS = [21, 30, 45, 60, 90, 120].map((d) => ({ value: d, label: `${d}d` }));

// Mirrors JourneyProgram.MIN_DURATION_DAYS / MAX_DURATION_DAYS on the backend.
const MIN_PLAN_DAYS = 7;
const MAX_PLAN_DAYS = 365;

const round1 = (n: number) => Number(n.toFixed(1));

export default function PlanSelectScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const planQuery = useQuery({ queryKey: ['workoutPlan'], queryFn: () => api.getWorkoutPlan() });
  const hasActivePlan = !!planQuery.data?.program;

  const initialWeight = user?.profile?.weight_kg ?? planQuery.data?.program?.start_weight_kg ?? null;

  const [tab, setTab] = useState<'blueprints' | 'custom'>('blueprints');
  const [blueprintId, setBlueprintId] = useState('CUT_60');
  const [startWeight, setStartWeight] = useState(initialWeight ? String(initialWeight) : '');
  const [mode, setMode] = useState<JourneyMode>('CUT');
  const [name, setName] = useState('');
  const [days, setDays] = useState('60');
  const [targetWeight, setTargetWeight] = useState(initialWeight ? String(round1(initialWeight - 4)) : '');

  const startKg = parseNumberInput(startWeight);
  const targetKg = parseNumberInput(targetWeight);
  const dayCount = parseNumberInput(days);

  const velocity = useMemo(() => {
    if (!startKg || !targetKg || !dayCount || dayCount <= 0) return 0;
    return Number(((targetKg - startKg) / (dayCount / 7)).toFixed(2));
  }, [startKg, targetKg, dayCount]);

  const startMutation = useMutation({
    mutationFn: () => {
      if (tab === 'blueprints') {
        const bp = BLUEPRINTS.find((b) => b.id === blueprintId)!;
        return api.startJourney({
          blueprint: bp.id,
          name: bp.name,
          mode: bp.mode,
          duration_days: bp.durationDays,
          start_weight_kg: startKg || undefined,
          target_weight_kg: startKg ? round1(startKg + bp.targetDeltaKg) : undefined,
        });
      }
      const length = Math.round(dayCount ?? 0);
      return api.startJourney({
        name: name.trim() || `${length}-Day ${mode} Plan`,
        mode,
        duration_days: length,
        start_weight_kg: startKg || undefined,
        target_weight_kg: targetKg || undefined,
      });
    },
    onSuccess: async () => {
      haptics.success();
      // A new journey reshapes targets, today's session and the dashboard, so refresh everything.
      await Promise.all([queryClient.invalidateQueries(), refreshUser()]);
      router.back();
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't start plan", extractErrorMessage(err));
    },
  });

  const submit = () => {
    if (tab === 'custom' && (!dayCount || dayCount < MIN_PLAN_DAYS || dayCount > MAX_PLAN_DAYS)) {
      haptics.error();
      Alert.alert('Check plan length', `Plan length must be between ${MIN_PLAN_DAYS} and ${MAX_PLAN_DAYS} days.`);
      return;
    }
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

  const onModeChange = (m: JourneyMode) => {
    setMode(m);
    if (startKg) setTargetWeight(String(round1(startKg + MODE_TARGET_DELTA[m])));
  };

  const weightIcon = <Scale size={18} color={colors.primaryLight} />;

  return (
    <SheetScreen
      title="Choose your plan"
      subtitle="Mode, length & goal weight"
      footer={
        <Button
          title="Start this plan"
          size="lg"
          icon={<Play size={18} color="#FFFFFF" />}
          iconPosition="left"
          loading={startMutation.isPending}
          onPress={submit}
        />
      }
    >
      <ChipGroup
        options={[
          { value: 'blueprints', label: 'Blueprints' },
          { value: 'custom', label: 'Custom' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'blueprints' ? (
        <>
          {BLUEPRINTS.map((bp) => {
            const selected = bp.id === blueprintId;
            return (
              <PressableScale
                key={bp.id}
                haptic="selection"
                scaleTo={0.98}
                onPress={() => setBlueprintId(bp.id)}
                style={[styles.bpCard, selected && styles.bpCardSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={bp.name}
              >
                <View style={styles.bpHeader}>
                  <View style={[styles.bpMode, { backgroundColor: `${colors[bp.color]}1F` }]}>
                    <bp.Icon size={13} color={colors[bp.color]} />
                    <Text style={[styles.bpModeText, { color: colors[bp.color] }]}>{bp.modeLabel}</Text>
                  </View>
                  <Text style={styles.bpDuration}>{bp.durationDays} days</Text>
                </View>
                <Text style={styles.bpName}>{bp.name}</Text>
                <Text style={styles.bpDesc}>{bp.description}</Text>
                <Text style={styles.bpPacing}>Pacing: {bp.pacing}</Text>
              </PressableScale>
            );
          })}
          <Input
            label="Current weight (kg)"
            placeholder="e.g. 77.5"
            keyboardType="decimal-pad"
            value={startWeight}
            onChangeText={setStartWeight}
            leftIcon={weightIcon}
            containerStyle={styles.spaced}
          />
        </>
      ) : (
        <>
          <ChipGroup label="Mode" options={MODE_OPTIONS} value={mode} onChange={onModeChange} />
          <Input
            label="Plan name (optional)"
            placeholder={`e.g. My ${days || 60}-Day ${mode} Journey`}
            value={name}
            onChangeText={setName}
          />
          <Input
            label={`Plan length (${MIN_PLAN_DAYS}–${MAX_PLAN_DAYS} days)`}
            keyboardType="number-pad"
            value={days}
            onChangeText={setDays}
          />
          <ChipGroup options={DURATION_PRESETS} value={dayCount} onChange={(d) => setDays(String(d))} />
          <View style={styles.row}>
            <Input
              label="Start weight (kg)"
              keyboardType="decimal-pad"
              value={startWeight}
              onChangeText={setStartWeight}
              containerStyle={styles.half}
            />
            <Input
              label="Target weight (kg)"
              keyboardType="decimal-pad"
              value={targetWeight}
              onChangeText={setTargetWeight}
              containerStyle={styles.half}
            />
          </View>
          <View style={styles.velocity}>
            {velocity < 0 ? (
              <TrendingDown size={18} color={colors.rose} />
            ) : velocity > 0 ? (
              <TrendingUp size={18} color={colors.primaryLight} />
            ) : (
              <Activity size={18} color={colors.cyan} />
            )}
            <Text style={styles.velocityText}>
              Target pace <Text style={styles.velocityStrong}>{velocity > 0 ? `+${velocity}` : velocity} kg/week</Text>
              {mode === 'CUT' && velocity < -1 ? '  ⚠️ Fast — risks muscle loss' : ''}
              {mode === 'BULK' && velocity > 0.55 ? '  ⚠️ High surplus — risks fat gain' : ''}
            </Text>
          </View>
        </>
      )}

      <Text style={styles.note}>
        Switching plans archives your previous journey. Your workouts, weigh-ins and records stay in your history.
      </Text>
    </SheetScreen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  bpCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  bpCardSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySurface,
  },
  bpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bpMode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  bpModeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bpDuration: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
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
    marginTop: 4,
    lineHeight: 18,
  },
  bpPacing: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  spaced: {
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  velocity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  velocityText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  velocityStrong: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: spacing.lg,
  },
}));
