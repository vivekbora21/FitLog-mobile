import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme';

interface BadgeProps {
  label: string;
  tone?: 'emerald' | 'cyan' | 'amber' | 'violet' | 'rose' | 'slate';
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Badge({ label, tone = 'emerald', icon, style }: BadgeProps) {
  const getContainerStyle = (): ViewStyle[] => {
    const list: ViewStyle[] = [styles.badge];
    if (tone === 'cyan') list.push(styles.cyan);
    else if (tone === 'amber') list.push(styles.amber);
    else if (tone === 'violet') list.push(styles.violet);
    else if (tone === 'rose') list.push(styles.rose);
    else if (tone === 'slate') list.push(styles.slate);
    else list.push(styles.emerald);

    if (style) list.push(style);
    return list;
  };

  const getTextColor = (): string => {
    if (tone === 'cyan') return colors.cyan;
    if (tone === 'amber') return colors.amber;
    if (tone === 'violet') return colors.violet;
    if (tone === 'rose') return colors.rose;
    if (tone === 'slate') return colors.textSecondary;
    return colors.primaryLight;
  };

  return (
    <View style={getContainerStyle()}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.text, { color: getTextColor() }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: spacing.xs,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emerald: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  cyan: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderColor: 'rgba(2, 132, 199, 0.3)',
  },
  amber: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  violet: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  rose: {
    backgroundColor: 'rgba(225, 29, 72, 0.12)',
    borderColor: 'rgba(225, 29, 72, 0.3)',
  },
  slate: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
});
