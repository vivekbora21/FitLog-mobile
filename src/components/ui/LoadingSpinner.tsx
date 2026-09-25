import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { spacing, makeStyles, useTheme } from '../../theme';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ message, fullScreen = false }: LoadingSpinnerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color={colors.primaryLight} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  message: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
}));
