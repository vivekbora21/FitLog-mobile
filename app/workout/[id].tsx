import React from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Trash2, Check, Pencil } from 'lucide-react-native';
import { api, extractErrorMessage } from '../../src/api/client';
import { Button, Card, ErrorState, PressableScale, ScreenSkeleton, useToast } from '../../src/components/ui';
import { radius, spacing, makeStyles, useTheme } from '../../src/theme';
import type { WorkoutSession } from '../../src/types';
import { formatDuration, formatVolume, toDateKey } from '../../src/lib/format';
import { invalidateTrackingData } from '../../src/lib/queries';
import { haptics } from '../../src/lib/haptics';
import { isCardioExercise } from '../../src/features/workout/draft';

const SET_TYPE_LABEL: Record<string, string> = { WARMUP: 'Warm-up', DROP: 'Drop', FAILURE: 'Failure' };

export default function WorkoutDetailScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: session, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['workoutSession', id],
    queryFn: () => api.getWorkoutSession(id),
    // Seed from the history list so the screen renders instantly.
    placeholderData: () =>
      queryClient
        .getQueriesData<{ pages: { results: WorkoutSession[] }[] }>({ queryKey: ['workoutSessions'] })
        .flatMap(([, d]) => d?.pages?.flatMap((p) => p.results) ?? [])
        .find((s) => s.id === id),
  });

  const { data: cardioEntries = [] } = useQuery({
    queryKey: ['cardioEntries'],
    queryFn: () => api.getCardioEntries(),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteWorkoutSession(id),
    onSuccess: async () => {
      haptics.success();
      await invalidateTrackingData(queryClient);
      toast({ message: 'Workout deleted' });
      router.back();
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't delete workout", extractErrorMessage(err));
    },
  });

  const confirmDelete = () => {
    haptics.warning();
    Alert.alert('Delete this workout?', 'Its sets and volume will be removed from your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  const header = (
    <View style={styles.topBar}>
      <PressableScale haptic="selection" onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
        <ChevronLeft size={22} color={colors.textPrimary} />
      </PressableScale>
      <Text style={styles.topTitle}>Workout</Text>
      {session ? (
        <PressableScale
          haptic="selection"
          onPress={() => router.push({ pathname: '/workout/log', params: { edit: id } })}
          style={styles.backBtn}
          accessibilityLabel="Edit workout"
        >
          <Pencil size={18} color={colors.primaryLight} />
        </PressableScale>
      ) : (
        <View style={styles.backBtn} />
      )}
    </View>
  );

  if (isLoading && !session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {header}
        <ScreenSkeleton />
      </SafeAreaView>
    );
  }

  if ((isError && !session) || !session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {header}
        <ErrorState
          title="Couldn't load workout"
          message={extractErrorMessage(error)}
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      </SafeAreaView>
    );
  }

  const started = session.started_at ? new Date(session.started_at) : null;
  const totalSets = session.exercises?.reduce((n, ex) => n + (ex.sets?.length || 0), 0) ?? 0;
  const cardioMinutes = started
    ? cardioEntries
        .filter((c) => c.date === toDateKey(started))
        .reduce((sum, c) => sum + c.duration_minutes, 0)
    : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(320)}>
          <Text style={styles.title}>{session.title || 'Workout Session'}</Text>
          {started && (
            <Text style={styles.date}>
              {started.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {' · '}
              {started.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).duration(320)} style={styles.statsRow}>
          <Stat label="Volume" value={formatVolume(session.total_volume_kg)} />
          <Stat label="Duration" value={formatDuration(session.duration_seconds) ?? '--'} />
          <Stat label="Sets" value={String(totalSets)} />
          {cardioMinutes > 0 && <Stat label="Cardio" value={`${cardioMinutes} min`} />}
          {session.total_calories ? <Stat label="Calories" value={`${session.total_calories} kcal`} /> : null}
        </Animated.View>

        {session.notes ? (
          <Animated.View entering={FadeInDown.delay(130).duration(300)}>
            <Card style={styles.notesCard}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{session.notes}</Text>
            </Card>
          </Animated.View>
        ) : null}

        {(session.exercises ?? []).map((ex, i) => {
          const isCardio = isCardioExercise(ex.exercise_name, ex.primary_muscle);
          return (
            <Animated.View key={ex.id ?? i} entering={FadeInDown.delay(150 + i * 45).duration(300)}>
              <Card style={styles.exerciseCard}>
                <View style={styles.exerciseHeaderRow}>
                  <Text style={styles.exerciseName}>{ex.exercise_name}</Text>
                  {isCardio && (
                    <View style={styles.cardioBadge}>
                      <Text style={styles.cardioBadgeText}>Cardio</Text>
                    </View>
                  )}
                </View>
                {ex.primary_muscle ? <Text style={styles.exerciseMuscle}>{ex.primary_muscle}</Text> : null}
                {(ex.sets ?? []).map((s) => {
                  const isCardioSet = isCardio || !!s.duration_seconds || s.incline_percent !== null && s.incline_percent !== undefined;
                  const cardioText = isCardioSet
                    ? [
                        s.duration_seconds ? `${Math.round(s.duration_seconds / 60)} min` : null,
                        s.incline_percent !== null && s.incline_percent !== undefined ? `${s.incline_percent}% Incline` : null,
                        s.speed_kmh ? `${s.speed_kmh} km/h` : null,
                        s.intensity || null,
                        s.calories ? `${s.calories} kcal` : null,
                      ].filter(Boolean).join(' · ') || (s.reps ? `${s.reps} min` : 'Completed')
                    : `${s.weight_kg} kg × ${s.reps}`;

                  return (
                    <View key={s.id ?? s.set_number} style={styles.setRow}>
                      <Text style={styles.setNum}>
                        {isCardioSet
                          ? `Interval ${s.set_number}`
                          : s.set_type && s.set_type !== 'NORMAL'
                          ? SET_TYPE_LABEL[s.set_type]
                          : `Set ${s.set_number}`}
                      </Text>
                      <Text style={styles.setValue}>{cardioText}</Text>
                      {s.completed ? (
                        <Check size={16} color={colors.primaryLight} strokeWidth={3} />
                      ) : (
                        <View style={styles.checkPlaceholder} />
                      )}
                    </View>
                  );
                })}
              </Card>
            </Animated.View>
          );
        })}

        {(session.exercises?.length ?? 0) === 0 && (
          <Text style={styles.emptyText}>No exercises were recorded for this session.</Text>
        )}

        <Animated.View entering={FadeInDown.delay(200 + (session.exercises?.length ?? 0) * 45).duration(300)}>
          <Button
            title="Delete workout"
            variant="secondary"
            icon={<Trash2 size={18} color={colors.error} />}
            iconPosition="left"
            loading={deleteMutation.isPending}
            onPress={confirmDelete}
            textStyle={{ color: colors.error }}
            style={styles.deleteBtn}
          />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  notesCard: {
    padding: spacing.md,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  exerciseCard: {
    padding: spacing.md,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardioBadge: {
    backgroundColor: colors.primarySurface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  cardioBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryLight,
    textTransform: 'uppercase',
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  exerciseMuscle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  setNum: {
    width: 60,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  setValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  checkPlaceholder: {
    width: 16,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  deleteBtn: {
    marginTop: spacing.xl,
    borderColor: colors.errorBorder,
    backgroundColor: colors.errorBackground,
  },
}));
