import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Dumbbell } from 'lucide-react-native';
import { PressableScale } from '../../components/ui';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { draftHasContent, loadWorkoutDraft, type WorkoutDraft } from './draft';
import { formatClock } from './RestTimer';

/** Shown on Home and Workouts while an unfinished workout is saved on the device. */
export function ResumeWorkoutBanner() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);

  useFocusEffect(
    useCallback(() => {
      const d = loadWorkoutDraft();
      setDraft(d && draftHasContent(d) ? d : null);
    }, [])
  );

  if (!draft) return null;
  const sets = draft.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
  // Time from start to the last logged change.
  const elapsed = Math.max(0, (draft.updatedAt - draft.startedAt) / 1000);

  return (
    <PressableScale
      haptic="light"
      onPress={() => router.push({ pathname: '/workout/log', params: { resume: '1' } })}
      style={styles.banner}
      accessibilityRole="button"
      accessibilityLabel={`Resume ${draft.title || 'workout'} in progress`}
    >
      <View style={styles.icon}>
        <Dumbbell size={18} color={colors.textInverse} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.eyebrow}>Workout in progress</Text>
        <Text style={styles.title} numberOfLines={1}>
          {draft.title || 'Workout'}
        </Text>
        <Text style={styles.meta}>
          {sets} {sets === 1 ? 'set' : 'sets'} done{draft.live ? ` · ${formatClock(elapsed)} in` : ''}
        </Text>
      </View>
      <Text style={styles.cta}>Resume</Text>
      <ChevronRight size={18} color={colors.primaryLight} />
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  cta: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryLight,
  },
}));
