import React from 'react';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useNetworkState } from 'expo-network';
import { WifiOff } from 'lucide-react-native';
import { makeStyles, radius, spacing, useTheme } from '../theme';

/** Slim pill under the status bar while the device has no connection. */
export function OfflineBanner() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  // isConnected is undefined until the first reading; only an explicit false counts as offline.
  if (network.isConnected !== false) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.banner, { top: insets.top + spacing.xs }]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
    >
      <WifiOff size={14} color={colors.textInverse} />
      <Text style={styles.text}>You&apos;re offline</Text>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.textPrimary,
    maxWidth: '92%',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textInverse,
  },
}));
