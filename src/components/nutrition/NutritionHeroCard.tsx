import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { Card, Badge, ArcGauge } from '../ui';
import { radius, spacing, makeStyles, useTheme } from '../../theme';

export interface NutritionHeroStatItem {
  label: string;
  value: string;
  unit?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  highlight?: boolean;
  badgeText?: string;
  badgeTone?: 'emerald' | 'cyan' | 'amber' | 'slate' | 'rose';
}

export interface NutritionHeroCardProps {
  /** Optional header title, e.g. "Weekly Average Nutrients" or "Daily Energy Balance" */
  headerTitle?: string;
  /** Optional header subtitle, e.g. "Deficit Target Track" */
  headerSubtitle?: string;
  /** Header icon node, e.g. Flame or Dumbbell */
  headerIcon?: React.ReactNode;
  /** Optional badge label in header, e.g. "5/7 Days Logged" */
  headerBadgeLabel?: string;
  /** Tone for header badge */
  headerBadgeTone?: 'emerald' | 'cyan' | 'amber' | 'slate' | 'rose';

  /** Arc gauge adherence / progress percentage (0 - 100) */
  percentage: number;
  /** Gauge arc stroke color */
  gaugeColor?: string;
  /** Optional gradient endpoint color */
  gaugeGradient?: string;
  /** Gauge size (default: 196) */
  gaugeSize?: number;

  /** Center icon inside gauge, e.g. <Flame size={15} /> */
  centerIcon?: React.ReactNode;
  /** Main primary value inside gauge, e.g. "2,160" or "--" */
  primaryValue: string;
  /** Color for primary value */
  primaryValueColor?: string;
  /** Sublabel for primary value, e.g. "KCAL / DAY AVG" or "KCAL REMAINING" */
  primaryLabel: string;

  /** Status badge pill text, e.g. "-2,160 kcal Under" or "On Target" */
  statusBadgeText?: string;
  /** Color tone for status badge */
  statusBadgeTone?: 'emerald' | 'cyan' | 'amber' | 'slate' | 'rose';

  /** 3 bottom stat cards: [Stat 1, Stat 2, Stat 3] */
  stats: [NutritionHeroStatItem, NutritionHeroStatItem, NutritionHeroStatItem];

  /** Optional child elements below (e.g. weekly budget bar or copilot insight) */
  children?: React.ReactNode;
  style?: ViewStyle;
}

export function NutritionHeroCard({
  headerTitle,
  headerSubtitle,
  headerIcon,
  headerBadgeLabel,
  headerBadgeTone = 'slate',
  percentage,
  gaugeColor,
  gaugeGradient,
  gaugeSize = 196,
  centerIcon,
  primaryValue,
  primaryValueColor,
  primaryLabel,
  statusBadgeText,
  statusBadgeTone = 'slate',
  stats,
  children,
  style,
}: NutritionHeroCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  // Determine status pill colors based on tone
  const getToneColors = (tone: 'emerald' | 'cyan' | 'amber' | 'slate' | 'rose') => {
    switch (tone) {
      case 'emerald':
        return {
          bg: colors.primarySurface,
          border: colors.borderGlow,
          text: colors.primaryLight,
        };
      case 'cyan':
        return {
          bg: `${colors.cyan}14`,
          border: `${colors.cyan}35`,
          text: colors.cyan,
        };
      case 'amber':
        return {
          bg: `${colors.amber}16`,
          border: `${colors.amber}40`,
          text: colors.amber,
        };
      case 'rose':
        return {
          bg: `${colors.rose}16`,
          border: `${colors.rose}40`,
          text: colors.rose,
        };
      case 'slate':
      default:
        return {
          bg: colors.surfaceHover,
          border: colors.borderSubtle,
          text: colors.textMuted,
        };
    }
  };

  const statusColors = getToneColors(statusBadgeTone);

  return (
    <Card elevated style={[styles.card, style]}>
      {/* 1. Optional Header */}
      {(headerTitle || headerBadgeLabel) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {headerIcon && <View style={styles.headerIconCircle}>{headerIcon}</View>}
            <View style={styles.headerTextWrap}>
              {headerTitle && <Text style={styles.headerTitle}>{headerTitle}</Text>}
              {headerSubtitle && <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>}
            </View>
          </View>
          {headerBadgeLabel && (
            <Badge label={headerBadgeLabel} tone={headerBadgeTone} />
          )}
        </View>
      )}

      {/* 2. Main Arc Gauge Section */}
      <View style={styles.gaugeContainer}>
        <ArcGauge
          percentage={percentage}
          size={gaugeSize}
          strokeWidth={13}
          arcAngle={220}
          color={gaugeColor}
          gradientTo={gaugeGradient}
          delay={150}
        >
          <View style={styles.gaugeCenter}>
            {centerIcon && <View style={styles.centerIconPill}>{centerIcon}</View>}
            <Text
              style={[
                styles.primaryValue,
                primaryValueColor ? { color: primaryValueColor } : null,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {primaryValue}
            </Text>
            <Text style={styles.primaryLabel}>{primaryLabel}</Text>

            {statusBadgeText ? (
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: statusColors.bg,
                    borderColor: statusColors.border,
                  },
                ]}
              >
                <Text style={[styles.statusPillText, { color: statusColors.text }]} numberOfLines={1}>
                  {statusBadgeText}
                </Text>
              </View>
            ) : null}
          </View>
        </ArcGauge>
      </View>

      {/* 3. Three Elevated Stat Cards */}
      <View style={styles.statsRow}>
        {stats.map((stat, idx) => {
          const badgeColors = stat.badgeTone ? getToneColors(stat.badgeTone) : null;
          return (
            <View
              key={idx}
              style={[
                styles.statCard,
                stat.highlight && {
                  borderColor: stat.accentColor ? `${stat.accentColor}50` : colors.borderGlow,
                  backgroundColor: stat.accentColor ? `${stat.accentColor}0D` : colors.primarySurface,
                },
              ]}
            >
              <View style={styles.statCardHeader}>
                {stat.icon && (
                  <View
                    style={[
                      styles.statIconBadge,
                      {
                        backgroundColor: stat.accentColor
                          ? `${stat.accentColor}18`
                          : `${colors.primaryLight}18`,
                      },
                    ]}
                  >
                    {stat.icon}
                  </View>
                )}
                <Text style={styles.statCardLabel} numberOfLines={1}>
                  {stat.label}
                </Text>
              </View>

              <View style={styles.statCardValueWrap}>
                <Text
                  style={[
                    styles.statCardValue,
                    stat.accentColor ? { color: stat.accentColor } : null,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {stat.value}
                </Text>
                {stat.unit && <Text style={styles.statCardUnit}>{stat.unit}</Text>}
              </View>

              {stat.badgeText && badgeColors && (
                <View
                  style={[
                    styles.statPillTag,
                    {
                      backgroundColor: badgeColors.bg,
                      borderColor: badgeColors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.statPillTagText, { color: badgeColors.text }]}
                    numberOfLines={1}
                  >
                    {stat.badgeText}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* 4. Optional Extra Content (Budget bar, copilot insight, etc.) */}
      {children}
    </Card>
  );
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  card: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 1,
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  gaugeCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  centerIconPill: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  primaryValue: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 40,
    textAlign: 'center',
  },
  primaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 1,
    textAlign: 'center',
  },
  statusPill: {
    marginTop: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  statIconBadge: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statCardValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  statCardValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statCardUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  statPillTag: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statPillTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
}));
