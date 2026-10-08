import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { Button } from './Button';
import { radius, spacing, makeStyles, useTheme } from '../../theme';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, retrying }: ErrorStateProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const reducedMotion = useReducedMotion();
  return (
    <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(320)} style={styles.container}>
      <Animated.View entering={reducedMotion ? undefined : ZoomIn.delay(80).duration(320)} style={styles.iconCircle}>
        <WifiOff size={30} color={colors.error} />
      </Animated.View>
      <Animated.Text entering={reducedMotion ? undefined : FadeIn.delay(140).duration(320)} style={styles.title}>
        {title}
      </Animated.Text>
      <Animated.Text entering={reducedMotion ? undefined : FadeIn.delay(180).duration(320)} style={styles.message}>
        {message}
      </Animated.Text>
      <Animated.View entering={reducedMotion ? undefined : FadeIn.delay(220).duration(320)}>
        <Button
          title="Try Again"
          variant="primary"
          loading={retrying}
          icon={<RefreshCw size={16} color="#FFFFFF" />}
          iconPosition="left"
          onPress={onRetry}
          style={styles.button}
        />
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.errorBackground,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    maxWidth: 320,
  },
  button: {
    marginTop: spacing.xl,
    minWidth: 160,
  },
}));
