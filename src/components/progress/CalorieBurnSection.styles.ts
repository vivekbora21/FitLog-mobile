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
    backgroundColor: `${colors.rose}22`,
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
  periodFilterWrap: {
    marginBottom: spacing.sm,
  },
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
}));
