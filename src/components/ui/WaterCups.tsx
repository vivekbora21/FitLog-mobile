import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { makeStyles, useTheme } from '../../theme';

interface WaterCupsProps {
  cups: number;
  targetCups: number;
  maxDisplay?: number;
  size?: 'sm' | 'md';
  accentColor?: string;
}

function CupItem({
  filled,
  index,
  accentColor,
  size = 'md',
}: {
  filled: boolean;
  index: number;
  accentColor?: string;
  size?: 'sm' | 'md';
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const scale = useSharedValue(1);
  const fillAnim = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    if (filled) {
      scale.set(
        withSequence(
          withTiming(1.22, { duration: 130 }),
          withSpring(1, { damping: 12, stiffness: 220 })
        )
      );
      fillAnim.set(withTiming(1, { duration: 240 }));
    } else {
      fillAnim.set(withTiming(0, { duration: 200 }));
    }
  }, [filled, fillAnim, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: fillAnim.value > 0.5 ? accentColor ?? colors.blue : colors.surfaceElevated,
    borderColor:
      fillAnim.value > 0.5
        ? accentColor ?? 'rgba(96, 165, 250, 0.6)'
        : colors.borderSubtle,
  }));

  const isSmall = size === 'sm';

  return (
    <Animated.View
      style={[
        styles.cup,
        isSmall && styles.cupSmall,
        animatedStyle,
      ]}
      accessibilityLabel={`Cup ${index + 1} ${filled ? 'filled' : 'empty'}`}
    />
  );
}

export function WaterCups({
  cups,
  targetCups,
  maxDisplay = 12,
  size = 'md',
  accentColor,
}: WaterCupsProps) {
  const styles = useStyles();
  const displayTarget = Math.max(1, Math.min(targetCups, maxDisplay));
  const activeColor = accentColor;

  return (
    <View
      style={[styles.container, size === 'sm' && styles.containerSmall]}
      accessible
      accessibilityLabel={`${cups} of ${targetCups} cups of water`}
    >
      {Array.from({ length: displayTarget }).map((_, i) => (
        <CupItem
          key={i}
          index={i}
          filled={i < cups}
          accentColor={activeColor}
          size={size}
        />
      ))}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  containerSmall: {
    gap: 4,
  },
  cup: {
    width: 17,
    height: 24,
    borderRadius: 5,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
  },
  cupSmall: {
    width: 13,
    height: 18,
    borderRadius: 4,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    borderWidth: 1,
  },
}));
