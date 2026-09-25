import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { ProgressBar } from './ProgressBar';
import { PressableScale } from './PressableScale';
import { radius, spacing, makeStyles, useTheme } from '../../theme';

interface MetricCardProps {
  label: string;
  value: string;
  target?: string;
  percentage?: number;
  icon?: React.ReactNode;
  accentColor?: string;
  /** Stagger the bar fill when several cards mount together. */
  delay?: number;
  style?: ViewStyle;
  /** Makes the card tappable, e.g. to open an editor. */
  onPress?: () => void;
  accessibilityHint?: string;
  /** Extra content under the progress bar, such as quick-action buttons. */
  footer?: React.ReactNode;
}

export function MetricCard({
  label,
  value,
  target,
  percentage,
  icon,
  accentColor: accentColorProp,
  delay = 0,
  style,
  onPress,
  accessibilityHint,
  footer,
}: MetricCardProps) {
  const { colors } = useTheme();
  const accentColor = accentColorProp ?? colors.primaryLight;
  const styles = useStyles();
  const clampedPct = percentage !== undefined ? Math.min(100, Math.max(0, percentage)) : undefined;

  const a11yLabel = `${label}: ${value}${target ? ` of ${target}` : ''}${
    clampedPct !== undefined ? `, ${clampedPct} percent` : ''
  }`;

  const content = (
    <>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {icon && <View style={[styles.iconWrapper, { backgroundColor: `${accentColor}20` }]}>{icon}</View>}
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {target && (
          <Text style={styles.target} numberOfLines={1}>
            {' '}/ {target}
          </Text>
        )}
      </View>

      {clampedPct !== undefined && (
        <View style={styles.progressContainer}>
          <ProgressBar
            percentage={clampedPct}
            color={accentColor}
            height={5}
            delay={delay}
            style={styles.progressBar}
          />
          <Text style={[styles.percentageText, { color: accentColor }]}>{clampedPct}%</Text>
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <View style={[styles.card, style]}>
        <PressableScale
          onPress={onPress}
          scaleTo={0.98}
          accessibilityLabel={a11yLabel}
          accessibilityHint={accessibilityHint}
        >
          {content}
        </PressableScale>
        {footer}
      </View>
    );
  }

  return (
    <View style={[styles.card, style]}>
      <View accessible accessibilityLabel={a11yLabel}>
        {content}
      </View>
      {footer}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: spacing.xs,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  target: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  progressBar: {
    flex: 1,
    width: undefined,
  },
  percentageText: {
    fontSize: 11,
    fontWeight: '700',
    width: 32,
    textAlign: 'right',
  },
}));
