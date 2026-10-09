import { makeStyles, radius, spacing } from '../../theme';

export const useStyles = makeStyles(({ colors }) => ({
  container: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  // KPI
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  metricCard: {
    flex: 1,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  // Additive: marks the single primary KPI card (This Week Avg) so it reads first.
  metricCardPrimary: {
    borderColor: colors.primaryLight,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  metricUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  metricTarget: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  metricAdherenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.xs,
  },
  metricStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metricAdherenceText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    flexShrink: 1,
  },
  // Chart card
  chartCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  chartHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chartIconBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: `${colors.primaryLight}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  chartSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 1,
  },
  // Metric selector
  metricSelectorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  metricSelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  metricSelectorText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  // Period filter wrapper (the filter itself is the shared PeriodFilter component)
  periodFilterWrap: {
    marginBottom: spacing.sm,
  },
  // Chart container
  chartContainer: {
    marginTop: spacing.xs,
  },
  chartStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  chartStatPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  chartStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chartStatValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 1,
  },
  chartStatUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  // Tooltip
  tooltip: {
    position: 'absolute',
    top: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderWidth: 1.5,
    minWidth: 108,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  tooltipDate: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
  },
  tooltipValue: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  tooltipUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tooltipVsTarget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  tooltipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  tooltipVsText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  // Empty chart
  emptyChartBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyChartText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 220,
  },
  // Macro split
  macroSplitContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  macroSplitTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  macroSplitBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.full,
    overflow: 'hidden',
    gap: 2,
    backgroundColor: colors.surfaceElevated,
  },
  macroSplitSeg: {
    height: '100%',
  },
  macroSplitLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs + 2,
  },
  macroSplitText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // Weekly breakdown
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionSub: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  weekCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentWeekCard: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.surfaceElevated,
  },
  weekCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  weekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  weekDates: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  weekNutrientsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.xs,
  },
  nutrientPill: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  dotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nutrientPillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 2,
  },
  nutrientPillVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 1,
  },
  nutrientPillUnit: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
  },
  nutrientPillDelta: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
  nutrientPillTarget: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 1,
  },
  weightCorrelationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  weightCorrelationText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  weightBold: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  weekInsight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: colors.primarySurface,
    padding: spacing.xs + 2,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  weekInsightText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 15,
  },
  weekEmptyNotice: {
    paddingVertical: spacing.sm,
  },
  weekEmptyNoticeText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  // Bottom CTA
  bottomCtaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
  },
  bottomCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bottomCtaTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomCtaSub: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 1,
  },
}));
