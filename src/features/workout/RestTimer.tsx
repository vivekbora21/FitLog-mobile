import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Text, Vibration, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Plus, Timer, X } from 'lucide-react-native';
import { PressableScale } from '../../components/ui';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { haptics } from '../../lib/haptics';

/**
 * Lazily resolves expo-notifications at runtime.
 * Returns null when running inside Expo Go SDK 53+ (where the module was removed)
 * so all notification paths are safely skipped while the rest of the UI works fine.
 */
function getNotifications(): typeof import('expo-notifications') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    return null;
  }
}

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

const REST_TIMER_NOTIFICATION_ID = 'fitlog-rest-timer';

if (Platform.OS !== 'web') {
  try {
    const Notifications = getNotifications();
    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Ignore notification handler setup error in non-native environments
  }
}

async function scheduleRestNotification(seconds: number) {
  if (Platform.OS === 'web' || seconds <= 0) return;
  try {
    const Notifications = getNotifications();
    if (!Notifications) return; // Expo Go SDK 53+ — skip silently
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== 'granted') return;
    }
    await Notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIFICATION_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: REST_TIMER_NOTIFICATION_ID,
      content: {
        title: 'Rest Complete! ⏱️',
        body: 'Time to start your next set.',
        sound: true,
        vibrate: [0, 250, 150, 250],
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
      },
    });
  } catch {
    // Non-blocking fallback if background notifications are restricted
  }
}

async function cancelRestNotification() {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = getNotifications();
    if (!Notifications) return; // Expo Go SDK 53+ — skip silently
    await Notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIFICATION_ID).catch(() => {});
    await Notifications.dismissNotificationAsync(REST_TIMER_NOTIFICATION_ID).catch(() => {});
  } catch {
    // Ignore cleanup error
  }
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
 * Countdown between sets with background notifications and vibration.
 * Derived from wall-clock end timestamp so it stays accurate across screen lock.
 */
export function useRestTimer() {
  const [rest, setRest] = useState<RestState | null>(null);
  const now = useNow(rest !== null, 250);
  const remaining = rest ? Math.max(0, (rest.endsAt - now) / 1000) : 0;
  const firedFor = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      cancelRestNotification();
    };
  }, []);

  useEffect(() => {
    if (!rest || remaining > 0 || firedFor.current === rest.endsAt) return;
    firedFor.current = rest.endsAt;
    cancelRestNotification();
    haptics.success();
    Vibration.vibrate([0, 250, 150, 250]);
    const id = setTimeout(() => setRest(null), 1500);
    return () => clearTimeout(id);
  }, [rest, remaining]);

  const start = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
    scheduleRestNotification(seconds);
  }, []);

  const setFixed = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
    scheduleRestNotification(seconds);
  }, []);

  const adjust = useCallback((delta: number) => {
    setRest((r) => {
      if (!r) return r;
      const endsAt = Math.max(Date.now() + 1000, r.endsAt + delta * 1000);
      const remainingSec = Math.max(0, (endsAt - Date.now()) / 1000);
      if (remainingSec > 0) {
        scheduleRestNotification(remainingSec);
      } else {
        cancelRestNotification();
      }
      return { endsAt, total: Math.max(r.total + delta, 1) };
    });
  }, []);

  const skip = useCallback(() => {
    cancelRestNotification();
    setRest(null);
  }, []);

  return { active: rest !== null, remaining, total: rest?.total ?? 0, start, setFixed, adjust, skip };
}

type RestTimerControls = ReturnType<typeof useRestTimer>;

export function RestTimerBar({ timer }: { timer: RestTimerControls }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [showPresets, setShowPresets] = useState(false);

  if (!timer.active) return null;
  const done = timer.remaining <= 0;
  const pct = timer.total > 0 ? Math.min(1, timer.remaining / timer.total) : 0;

  return (
    <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutDown.duration(160)} style={styles.bar}>
      <View style={[styles.progress, { width: `${pct * 100}%` }]} />
      
      <PressableScale
        haptic="selection"
        onPress={() => setShowPresets((prev) => !prev)}
        style={styles.clockButton}
        accessibilityLabel="Toggle rest presets"
      >
        <Timer size={18} color={done ? colors.success : colors.primaryLight} />
        <View style={styles.flex} accessibilityLiveRegion="polite">
          <Text style={styles.label}>{done ? 'Rest over' : 'Resting'}</Text>
          <Text style={styles.clock}>{done ? 'Go!' : formatClock(timer.remaining)}</Text>
        </View>
      </PressableScale>

      {showPresets ? (
        <View style={styles.presetsRow}>
          {[45, 60, 90, 120].map((sec) => (
            <PressableScale
              key={sec}
              haptic="selection"
              onPress={() => {
                timer.setFixed(sec);
                setShowPresets(false);
              }}
              style={styles.presetChip}
              accessibilityLabel={`Set rest to ${sec} seconds`}
            >
              <Text style={styles.presetChipText}>{sec}s</Text>
            </PressableScale>
          ))}
          <PressableScale
            haptic="selection"
            onPress={() => setShowPresets(false)}
            style={styles.btnSmall}
            accessibilityLabel="Close presets"
          >
            <X size={14} color={colors.textSecondary} />
          </PressableScale>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <PressableScale
            haptic="selection"
            onPress={() => timer.adjust(-15)}
            style={styles.btn}
            accessibilityLabel="15 seconds less rest"
          >
            <Text style={styles.btnText}>−15</Text>
          </PressableScale>
          <PressableScale
            haptic="selection"
            onPress={() => timer.adjust(15)}
            style={styles.btn}
            accessibilityLabel="15 seconds more rest"
          >
            <Text style={styles.btnText}>+15</Text>
          </PressableScale>
          <PressableScale
            haptic="selection"
            onPress={() => timer.adjust(30)}
            style={styles.btn}
            accessibilityLabel="30 seconds more rest"
          >
            <Text style={styles.btnText}>+30</Text>
          </PressableScale>
          <PressableScale
            haptic="selection"
            onPress={timer.skip}
            style={[styles.btn, styles.btnDismiss]}
            accessibilityLabel="Skip rest"
          >
            <X size={16} color={colors.textPrimary} />
          </PressableScale>
        </View>
      )}
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  clockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    paddingVertical: 2,
  },
  flex: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clock: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 8,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  btn: {
    minWidth: 40,
    height: 38,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  btnDismiss: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  btnSmall: {
    width: 32,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
}));
