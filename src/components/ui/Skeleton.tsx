import React, { useEffect } from 'react';
import { View, StyleSheet, DimensionValue, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '../../theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = radius.md, style }: SkeletonProps) {
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.set(withRepeat(
      withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    ));
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.block, { width, height, borderRadius }, animatedStyle, style]}
    />
  );
}

/** Generic placeholder layout for a tab screen while its first query loads. */
export function ScreenSkeleton() {
  return (
    <View style={styles.screen} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <Skeleton width="45%" height={14} />
      <Skeleton width="70%" height={28} style={{ marginTop: spacing.sm }} />
      <Skeleton height={190} borderRadius={radius.xl} style={{ marginTop: spacing.xl }} />
      <View style={styles.row}>
        <Skeleton height={110} borderRadius={radius.lg} style={styles.flex} />
        <Skeleton height={110} borderRadius={radius.lg} style={styles.flex} />
      </View>
      <Skeleton height={140} borderRadius={radius.lg} style={{ marginTop: spacing.md }} />
      <Skeleton height={72} borderRadius={radius.lg} style={{ marginTop: spacing.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surfaceElevated,
  },
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  flex: {
    flex: 1,
  },
});
