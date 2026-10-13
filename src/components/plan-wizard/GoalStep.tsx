import React from 'react';
import { View, Text } from 'react-native';
import { PressableScale } from '../ui';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { MODE_CARDS } from './constants';
import type { BuilderMode } from './types';

interface GoalStepProps {
  value: BuilderMode | null;
  onChange: (mode: BuilderMode) => void;
}

/** Step 1 "Goal" (spec v1.6 section 8.1). D3: the old "ready-made plan vs
 * build my own" entry screen is gone -- this card grid is the only entry
 * point, and everything it sets up is customisable in the steps that
 * follow. Habit is a real backend Mode (treated identically to Focus by the
 * engine) but is not one of the spec's four screen cards -- intentionally
 * left off here, see the implementation report. */
export function GoalStep({ value, onChange }: GoalStepProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View>
      <Text style={styles.heading}>What&apos;s your goal?</Text>
      <Text style={styles.body}>Pick the one that best matches what you want right now. You can fine-tune everything next.</Text>

      {MODE_CARDS.map((card) => {
        const selected = value === card.mode;
        const accent = colors[card.color];
        return (
          <PressableScale
            key={card.mode}
            haptic="selection"
            scaleTo={0.98}
            onPress={() => onChange(card.mode)}
            style={[styles.card, selected && styles.cardSelected]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={card.title}
          >
            <View style={styles.headerRow}>
              <View style={[styles.iconCircle, { backgroundColor: `${accent}1F` }]}>
                <card.Icon size={20} color={accent} />
              </View>
              <View style={[styles.modeBadge, { backgroundColor: `${accent}1F` }]}>
                <Text style={[styles.modeText, { color: accent }]}>{card.subtitle}</Text>
              </View>
            </View>
            <Text style={styles.title}>{card.title}</Text>
            <Text style={styles.expectation}>{card.expectation}</Text>
          </PressableScale>
        );
      })}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  expectation: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
}));
