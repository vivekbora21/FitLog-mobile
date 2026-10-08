import React, { useState } from 'react';
import { View, Text, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Trophy, Dumbbell, Hash, Layers, Clock, Flame, Share2, Check } from 'lucide-react-native';
import { api, extractErrorMessage } from '../../src/api/client';
import { Button, ErrorState, Input, PressableScale, ScreenSkeleton, ChipGroup, SheetScreen, useToast } from '../../src/components/ui';
import { useTheme } from '../../src/theme';
import { formatDuration, formatVolume } from '../../src/lib/format';
import { invalidateTrackingData } from '../../src/lib/queries';
import { haptics } from '../../src/lib/haptics';
import { useStyles } from './complete.styles';

const RATING_OPTIONS = [
  { value: 4, label: 'Too Easy' },
  { value: 6, label: 'Easy' },
  { value: 7, label: 'Perfect' },
  { value: 8, label: 'Hard' },
  { value: 9, label: 'Too Hard' },
];

function StatTile({
  icon,
  tint,
  value,
  label,
}: {
  icon: React.ReactNode;
  tint: string;
  value: string;
  label: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function WorkoutCompleteScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const {
    data: session,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['workoutSession', id],
    queryFn: () => api.getWorkoutSession(id),
  });

  const noteValue = note ?? session?.notes ?? '';

  const saveMutation = useMutation({
    mutationFn: () => api.completeWorkoutSession(id, { overall_rpe: rating, notes: noteValue.trim() }),
    onSuccess: async () => {
      haptics.success();
      await invalidateTrackingData(queryClient);
      router.back();
    },
    onError: (err) => {
      haptics.error();
      toast({ message: extractErrorMessage(err) });
    },
  });

  const handleShare = async () => {
    if (!session) return;
    haptics.selection();
    const totalSets = session.exercises.reduce((n, ex) => n + ex.sets.length, 0);
    const durationLabel = formatDuration(session.duration_seconds) || `${Math.round(session.duration_seconds / 60)} min`;
    const message = `💪 Workout complete: ${session.title}\n${session.exercises.length} exercises · ${totalSets} sets · ${formatVolume(
      session.total_volume_kg
    )} · ${durationLabel}\nTracked with FitLog.`;
    try {
      await Share.share({ message, title: session.title });
    } catch {
      // User cancelled share
    }
  };

  if (isLoading) {
    return (
      <SheetScreen title="Workout Complete">
        <ScreenSkeleton />
      </SheetScreen>
    );
  }

  if (isError || !session) {
    return (
      <SheetScreen title="Workout Complete">
        <ErrorState title="Couldn't load workout" message={extractErrorMessage(error)} onRetry={refetch} />
      </SheetScreen>
    );
  }

  const totalSets = session.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const durationLabel = formatDuration(session.duration_seconds) || '< 1 min';

  return (
    <SheetScreen
      title="Workout Complete"
      subtitle={session.title}
      footer={
        <View style={styles.footerRow}>
          <PressableScale
            haptic="selection"
            onPress={handleShare}
            style={styles.shareBtn}
            accessibilityLabel="Share workout"
          >
            <Share2 size={16} color={colors.textSecondary} />
            <Text style={styles.shareBtnText}>Share</Text>
          </PressableScale>
          <Button
            title="Save"
            icon={<Check size={16} color="#FFFFFF" />}
            iconPosition="right"
            loading={saveMutation.isPending}
            onPress={() => saveMutation.mutate()}
            style={styles.saveBtn}
          />
        </View>
      }
    >
      <Animated.View entering={FadeInDown.duration(350)} style={styles.banner}>
        <View style={styles.trophyCircle}>
          <Trophy size={32} color={colors.primaryLight} strokeWidth={2.2} />
        </View>
        <Text style={styles.bannerTitle}>Workout Complete!</Text>
        <Text style={styles.bannerSubtitle}>{session.title}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(350)} style={styles.statGrid}>
        <StatTile
          icon={<Dumbbell size={16} color={colors.primaryLight} />}
          tint={colors.primarySurface}
          value={String(session.exercises.length)}
          label="Exercises"
        />
        <StatTile
          icon={<Hash size={16} color={colors.cyan} />}
          tint={colors.cyanGlow}
          value={String(totalSets)}
          label="Sets"
        />
        <StatTile
          icon={<Layers size={16} color={colors.amber} />}
          tint={colors.amberGlow}
          value={formatVolume(session.total_volume_kg)}
          label="Volume"
        />
        <StatTile
          icon={<Clock size={16} color={colors.primaryLight} />}
          tint={colors.primaryGlow}
          value={durationLabel}
          label="Duration"
        />
        <StatTile
          icon={<Flame size={16} color={colors.rose} />}
          tint={colors.roseGlow}
          value={session.total_calories ? `${Math.round(session.total_calories)}` : '—'}
          label="Calories"
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).duration(350)}>
        <ChipGroup
          label="How did it feel?"
          options={RATING_OPTIONS}
          value={rating}
          onChange={setRating}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(350)}>
        <Text style={styles.sectionLabel}>Notes</Text>
        <Input
          placeholder="Add a note about this workout (optional)"
          value={noteValue}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
        />
      </Animated.View>
    </SheetScreen>
  );
}
