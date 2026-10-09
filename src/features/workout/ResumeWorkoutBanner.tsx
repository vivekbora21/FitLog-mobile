import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Dumbbell, X } from 'lucide-react-native';
import { PressableScale } from '../../components/ui';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import {
  dismissWorkoutDraftForSession,
  draftHasContent,
  formatDraftAge,
  isWorkoutDraftDismissedForSession,
  loadWorkoutDraft,
  type WorkoutDraft,
} from './draft';

/** Shown on Home and Workouts while an unfinished workout is saved on the device. */
export function ResumeWorkoutBanner({ featured = false }: { featured?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);

  useFocusEffect(
    useCallback(() => {
      const d = loadWorkoutDraft();
      const hasUndismissedContent = !!d && draftHasContent(d) && !isWorkoutDraftDismissedForSession(d);
      setDraft(hasUndismissedContent ? d : null);
    }, [])
  );

  if (!draft) return null;
  const sets = draft.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);

  return (
    <View style={[styles.banner, featured && styles.featuredBanner]}>
      <PressableScale
        haptic="light"
        onPress={() => router.push({ pathname: '/workout/log', params: { resume: '1' } })}
        style={[styles.pressable, featured && styles.featuredPressable]}
        accessibilityRole="button"
        accessibilityLabel={`Resume ${draft.title || 'workout'} in progress`}
      >
        <View style={[styles.icon, featured && styles.featuredIcon]}>
          <Dumbbell size={featured ? 21 : 18} color={colors.textInverse} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.eyebrow, featured && styles.featuredEyebrow]}>Workout in progress</Text>
          <Text style={styles.title} numberOfLines={featured ? 2 : 1}>
            {draft.title || 'Workout'}
          </Text>
          <Text style={styles.meta}>
            {sets} {sets === 1 ? 'set' : 'sets'} done · {formatDraftAge(draft.startedAt)}
          </Text>
        </View>
        <Text style={styles.cta}>Resume</Text>
        <ChevronRight size={18} color={colors.primaryLight} />
      </PressableScale>
      <PressableScale
        haptic="light"
        onPress={() => {
          dismissWorkoutDraftForSession(draft);
          setDraft(null);
        }}
        style={styles.dismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <X size={16} color={colors.textSecondary} />
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.tealTint,
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  featuredBanner: {
    marginBottom: spacing.xl,
    borderRadius: radius.xl,
    borderColor: colors.primaryLight,
  },
  pressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  featuredPressable: {
    padding: spacing.lg,
  },
  dismiss: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
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
  featuredEyebrow: {
    fontSize: 12,
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
