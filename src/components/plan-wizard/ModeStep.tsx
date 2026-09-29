import React from 'react';
import { View, Text } from 'react-native';
import { Clock, Sparkles, TrendingDown, TrendingUp } from 'lucide-react-native';
import { PressableScale, Skeleton, ErrorState } from '../ui';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import type { Blueprint, JourneyMode } from '../../types';
import { MODE_META } from './constants';
import type { WizardPath } from './types';

interface ModeStepProps {
  path: WizardPath;
  value: JourneyMode | null;
  onChange: (mode: JourneyMode, blueprint: Blueprint | null) => void;
  blueprints: Blueprint[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Highlights one mode with a "Recommended" badge (e.g. onboarding's goal-based suggestion). */
  recommendedMode?: JourneyMode | null;
  /** Rendered below the mode cards, e.g. onboarding's "I'll choose a plan later" escape hatch. */
  children?: React.ReactNode;
}

const round1 = (n: number) => Number(n.toFixed(1));

/** Step 1: pick a mode. For the "blueprint" path, cards show real stats fetched from the API. */
export function ModeStep({
  path,
  value,
  onChange,
  blueprints,
  isLoading,
  isError,
  onRetry,
  recommendedMode,
  children,
}: ModeStepProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  if (path === 'blueprint' && isLoading) {
    return (
      <View>
        <Skeleton height={110} borderRadius={radius.lg} style={styles.skeletonSpacing} />
        <Skeleton height={110} borderRadius={radius.lg} style={styles.skeletonSpacing} />
        <Skeleton height={110} borderRadius={radius.lg} style={styles.skeletonSpacing} />
      </View>
    );
  }

  if (path === 'blueprint' && isError) {
    return <ErrorState message="Couldn't load plan blueprints." onRetry={onRetry} />;
  }

  const blueprintByMode: Partial<Record<JourneyMode, Blueprint>> = {};
  (blueprints ?? []).forEach((bp) => {
    blueprintByMode[bp.mode] = bp;
  });

  return (
    <View>
      <Text style={styles.heading}>Choose a mode</Text>
      <Text style={styles.body}>
        {path === 'blueprint'
          ? 'Each mode maps to a curated blueprint with its own pacing and templates.'
          : "Pick the mode that matches your goal — you'll set the specifics next."}
      </Text>

      {MODE_META.map((meta) => {
        const bp = blueprintByMode[meta.mode];
        const selected = value === meta.mode;
        const isRecommended = recommendedMode === meta.mode;
        const accent = colors[meta.color];
        return (
          <PressableScale
            key={meta.mode}
            haptic="selection"
            scaleTo={0.98}
            onPress={() => onChange(meta.mode, bp ?? null)}
            style={[styles.card, selected && styles.cardSelected, isRecommended && !selected && styles.cardRecommended]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={meta.label}
          >
            <View style={styles.headerRow}>
              <View style={[styles.modeBadge, { backgroundColor: `${accent}1F` }]}>
                <meta.Icon size={13} color={accent} />
                <Text style={[styles.modeText, { color: accent }]}>{meta.label}</Text>
              </View>
              <View style={styles.headerRightRow}>
                {isRecommended ? (
                  <View style={styles.recommendedBadge}>
                    <Sparkles size={11} color={colors.primaryLight} />
                    <Text style={styles.recommendedText}>Recommended</Text>
                  </View>
                ) : null}
                {bp ? (
                  <View style={styles.durationBadge}>
                    <Clock size={12} color={colors.textMuted} />
                    <Text style={styles.durationText}>{bp.default_duration_days} days</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Text style={styles.name}>{bp ? bp.name : meta.label}</Text>
            <Text style={styles.desc}>{bp ? bp.description : meta.description}</Text>
            {bp ? (
              <View style={styles.footerRow}>
                <View style={styles.pacingRow}>
                  {bp.pacing_kg_per_week < 0 ? (
                    <TrendingDown size={13} color={colors.rose} />
                  ) : bp.pacing_kg_per_week > 0 ? (
                    <TrendingUp size={13} color={colors.primaryLight} />
                  ) : null}
                  <Text style={styles.pacing}>
                    Pacing: {bp.pacing_kg_per_week > 0 ? `+${round1(bp.pacing_kg_per_week)}` : round1(bp.pacing_kg_per_week)} kg/week
                  </Text>
                </View>
                <Text style={styles.daysPerWeek}>{bp.default_days_per_week}×/week</Text>
              </View>
            ) : null}
          </PressableScale>
        );
      })}

      {children}
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
  skeletonSpacing: {
    marginBottom: spacing.md,
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
  cardRecommended: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  recommendedText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  desc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  pacingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pacing: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  daysPerWeek: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
}));
