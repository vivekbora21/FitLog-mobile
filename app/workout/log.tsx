import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Search, Trash2, X, Clock } from 'lucide-react-native';
import { api, extractErrorMessage } from '../../src/api/client';
import { Button, DateNavigator, Input, PressableScale, SheetScreen } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';
import type { RoutineExercise } from '../../src/types';
import { isValidDateKey, parseDateKey, parseNumberInput, toDateKey } from '../../src/lib/format';
import { invalidateTrackingData } from '../../src/lib/queries';
import { haptics } from '../../src/lib/haptics';

interface DraftSet {
  key: string;
  weight: string;
  reps: string;
  done: boolean;
}

interface DraftExercise {
  key: string;
  exerciseId: string;
  name: string;
  restSeconds: number;
  sets: DraftSet[];
}

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

const newSet = (weight = '', reps = ''): DraftSet => ({ key: nextKey(), weight, reps, done: false });

/** "8-10" → "8", "12" → "12", "AMRAP" → "". */
function firstRepNumber(targetReps?: string): string {
  const m = targetReps?.match(/\d+/);
  return m ? m[0] : '';
}

function fromRoutine(ex: RoutineExercise): DraftExercise {
  const weight = ex.progression?.recommended_weight_kg ?? ex.suggested_weight_kg;
  const reps = firstRepNumber(ex.target_reps);
  return {
    key: nextKey(),
    exerciseId: ex.exercise,
    name: ex.exercise_name,
    restSeconds: ex.rest_seconds || 90,
    sets: Array.from({ length: Math.max(1, ex.target_sets || 1) }, () =>
      newSet(weight ? String(weight) : '', reps)
    ),
  };
}

