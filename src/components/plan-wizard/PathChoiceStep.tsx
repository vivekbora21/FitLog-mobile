import React from 'react';
import { View, Text } from 'react-native';
import { ClipboardList, Sparkles } from 'lucide-react-native';
import { PressableScale } from '../ui';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import type { WizardPath } from './types';

interface PathChoiceStepProps {
  value: WizardPath | null;
  onChange: (path: WizardPath) => void;
}

/** Step 0: "Use a ready-made plan" vs "Build my own". */
export function PathChoiceStep({ value, onChange }: PathChoiceStepProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View>
      <Text style={styles.heading}>How do you want to start?</Text>
      <Text style={styles.body}>
        Pick a ready-made blueprint tuned by mode, or build a fully custom plan from scratch.
      </Text>

      <PressableScale
        haptic="selection"
        scaleTo={0.98}
        onPress={() => onChange('blueprint')}
        style={[styles.card, value === 'blueprint' && styles.cardSelected]}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'blueprint' }}
        accessibilityLabel="Use a ready-made plan"
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.primarySurface }]}>
          <Sparkles size={22} color={colors.primaryLight} />
        </View>
        <Text style={styles.cardTitle}>Use a ready-made plan</Text>
        <Text style={styles.cardDesc}>
          Pick from curated blueprints with proven workout and meal templates for your goal.
        </Text>
      </PressableScale>

      <PressableScale
        haptic="selection"
        scaleTo={0.98}
        onPress={() => onChange('custom')}
        style={[styles.card, value === 'custom' && styles.cardSelected]}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'custom' }}
        accessibilityLabel="Build my own"
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.surfaceElevated }]}>
          <ClipboardList size={22} color={colors.textSecondary} />
        </View>
        <Text style={styles.cardTitle}>Build my own</Text>
        <Text style={styles.cardDesc}>
          Choose a mode and set your own duration, schedule and targets from scratch.
        </Text>
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySurface,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
}));
