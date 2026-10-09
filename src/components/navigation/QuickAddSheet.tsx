import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Dumbbell, Utensils, Scale, Camera, ChevronRight } from 'lucide-react-native';
import { PressableScale } from '../ui/PressableScale';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { toDateKey } from '../../lib/format';

interface QuickAddSheetProps {
  visible: boolean;
  onClose: () => void;
}

const SHEET_SPRING = { damping: 18, stiffness: 180, mass: 0.9 };
const SCREEN_HEIGHT = Dimensions.get('window').height;

export function QuickAddSheet({ visible, onClose }: QuickAddSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const todayKey = toDateKey(new Date());

  // Rendered while visible, and for the short tail of the close animation.
  const [rendered, setRendered] = useState(visible);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Mount tracks `visible` becoming true; close (below) unmounts only after the exit animation finishes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRendered(true);
      progress.value = withSpring(1, SHEET_SPRING);
    } else {
      progress.value = withTiming(0, { duration: 180 }, (finished) => {
        if (finished) runOnJS(setRendered)(false);
      });
    }
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * SCREEN_HEIGHT }],
  }));

  const actions = [
    {
      key: 'workout',
      label: 'Log workout',
      sub: 'Record sets, reps & weights',
      icon: Dumbbell,
      iconColor: colors.primaryLight,
      iconBg: colors.primarySurface,
      onPress: () => {
        onClose();
        router.push('/workout/log');
      },
    },
    {
      key: 'meal',
      label: 'Add meal',
      sub: 'Log food & track macros',
      icon: Utensils,
      iconColor: colors.cyan,
      iconBg: colors.cyanGlow,
      onPress: () => {
        onClose();
        router.push({ pathname: '/meal/add', params: { date: todayKey } });
      },
    },
    {
      key: 'weight',
      label: 'Log weight',
      sub: 'Track your latest check-in',
      icon: Scale,
      iconColor: colors.amber,
      iconBg: colors.amberGlow,
      onPress: () => {
        onClose();
        router.push({ pathname: '/(tabs)/progress', params: { quickAdd: 'weight' } });
      },
    },
    {
      key: 'photo',
      label: 'Add photo',
      sub: 'Capture a new progress photo',
      icon: Camera,
      iconColor: colors.rose,
      iconBg: colors.roseGlow,
      onPress: () => {
        onClose();
        router.push({ pathname: '/(tabs)/progress', params: { quickAdd: 'photo' } });
      },
    },
  ];

  if (!rendered) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, backdropStyle]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheetSlot} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheetContainer,
              sheetStyle,
              { paddingBottom: spacing.lg + Math.max(insets.bottom, spacing.lg) },
            ]}
          >
            <View style={styles.handleBar} />
            <Text style={styles.title}>Quick add</Text>

            {actions.map(({ key, label, sub, icon: Icon, iconColor, iconBg, onPress }, index) => (
              <Animated.View key={key} entering={FadeInDown.delay(60 + index * 45).springify().damping(16)}>
                <PressableScale
                  haptic="selection"
                  onPress={onPress}
                  style={styles.row}
                  accessibilityLabel={label}
                  accessibilityRole="button"
                >
                  <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
                    <Icon size={20} color={iconColor} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{label}</Text>
                    <Text style={styles.rowSub}>{sub}</Text>
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </PressableScale>
              </Animated.View>
            ))}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  backdrop: {
    flex: 1,
  },
  dim: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheetSlot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.sm,
    ...shadows.elevated,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.borderBright,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
}));
