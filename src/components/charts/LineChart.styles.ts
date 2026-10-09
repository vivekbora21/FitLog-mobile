import { makeStyles, radius, spacing } from '../../theme';

export const useStyles = makeStyles(({ colors }) => ({
  container: {
    marginTop: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: spacing.sm,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: 2,
    gap: 2,
  },
  modeBtn: {
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  modeBtnActive: {
    backgroundColor: colors.surface,
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  modeBtnTextActive: {
    color: colors.primaryLight,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendSwatch: {
    width: 12,
    height: 3,
    borderRadius: 1.5,
  },
  legendDashed: {
    width: 12,
    height: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  scrubHint: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  chartWrap: {
    position: 'relative',
  },
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 220,
  },
  tooltip: {
    position: 'absolute',
    top: 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 150,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  tooltipDate: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  tooltipLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  tooltipValue: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    marginLeft: 'auto',
  },
  tooltipPositive: {
    color: colors.primaryLight,
  },
  tooltipNegative: {
    color: colors.amber,
  },
}));
