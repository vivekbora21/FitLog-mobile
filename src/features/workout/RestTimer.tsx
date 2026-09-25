import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, Vibration, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Timer, X } from 'lucide-react-native';
import { PressableScale } from '../../components/ui';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { haptics } from '../../lib/haptics';

interface RestState {
  endsAt: number;
  total: number;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Wall-clock timestamp that re-renders every `intervalMs` while `active`. */
export function useNow(active: boolean, intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

/**
 * Countdown between sets. Remaining time is derived from an end timestamp, so it stays
 * correct after the app is backgrounded or the phone is locked.
 */
export function useRestTimer() {
  const [rest, setRest] = useState<RestState | null>(null);
  const now = useNow(rest !== null, 250);
  const remaining = rest ? Math.max(0, (rest.endsAt - now) / 1000) : 0;
  const firedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!rest || remaining > 0 || firedFor.current === rest.endsAt) return;
    firedFor.current = rest.endsAt;
    haptics.success();
    Vibration.vibrate([0, 250, 150, 250]);
    const id = setTimeout(() => setRest(null), 1500);
    return () => clearTimeout(id);
  }, [rest, remaining]);

  const start = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
  }, []);

  const adjust = useCallback((delta: number) => {
    setRest((r) => {
      if (!r) return r;
      const endsAt = Math.max(Date.now() + 1000, r.endsAt + delta * 1000);
      return { endsAt, total: Math.max(r.total + delta, 1) };
    });
  }, []);

  const skip = useCallback(() => setRest(null), []);

  return { active: rest !== null, remaining, total: rest?.total ?? 0, start, adjust, skip };
}

type RestTimerControls = ReturnType<typeof useRestTimer>;

export function RestTimerBar({ timer }: { timer: RestTimerControls }) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (!timer.active) return null;
  const done = timer.remaining <= 0;
  const pct = timer.total > 0 ? Math.min(1, timer.remaining / timer.total) : 0;

  return (
    <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutDown.duration(160)} style={styles.bar}>
      <View style={[styles.progress, { width: `${pct * 100}%` }]} />
      <Timer size={18} color={done ? colors.success : colors.primaryLight} />
      <View style={styles.flex} accessibilityLiveRegion="polite">
        <Text style={styles.label}>{done ? 'Rest over' : 'Rest'}</Text>
        <Text style={styles.clock}>{done ? 'Go!' : formatClock(timer.remaining)}</Text>
      </View>
      <PressableScale haptic="selection" onPress={() => timer.adjust(-15)} style={styles.btn} accessibilityLabel="15 seconds less rest">
        <Text style={styles.btnText}>−15</Text>
      </PressableScale>
      <PressableScale haptic="selection" onPress={() => timer.adjust(15)} style={styles.btn} accessibilityLabel="15 seconds more rest">
        <Text style={styles.btnText}>+15</Text>
      </PressableScale>
      <PressableScale haptic="selection" onPress={timer.skip} style={styles.btn} accessibilityLabel="Skip rest">
        <X size={16} color={colors.textPrimary} />
      </PressableScale>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    overflow: 'hidden',
    ...shadows.elevated,
  },
  progress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primarySurface,
  },
  flex: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  clock: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  btn: {
    minWidth: 44,
    height: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
}));
