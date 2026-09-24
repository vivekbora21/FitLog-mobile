import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius } from '../../theme';

interface ProgressBarProps {
  /** 0–100 */
  percentage: number;
  color?: string;
  height?: number;
  delay?: number;
  style?: ViewStyle;
}

export function ProgressBar({
  percentage,
  color = colors.primaryLight,
  height = 6,
  delay = 0,
  style,
}: ProgressBarProps) {
  const target = Math.min(100, Math.max(0, percentage || 0));
  const width = useSharedValue(0);

  useEffect(() => {
    width.set(withDelay(
      delay,
      withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) })
    ));
  }, [target, delay, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={[styles.track, { height }, style]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.track,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
});
