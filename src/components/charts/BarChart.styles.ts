import { makeStyles, radius, spacing } from '../../theme';

export const useStyles = makeStyles(({ colors, shadows }) => ({
  container: {
    marginTop: spacing.xs,
  },
  plotArea: {
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: colors.borderSubtle,
    opacity: 0.6,
  },
  axisLabel: {
    position: 'absolute',
    right: 0,
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'right',
  },
  barsRow: {
    position: 'absolute',
    bottom: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barColumn: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barValueLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 3,
  },
  bar: {
    width: '70%',
    borderRadius: radius.sm,
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  barLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9.5,
    fontWeight: '600',
    color: colors.textMuted,
  },
  selectedBadge: {
    position: 'absolute',
    top: 2,
    right: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.elevated,
  },
  selectedBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  selectedBadgeValue: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 220,
  },
}));
