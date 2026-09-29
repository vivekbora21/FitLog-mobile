import React from 'react';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { radius, spacing, makeStyles } from '../../theme';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  const styles = useStyles();
  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.container}>
      {icon && (
        <Animated.View entering={ZoomIn.delay(80).duration(320)} style={styles.iconContainer}>
          {icon}
        </Animated.View>
      )}
      <Animated.Text entering={FadeIn.delay(140).duration(320)} style={styles.title}>
        {title}
      </Animated.Text>
      {description && (
        <Animated.Text entering={FadeIn.delay(180).duration(320)} style={styles.description}>
          {description}
        </Animated.Text>
      )}
      {action && (
        <Animated.View entering={FadeIn.delay(220).duration(320)} style={styles.actionContainer}>
          {action}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionContainer: {
    marginTop: spacing.lg,
  },
}));