export default function LogWorkoutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ plan?: string; date?: string }>();
  const usePlan = params.plan === '1';

  const [date, setDate] = useState(() => (isValidDateKey(params.date) ? params.date : toDateKey(new Date())));
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('45');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const prefilled = useRef(false);

  const todayQuery = useQuery({
    queryKey: ['todaysWorkout'],
    queryFn: () => api.getTodaysWorkout(),
    enabled: usePlan,
  });
  const planDay = todayQuery.data?.today;
  const routine = planDay?.routine_details;

  useEffect(() => {
    if (!usePlan || prefilled.current || !routine) return;
    prefilled.current = true;
    setTitle(routine.name || planDay?.label || 'Workout');
    setExercises((routine.exercises ?? []).map(fromRoutine));
  }, [usePlan, routine, planDay?.label]);

  const trimmedSearch = search.trim();
  const exerciseSearch = useQuery({
    queryKey: ['exerciseSearch', trimmedSearch],
    queryFn: () => api.searchExercises(trimmedSearch),
    enabled: pickerOpen && trimmedSearch.length >= 2,
  });

  const updateExercise = (key: string, fn: (ex: DraftExercise) => DraftExercise) =>
    setExercises((list) => list.map((ex) => (ex.key === key ? fn(ex) : ex)));

  const updateSet = (exKey: string, setKey: string, patch: Partial<DraftSet>) =>
    updateExercise(exKey, (ex) => ({
      ...ex,
      sets: ex.sets.map((s) => (s.key === setKey ? { ...s, ...patch } : s)),
    }));

  const isToday = date === toDateKey(new Date());
  // Only a session logged today can complete today's plan day; the server advances the program on save.
  const linkRoutine = usePlan && isToday && planDay?.status !== 'COMPLETED' ? planDay?.routine ?? null : null;

  const saveMutation = useMutation({
    mutationFn: () => {
      const minutes = Math.max(1, Math.round(parseNumberInput(duration) ?? 45));
      const end = isToday ? new Date() : (() => {
        const d = parseDateKey(date);
        d.setHours(18, 0, 0, 0);
        return d;
      })();
      const start = new Date(end.getTime() - minutes * 60_000);

      const payloadExercises = exercises
        .map((ex, i) => ({
          exercise: ex.exerciseId,
          order: i + 1,
          rest_seconds: ex.restSeconds,
          notes: '',
          sets: ex.sets
            .filter((s) => (parseNumberInput(s.reps) ?? 0) > 0)
            .map((s, si) => ({
              set_number: si + 1,
              set_type: 'NORMAL' as const,
              weight_kg: parseNumberInput(s.weight) ?? 0,
              reps: Math.round(parseNumberInput(s.reps) ?? 0),
              completed: s.done,
            })),
        }))
        .filter((ex) => ex.sets.length > 0);

      return api.createWorkoutSession({
        title: title.trim() || 'Workout',
        routine: linkRoutine,
        started_at: start.toISOString(),
        duration_seconds: minutes * 60,
        notes: notes.trim(),
        exercises: payloadExercises,
      });
    },
    onSuccess: async () => {
      haptics.success();
      await invalidateTrackingData(queryClient);
      router.back();
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't save workout", extractErrorMessage(err));
    },
  });

  const onSave = () => {
    const loggedSets = exercises.reduce(
      (n, ex) => n + ex.sets.filter((s) => (parseNumberInput(s.reps) ?? 0) > 0).length,
      0
    );
    if (exercises.length > 0 && loggedSets === 0) {
      Alert.alert('No sets entered', 'Enter reps for at least one set, or remove the empty exercises.');
      return;
    }
    const unchecked = exercises.some((ex) =>
      ex.sets.some((s) => (parseNumberInput(s.reps) ?? 0) > 0 && !s.done)
    );
    if (unchecked) {
      Alert.alert(
        'Some sets are not ticked',
        'Only ticked sets count toward personal records. Save anyway?',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Save', onPress: () => saveMutation.mutate() },
        ]
      );
      return;
    }
    saveMutation.mutate();
  };

  if (usePlan && todayQuery.isLoading) {
    return (
      <SheetScreen title="Log workout">
        <ActivityIndicator color={colors.primaryLight} />
      </SheetScreen>
    );
  }

  return (
    <SheetScreen
      title="Log workout"
      subtitle={linkRoutine ? "Completes today's planned session" : undefined}
      footer={<Button title="Finish & save" size="lg" loading={saveMutation.isPending} onPress={onSave} />}
    >
      <DateNavigator date={date} onChange={setDate} />

      <Input label="Workout name" placeholder="e.g. Push day" value={title} onChangeText={setTitle} />
      <Input
        label="Duration (minutes)"
        keyboardType="number-pad"
        value={duration}
        onChangeText={setDuration}
        leftIcon={<Clock size={18} color={colors.amber} />}
      />

      {exercises.map((ex, exIndex) => (
        <View key={ex.key} style={styles.exerciseCard}>
          <View style={styles.exerciseHeader}>
            <Text style={styles.exerciseIndex}>{exIndex + 1}</Text>
            <Text style={styles.exerciseName} numberOfLines={2}>
              {ex.name}
            </Text>
            <PressableScale
              haptic="selection"
              onPress={() => setExercises((list) => list.filter((e) => e.key !== ex.key))}
              style={styles.iconBtn}
              accessibilityLabel={`Remove ${ex.name}`}
            >
              <Trash2 size={16} color={colors.textMuted} />
            </PressableScale>
          </View>

          <View style={styles.setHeaderRow}>
            <Text style={[styles.setHeader, styles.setCol]}>Set</Text>
            <Text style={[styles.setHeader, styles.inputCol]}>kg</Text>
            <Text style={[styles.setHeader, styles.inputCol]}>Reps</Text>
            <Text style={[styles.setHeader, styles.doneCol]}>Done</Text>
          </View>

          {ex.sets.map((s, si) => (
            <View key={s.key} style={[styles.setRow, s.done && styles.setRowDone]}>
              <Text style={[styles.setNumber, styles.setCol]}>{si + 1}</Text>
              <TextInput
                style={[styles.setInput, styles.inputCol]}
                value={s.weight}
                onChangeText={(weight) => updateSet(ex.key, s.key, { weight })}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primaryLight}
                accessibilityLabel={`${ex.name} set ${si + 1} weight in kilograms`}
              />
              <TextInput
                style={[styles.setInput, styles.inputCol]}
                value={s.reps}
                onChangeText={(reps) => updateSet(ex.key, s.key, { reps })}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primaryLight}
                accessibilityLabel={`${ex.name} set ${si + 1} reps`}
              />
              <View style={styles.doneCol}>
                <PressableScale
                  haptic="light"
                  onPress={() => updateSet(ex.key, s.key, { done: !s.done })}
                  style={[styles.doneBtn, s.done && styles.doneBtnActive]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: s.done }}
                  accessibilityLabel={`Mark set ${si + 1} done`}
                >
                  <Check size={16} color={s.done ? colors.textInverse : colors.textMuted} strokeWidth={3} />
                </PressableScale>
              </View>
            </View>
          ))}

          <View style={styles.setActions}>
            <PressableScale
              haptic="selection"
              onPress={() =>
                updateExercise(ex.key, (e) => {
                  const last = e.sets[e.sets.length - 1];
                  return { ...e, sets: [...e.sets, newSet(last?.weight, last?.reps)] };
                })
              }
              style={styles.setActionBtn}
              accessibilityLabel={`Add set to ${ex.name}`}
            >
              <Plus size={14} color={colors.primaryLight} />
              <Text style={styles.setActionText}>Add set</Text>
            </PressableScale>
            {ex.sets.length > 1 && (
              <PressableScale
                haptic="selection"
                onPress={() => updateExercise(ex.key, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}
                style={styles.setActionBtn}
                accessibilityLabel={`Remove last set from ${ex.name}`}
              >
                <X size={14} color={colors.textSecondary} />
                <Text style={[styles.setActionText, { color: colors.textSecondary }]}>Remove set</Text>
              </PressableScale>
            )}
          </View>
        </View>
      ))}

      {pickerOpen ? (
        <View style={styles.pickerCard}>
          <Input
            placeholder="Search exercises (e.g. bench, squat)"
            value={search}
            onChangeText={setSearch}
            autoFocus
            autoCorrect={false}
            leftIcon={<Search size={18} color={colors.textMuted} />}
            rightIcon={
              <PressableScale
                haptic="selection"
                onPress={() => {
                  setPickerOpen(false);
                  setSearch('');
                }}
                accessibilityLabel="Close exercise search"
              >
                <X size={18} color={colors.textMuted} />
              </PressableScale>
            }
            containerStyle={styles.pickerInput}
          />
          {exerciseSearch.isFetching && <ActivityIndicator color={colors.primaryLight} />}
          {trimmedSearch.length < 2 ? (
            <Text style={styles.pickerHint}>Type at least 2 letters to search.</Text>
          ) : (
            (exerciseSearch.data ?? []).slice(0, 12).map((e) => (
              <PressableScale
                key={e.id}
                haptic="selection"
                onPress={() => {
                  setExercises((list) => [
                    ...list,
                    { key: nextKey(), exerciseId: e.id, name: e.name, restSeconds: 90, sets: [newSet(), newSet(), newSet()] },
                  ]);
                  setPickerOpen(false);
                  setSearch('');
                }}
                style={styles.pickerRow}
                accessibilityLabel={`Add ${e.name}`}
              >
                <View style={styles.flex}>
                  <Text style={styles.pickerName}>{e.name}</Text>
                  {e.primary_muscle_name ? <Text style={styles.pickerMeta}>{e.primary_muscle_name}</Text> : null}
                </View>
                <Plus size={18} color={colors.primaryLight} />
              </PressableScale>
            ))
          )}
          {trimmedSearch.length >= 2 && !exerciseSearch.isFetching && exerciseSearch.data?.length === 0 && (
            <Text style={styles.pickerHint}>No exercises match &quot;{trimmedSearch}&quot;.</Text>
          )}
        </View>
      ) : (
        <Button
          title="Add exercise"
          variant="outline"
          icon={<Plus size={18} color={colors.primaryLight} />}
          iconPosition="left"
          onPress={() => setPickerOpen(true)}
          style={styles.addExerciseBtn}
        />
      )}

      <Input
        label="Notes"
        placeholder="How did it feel?"
        value={notes}
        onChangeText={setNotes}
        multiline
        style={styles.notes}
        containerStyle={styles.notesContainer}
      />
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  exerciseIndex: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySurface,
    color: colors.primaryLight,
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 26,
    overflow: 'hidden',
  },
  exerciseName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: 4,
  },
  setHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  setRowDone: {
    backgroundColor: colors.primarySurface,
  },
  setCol: {
    width: 32,
  },
  inputCol: {
    flex: 1,
  },
  doneCol: {
    width: 52,
    alignItems: 'center',
  },
  setNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  setInput: {
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  doneBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  setActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  setActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
  },
  setActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  pickerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  pickerInput: {
    marginBottom: spacing.xs,
  },
  pickerHint: {
    fontSize: 12,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pickerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pickerMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  addExerciseBtn: {
    marginBottom: spacing.lg,
  },
  notes: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  notesContainer: {
    marginBottom: 0,
  },
});
