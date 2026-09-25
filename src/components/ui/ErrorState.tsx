import React from 'react';
import { View, Text } from 'react-native';
import { WifiOff, RefreshCw } from 'lucide-react-native';
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
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <WifiOff size={30} color={colors.error} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Button
        title="Try Again"
        variant="primary"
        loading={retrying}
        icon={<RefreshCw size={16} color="#FFFFFF" />}
        iconPosition="left"
        onPress={onRetry}
        style={styles.button}
      />
    </View>
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
