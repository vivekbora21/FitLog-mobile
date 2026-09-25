import React, { useEffect, useState } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Pencil, Plus } from 'lucide-react-native';
import { api, extractErrorMessage, type WorkoutSessionPayload } from '../../src/api/client';
import { Button, DateNavigator, Input, PressableScale, SheetScreen, useToast } from '../../src/components/ui';
import { makeStyles, radius, spacing, useTheme } from '../../src/theme';
import { formatRelativeDay, formatVolume, isValidDateKey, parseDateKey, parseNumberInput, toDateKey } from '../../src/lib/format';
import { invalidateTrackingData } from '../../src/lib/queries';
import { haptics } from '../../src/lib/haptics';
import {
  clearWorkoutDraft,
  draftHasContent,
  exerciseFromRoutine,
  exercisesFromSession,
  loadWorkoutDraft,
  newSet,
  nextKey,
  saveWorkoutDraft,
  type DraftExercise,
  type WorkoutDraft,
} from '../../src/features/workout/draft';
import { ExerciseCard } from '../../src/features/workout/ExerciseCard';
import { ExercisePicker } from '../../src/features/workout/ExercisePicker';
import { RestTimerBar, formatClock, useNow, useRestTimer } from '../../src/features/workout/RestTimer';

const loggedReps = (reps: string) => (parseNumberInput(reps) ?? 0) > 0;

