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
  trackCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trackIconBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackHeaderText: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  trackSub: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 1,
  },
  trackValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  tiersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  tierChip: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  tierChipEarned: {
    borderColor: 'transparent',
  },
  tierIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tierLabelEarned: {
    color: colors.textPrimary,
  },
  progressRow: {
    marginTop: spacing.xs,
    gap: 6,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressTextDone: {
    color: colors.primaryLight,
    fontWeight: '800',
  },
}));
