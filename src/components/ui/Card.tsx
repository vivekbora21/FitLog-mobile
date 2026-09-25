import React from 'react';
import { View, StyleSheet, ViewStyle, ViewProps } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors, radius, shadows, spacing } from '../../theme';

interface CardProps extends ViewProps {
  elevated?: boolean;
  highlighted?: boolean;
  /** Makes the whole card tappable with spring + haptic feedback. */
  onPress?: () => void;
  accessibilityHint?: string;
  style?: ViewStyle;
  children: React.ReactNode;
}

export function Card({
  elevated = false,
  highlighted = false,
  onPress,
  accessibilityHint,
  style,
  children,
  ...rest
}: CardProps) {
  const cardStyle = [
    styles.card,
    elevated && styles.cardElevated,
    highlighted && styles.cardHighlighted,
    style,
  ];

  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        scaleTo={0.98}
        accessibilityHint={accessibilityHint}
        style={cardStyle}
      >
        {children}
      </PressableScale>
    );
  }

  return (
    <View style={cardStyle} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginVertical: spacing.xs,
  },
  cardElevated: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderSubtle,
    ...shadows.elevated,
  },
  cardHighlighted: {
    borderColor: colors.borderGlow,
    backgroundColor: 'rgba(15, 118, 110, 0.08)',
  },
});