export default function LogWorkoutScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const params = useLocalSearchParams<{ plan?: string; date?: string; edit?: string; resume?: string }>();
  const editId = params.edit || null;
  const usePlan = params.plan === '1' && !editId;
  const todayKey = toDateKey(new Date());

  // A saved, unfinished workout is read synchronously so the form can start from it.
  const [savedDraft] = useState(() => (editId ? null : loadWorkoutDraft()));
  const hasDraft = !!savedDraft && draftHasContent(savedDraft);
  const resumeNow = hasDraft && params.resume === '1';
  const initial = resumeNow ? savedDraft : null;

  const [date, setDate] = useState(() => initial?.date ?? (isValidDateKey(params.date) ? params.date : todayKey));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [duration, setDuration] = useState(initial?.duration ?? '45');
  const [live, setLive] = useState(initial?.live ?? !editId);
  const [startedAt, setStartedAt] = useState(() => initial?.startedAt ?? Date.now());
  const [routineId, setRoutineId] = useState<string | null>(initial?.routineId ?? null);
  const [exercises, setExercises] = useState<DraftExercise[]>(initial?.exercises ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  // New workouts wait here until a saved draft has been resumed or discarded.
  const [ready, setReady] = useState(!!editId || !hasDraft || resumeNow);
  const [prefilled, setPrefilled] = useState(resumeNow);
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);

  const isToday = date === todayKey;
  const isLive = !editId && live && isToday;

  // 1. Offer to resume an unfinished workout before anything else.
  useEffect(() => {
    if (!savedDraft || !hasDraft || resumeNow) return;
    const resume = (d: WorkoutDraft) => {
      setPrefilled(true);
      setDate(d.date);
      setTitle(d.title);
      setNotes(d.notes);
      setDuration(d.duration);
      setLive(d.live);
      setStartedAt(d.startedAt);
      setRoutineId(d.routineId);
      setExercises(d.exercises);
      setReady(true);
    };
    Alert.alert(
      'Resume your workout?',
      `"${savedDraft.title || 'Workout'}" from ${formatRelativeDay(new Date(savedDraft.startedAt).toISOString()).toLowerCase()} isn't finished yet.`,
      [
        {
          text: 'Start fresh',
          style: 'destructive',
          onPress: () => {
            clearWorkoutDraft();
            setReady(true);
          },
        },
        { text: 'Resume', onPress: () => resume(savedDraft) },
      ],
      { cancelable: false }
    );
  }, [savedDraft, hasDraft, resumeNow]);

  const todayQuery = useQuery({
    queryKey: ['todaysWorkout'],
    queryFn: () => api.getTodaysWorkout(),
    enabled: usePlan,
  });
  const planDay = todayQuery.data?.today;
  const routine = planDay?.routine_details;

  const sessionQuery = useQuery({
    queryKey: ['workoutSession', editId],
    queryFn: () => api.getWorkoutSession(editId!),
    enabled: !!editId,
  });
  const session = sessionQuery.data;

  // 2. One-time prefill from today's plan or from the session being edited
  //    (state adjusted during render once the data arrives, not in an effect).
  if (!prefilled && ready) {
    if (usePlan && routine) {
      setPrefilled(true);
      setTitle(routine.name || planDay?.label || 'Workout');
      setExercises((routine.exercises ?? []).map(exerciseFromRoutine));
      if (planDay?.status !== 'COMPLETED') setRoutineId(planDay?.routine ?? null);
    } else if (session) {
      setPrefilled(true);
      const exs = exercisesFromSession(session);
      const d = toDateKey(new Date(session.started_at));
      const mins = String(Math.max(1, Math.round((session.duration_seconds || 0) / 60)));
      setDate(d);
      setTitle(session.title ?? '');
      setNotes(session.notes ?? '');
      setDuration(mins);
      setExercises(exs);
      setInitialSnapshot(JSON.stringify([d, session.title ?? '', session.notes ?? '', mins, exs]));
    }
  }

  // 3. Autosave new workouts on every change.
  useEffect(() => {
    if (editId || !ready) return;
    const draft = { date, startedAt, title, notes, duration, live, routineId, exercises };
    if (draftHasContent(draft)) saveWorkoutDraft(draft);
    else clearWorkoutDraft();
  }, [editId, ready, date, startedAt, title, notes, duration, live, routineId, exercises]);

  // "Last time" numbers for every exercise in the workout.
  const exerciseIds = [...new Set(exercises.map((e) => e.exerciseId))].sort();
  const lastQuery = useQuery({
    queryKey: ['lastPerformance', exerciseIds.join(','), editId],
    queryFn: () => api.getLastPerformance(exerciseIds, editId ?? undefined),
    enabled: exerciseIds.length > 0,
    placeholderData: keepPreviousData,
  });

  const restTimer = useRestTimer();

  const updateExercise = (key: string, fn: (ex: DraftExercise) => DraftExercise) =>
    setExercises((list) => list.map((ex) => (ex.key === key ? fn(ex) : ex)));

  const moveExercise = (index: number, delta: -1 | 1) =>
    setExercises((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  // Only a session logged today can complete today's plan day; the server advances the program on save.
  const linkRoutine = !editId && isToday ? routineId : null;

  const loggedSets = exercises.flatMap((ex) => ex.sets.filter((s) => loggedReps(s.reps)));
  const volume = exercises.reduce(
    (sum, ex) =>
      sum +
      ex.sets
        .filter((s) => s.done && s.type !== 'WARMUP')
        .reduce((v, s) => v + (parseNumberInput(s.weight) ?? 0) * (parseNumberInput(s.reps) ?? 0), 0),
    0
  );

  const buildPayload = (): Omit<WorkoutSessionPayload, 'routine'> => {
    let start: Date;
    let seconds: number;
    if (isLive) {
      start = new Date(startedAt);
      seconds = Math.max(60, Math.round((Date.now() - startedAt) / 1000));
    } else {
      const minutes = Math.max(1, Math.round(parseNumberInput(duration) ?? 45));
      seconds = minutes * 60;
      if (session && date === toDateKey(new Date(session.started_at))) {
        start = new Date(session.started_at);
      } else if (session) {
        // Moving an edited session to another day keeps its time of day.
        const original = new Date(session.started_at);
        start = parseDateKey(date);
        start.setHours(original.getHours(), original.getMinutes(), 0, 0);
      } else if (isToday) {
        start = new Date(Date.now() - seconds * 1000);
      } else {
        const end = parseDateKey(date);
        end.setHours(18, 0, 0, 0);
        start = new Date(end.getTime() - seconds * 1000);
      }
    }

    return {
      title: title.trim() || 'Workout',
      started_at: start.toISOString(),
      duration_seconds: seconds,
      notes: notes.trim(),
      exercises: exercises
        .map((ex, i) => ({
          exercise: ex.exerciseId,
          order: i + 1,
          rest_seconds: ex.restSeconds,
          notes: '',
          sets: ex.sets
            .filter((s) => loggedReps(s.reps))
            .map((s, si) => ({
              set_number: si + 1,
              set_type: s.type,
              weight_kg: parseNumberInput(s.weight) ?? 0,
              reps: Math.round(parseNumberInput(s.reps) ?? 0),
              completed: s.done,
            })),
        }))
        .filter((ex) => ex.sets.length > 0),
    };
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      editId
        ? api.updateWorkoutSession(editId, buildPayload())
        : api.createWorkoutSession({ ...buildPayload(), routine: linkRoutine }),
    onSuccess: async () => {
      haptics.success();
      if (!editId) clearWorkoutDraft();
      await invalidateTrackingData(queryClient);
      toast({ message: editId ? 'Workout updated' : 'Workout saved — nice work!' });
      router.back();
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't save workout", `${extractErrorMessage(err)}${editId ? '' : '\n\nYour workout is kept on this device.'}`);
    },
  });

  const onSave = () => {
    if (exercises.length > 0 && loggedSets.length === 0) {
      Alert.alert('No sets entered', 'Enter reps for at least one set, or remove the empty exercises.');
      return;
    }
    const unchecked = loggedSets.some((s) => !s.done);
    if (unchecked) {
      Alert.alert('Some sets are not ticked', 'Only ticked sets count toward volume and personal records. Save anyway?', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Save', onPress: () => saveMutation.mutate() },
      ]);
      return;
    }
    saveMutation.mutate();
  };

  const onClose = () => {
    if (editId) {
      const dirty =
        initialSnapshot !== null && initialSnapshot !== JSON.stringify([date, title, notes, duration, exercises]);
      if (!dirty) return router.back();
      Alert.alert('Discard changes?', 'Your edits to this workout will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }
    if (!draftHasContent({ exercises, title, notes })) {
      clearWorkoutDraft();
      return router.back();
    }
    Alert.alert('Leave this workout?', 'It stays saved on this device — resume it any time from the Workouts tab.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          clearWorkoutDraft();
          router.back();
        },
      },
      { text: 'Save for later', onPress: () => router.back() },
    ]);
  };

  const screenTitle = editId ? 'Edit workout' : 'Workout';
  const waiting = (usePlan && todayQuery.isLoading) || (!!editId && sessionQuery.isLoading) || !ready;

  if (waiting) {
    return (
      <SheetScreen title={screenTitle} onClose={() => router.back()}>
        <ActivityIndicator color={colors.primaryLight} />
      </SheetScreen>
    );
  }

  if (editId && sessionQuery.isError) {
    return (
      <SheetScreen title={screenTitle}>
        <Text style={styles.errorText}>{extractErrorMessage(sessionQuery.error)}</Text>
      </SheetScreen>
    );
  }

  return (
    <SheetScreen
      title={screenTitle}
      subtitle={linkRoutine ? "Completes today's planned session" : undefined}
      onClose={onClose}
      footer={
        <>
          <RestTimerBar timer={restTimer} />
          {loggedSets.length > 0 && (
            <Text style={styles.summary}>
              {loggedSets.length} {loggedSets.length === 1 ? 'set' : 'sets'} · {formatVolume(volume)}
            </Text>
          )}
          <Button
            title={editId ? 'Save changes' : 'Finish workout'}
            size="lg"
            loading={saveMutation.isPending}
            onPress={onSave}
          />
        </>
      }
    >
      {!editId && isToday && (
        <View style={styles.clockRow}>
          {isLive ? (
            <>
              <LiveClock startedAt={startedAt} />
              <PressableScale
                haptic="selection"
                onPress={() => {
                  setDuration(String(Math.max(1, Math.round((Date.now() - startedAt) / 60_000))));
                  setLive(false);
                }}
                style={styles.clockEdit}
                accessibilityLabel="Enter duration manually"
              >
                <Pencil size={14} color={colors.textSecondary} />
                <Text style={styles.clockEditText}>Set manually</Text>
              </PressableScale>
            </>
          ) : (
            <PressableScale
              haptic="selection"
              onPress={() => setLive(true)}
              style={styles.clockEdit}
              accessibilityLabel="Use the running workout clock"
            >
              <Clock size={14} color={colors.textSecondary} />
              <Text style={styles.clockEditText}>Use live timer</Text>
            </PressableScale>
          )}
        </View>
      )}

      <DateNavigator date={date} onChange={setDate} />

      <Input label="Workout name" placeholder="e.g. Push day" value={title} onChangeText={setTitle} />
      {!isLive && (
        <Input
          label="Duration (minutes)"
          keyboardType="number-pad"
          value={duration}
          onChangeText={setDuration}
          leftIcon={<Clock size={18} color={colors.amber} />}
        />
      )}

      {exercises.map((ex, i) => (
        <ExerciseCard
          key={ex.key}
          exercise={ex}
          index={i}
          count={exercises.length}
          last={lastQuery.data?.[ex.exerciseId]}
          onChange={(fn) => updateExercise(ex.key, fn)}
          onRemove={() => {
            const remove = () => setExercises((list) => list.filter((e) => e.key !== ex.key));
            if (!ex.sets.some((s) => s.done || s.reps || s.weight)) return remove();
            haptics.warning();
            Alert.alert(`Remove ${ex.name}?`, 'The sets you entered for it will be lost.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: remove },
            ]);
          }}
          onMove={(delta) => moveExercise(i, delta)}
          onSetCompleted={(rest) => restTimer.start(rest)}
        />
      ))}

      {exercises.length === 0 && (
        <Text style={styles.emptyHint}>Add your first exercise to start logging sets.</Text>
      )}

      <Button
        title="Add exercise"
        variant="outline"
        icon={<Plus size={18} color={colors.primaryLight} />}
        iconPosition="left"
        onPress={() => setPickerOpen(true)}
        style={styles.addExerciseBtn}
      />

      <Input
        label="Notes"
        placeholder="How did it feel?"
        value={notes}
        onChangeText={setNotes}
        multiline
        style={styles.notes}
        containerStyle={styles.notesContainer}
      />

      <ExercisePicker
        visible={pickerOpen}
        selectedIds={exerciseIds}
        onClose={() => setPickerOpen(false)}
        onPick={(e) => {
          setPickerOpen(false);
          setExercises((list) => [
            ...list,
            { key: nextKey(), exerciseId: e.id, name: e.name, muscle: e.muscle, restSeconds: 90, sets: [newSet(), newSet(), newSet()] },
          ]);
        }}
      />
    </SheetScreen>
  );
}

/** Isolated so the per-second tick doesn't re-render the whole logger. */
function LiveClock({ startedAt }: { startedAt: number }) {
  const styles = useStyles();
  const now = useNow(true, 1000);
  return (
    <View style={styles.clock} accessibilityLabel={`Workout time ${formatClock((now - startedAt) / 1000)}`}>
      <View style={styles.liveDot} />
      <Text style={styles.clockText}>{formatClock((now - startedAt) / 1000)}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
  },
  clockText: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  clockEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
  },
  clockEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  summary: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: spacing.lg,
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
  errorText: {
    fontSize: 14,
    color: colors.error,
  },
}));
