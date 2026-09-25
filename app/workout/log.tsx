import React, { useEffect, useState } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Pencil, Plus, Sparkles } from 'lucide-react-native';
import { api, extractErrorMessage, type WorkoutSessionPayload } from '../../src/api/client';
import { Button, Card, DateNavigator, Input, PressableScale, SheetScreen, useToast } from '../../src/components/ui';
import { makeStyles, radius, spacing, useTheme } from '../../src/theme';
import {
  formatRelativeDay,
  formatVolume,
  getDateProgramDayNumber,
  isValidDateKey,
  parseDateKey,
  parseNumberInput,
  shiftDateKey,
  toDateKey,
} from '../../src/lib/format';
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
import { CardioLogModal } from '../../src/features/workout/CardioLogModal';
import { ExerciseCard } from '../../src/features/workout/ExerciseCard';
import { ExercisePicker } from '../../src/features/workout/ExercisePicker';
import { RoutinePicker } from '../../src/features/workout/RoutinePicker';
import { RestTimerBar, formatClock, useNow, useRestTimer } from '../../src/features/workout/RestTimer';
import type { WorkoutSession } from '../../src/types';

const loggedReps = (reps: string) => (parseNumberInput(reps) ?? 0) > 0;

export default function LogWorkoutScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const params = useLocalSearchParams<{
    plan?: string;
    date?: string;
    edit?: string;
    resume?: string;
    routineId?: string;
    planDay?: string;
  }>();
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
  const [live, setLive] = useState(initial?.live ?? (!editId && (params.date ? params.date === todayKey : true)));
  const [startedAt, setStartedAt] = useState(() => initial?.startedAt ?? Date.now());
  const [routineId, setRoutineId] = useState<string | null>(initial?.routineId ?? params.routineId ?? null);
  const [exercises, setExercises] = useState<DraftExercise[]>(initial?.exercises ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [routinePickerOpen, setRoutinePickerOpen] = useState(false);
  const [cardioExercise, setCardioExercise] = useState<string | null>(null);
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

  const planQuery = useQuery({
    queryKey: ['workoutPlan'],
    queryFn: () => api.getWorkoutPlan(),
  });

  const todayQuery = useQuery({
    queryKey: ['todaysWorkout'],
    queryFn: () => api.getTodaysWorkout(),
    enabled: usePlan,
  });
  const planDay = todayQuery.data?.today;
  const routine = planDay?.routine_details;
  const program = planQuery.data?.program || todayQuery.data?.program;

  const sessionQuery = useQuery({
    queryKey: ['workoutSession', editId],
    queryFn: () => api.getWorkoutSession(editId!),
    enabled: !!editId,
  });
  const session = sessionQuery.data;

  // 2. One-time prefill from plan, routineId param, or from the session being edited
  if (!prefilled && ready) {
    if (params.routineId && planQuery.data?.days) {
      const matchDay = planQuery.data.days.find(
        (d) => d.routine === params.routineId || d.routine_details?.id === params.routineId
      );
      if (matchDay?.routine_details) {
        setPrefilled(true);
        setTitle(matchDay.routine_details.name || matchDay.label || 'Workout');
        setExercises((matchDay.routine_details.exercises ?? []).map(exerciseFromRoutine));
        setRoutineId(matchDay.routine_details.id);
      }
    } else if (usePlan && routine) {
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

  const handleLoadRoutine = (r: { id: string; name: string; exercises?: any[] }) => {
    setTitle(r.name);
    setRoutineId(r.id);
    if (r.exercises && r.exercises.length > 0) {
      setExercises(r.exercises.map(exerciseFromRoutine));
    }
    toast({ message: `Loaded routine "${r.name}"` });
  };

  const handleCopySession = (s: WorkoutSession) => {
    setTitle(s.title || 'Workout Session');
    if (s.routine) {
      setRoutineId(s.routine);
    }
    const exs = exercisesFromSession(s);
    setExercises(exs);
    toast({ message: `Copied ${exs.length} exercises from past session` });
  };

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

  // Links routine so program advances regardless of whether logged today or backdated.
  const linkRoutine = !editId ? routineId : null;

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

      {/* Quick date shortcuts */}
      <View style={styles.quickDateRow}>
        {[
          { label: 'Today', key: todayKey },
          { label: 'Yesterday', key: shiftDateKey(todayKey, -1) },
          { label: '2d ago', key: shiftDateKey(todayKey, -2) },
          { label: '3d ago', key: shiftDateKey(todayKey, -3) },
        ].map((item) => {
          const isSelected = date === item.key;
          const dObj = parseDateKey(item.key);
          const dateStr = dObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
          const pillProgDay = getDateProgramDayNumber(
            program?.start_date,
            item.key,
            program?.duration_days
          );
          return (
            <PressableScale
              key={item.key}
              haptic="selection"
              onPress={() => {
                setDate(item.key);
                if (item.key !== todayKey) {
                  setLive(false);
                }
              }}
              style={[styles.quickDatePill, isSelected && styles.quickDatePillActive]}
            >
              <Text style={[styles.quickDateText, isSelected && styles.quickDateTextActive]}>
                {item.label}
              </Text>
              <Text style={[styles.quickDateSubtext, isSelected && styles.quickDateSubtextActive]}>
                {pillProgDay ? `D${pillProgDay} · ` : ''}{dateStr}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {!isToday && (
        <View style={styles.pastDateBanner}>
          <Clock size={14} color={colors.amber} />
          <Text style={styles.pastDateBannerText}>
            Logging past workout: {(() => {
              const progDayNum = getDateProgramDayNumber(
                program?.start_date,
                date,
                program?.duration_days
              );
              const dObj = parseDateKey(date);
              const formattedDate = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              return `${progDayNum ? `Day ${progDayNum} · ` : ''}${formatRelativeDay(dObj.toISOString())} (${formattedDate})`;
            })()}
          </Text>
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
        <Card elevated style={styles.emptyCard}>
          <Text style={styles.emptyCardTitle}>No exercises added</Text>
          <Text style={styles.emptyCardDesc}>
            Load a scheduled routine from your plan, pick from your routines, or add exercises manually.
          </Text>
          <View style={styles.emptyCardActions}>
            <Button
              title="Load routine / plan"
              icon={<Sparkles size={16} color="#FFFFFF" />}
              iconPosition="left"
              onPress={() => setRoutinePickerOpen(true)}
              style={{ flex: 1 }}
            />
            <Button
              title="Add exercise"
              variant="outline"
              icon={<Plus size={16} color={colors.primaryLight} />}
              iconPosition="left"
              onPress={() => setPickerOpen(true)}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      )}

      {exercises.length > 0 && (
        <View style={styles.exerciseActionRow}>
          <Button
            title="Add exercise"
            variant="outline"
            icon={<Plus size={18} color={colors.primaryLight} />}
            iconPosition="left"
            onPress={() => setPickerOpen(true)}
            style={{ flex: 1 }}
          />
          <Button
            title="Load routine"
            variant="secondary"
            icon={<Sparkles size={16} color={colors.cyan} />}
            iconPosition="left"
            onPress={() => setRoutinePickerOpen(true)}
            style={{ flex: 1 }}
          />
        </View>
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

      <ExercisePicker
        visible={pickerOpen}
        selectedIds={exerciseIds}
        onClose={() => setPickerOpen(false)}
        onPick={(e) => {
          setPickerOpen(false);
          // Time-based exercises (treadmill, cycling, etc.) have no reps/weight to log —
          // they're logged as a cardio session instead of added as a set-tracking row.
          if (e.muscleSlug === 'cardio') {
            setCardioExercise(e.name);
            return;
          }
          setExercises((list) => [
            ...list,
            { key: nextKey(), exerciseId: e.id, name: e.name, muscle: e.muscle, restSeconds: 90, sets: [newSet(), newSet(), newSet()] },
          ]);
        }}
      />

      <RoutinePicker
        visible={routinePickerOpen}
        onClose={() => setRoutinePickerOpen(false)}
        onSelectRoutine={handleLoadRoutine}
        onSelectSession={handleCopySession}
        activeRoutineId={routineId}
      />

      <CardioLogModal
        visible={cardioExercise !== null}
        date={date}
        exerciseName={cardioExercise ?? undefined}
        onClose={() => setCardioExercise(null)}
        onSaved={() => {
          setCardioExercise(null);
          toast({ message: 'Cardio session logged' });
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
  quickDateRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  quickDatePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDatePillActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryLight,
  },
  quickDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  quickDateTextActive: {
    color: colors.primaryLight,
    fontWeight: '800',
  },
  quickDateSubtext: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 1,
  },
  quickDateSubtextActive: {
    color: colors.primaryLight,
  },
  pastDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    marginBottom: spacing.sm,
  },
  pastDateBannerText: {
    fontSize: 12,
    color: colors.amber,
    fontWeight: '600',
  },
  emptyCard: {
    padding: spacing.md,
    gap: spacing.xs,
    marginVertical: spacing.md,
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyCardDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  emptyCardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  exerciseActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
}));
