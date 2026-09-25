import React from 'react';
import {
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  PressableProps,
} from 'react-native';
import { PressableScale } from './PressableScale';
import { radius, spacing, makeStyles, useTheme } from '../../theme';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  iconPosition = 'right',
  style,
  textStyle,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const getContainerStyle = (): ViewStyle[] => {
    const list: ViewStyle[] = [styles.base];

    // Size
    if (size === 'sm') list.push(styles.sizeSm);
    else if (size === 'lg') list.push(styles.sizeLg);
    else list.push(styles.sizeMd);

    // Variant
    if (variant === 'primary') list.push(styles.primary);
    else if (variant === 'secondary') list.push(styles.secondary);
    else if (variant === 'outline') list.push(styles.outline);
    else if (variant === 'ghost') list.push(styles.ghost);
    else if (variant === 'danger') list.push(styles.danger);

    if (disabled || loading) {
      list.push(styles.disabled);
    }

    if (style) list.push(style);

    return list;
  };

  const getTextStyle = (): TextStyle[] => {
    const list: TextStyle[] = [styles.textBase];

    if (size === 'sm') list.push(styles.textSm);
    else if (size === 'lg') list.push(styles.textLg);
    else list.push(styles.textMd);

    if (variant === 'outline') list.push(styles.textOutline);
    else if (variant === 'secondary') list.push(styles.textSecondary);
    else if (variant === 'ghost') list.push(styles.textGhost);
    else if (variant === 'danger') list.push(styles.textDanger);
    else list.push(styles.textPrimary);

    if (disabled) list.push(styles.textDisabled);
    if (textStyle) list.push(textStyle);

    return list;
  };

  return (
    <PressableScale
      disabled={disabled || loading}
      haptic={variant === 'ghost' ? 'selection' : 'light'}
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: loading }}
      style={getContainerStyle()}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? colors.primaryLight : '#FFFFFF'}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && <>{icon}</>}
          <Text style={getTextStyle()}>{title}</Text>
          {icon && iconPosition === 'right' && <>{icon}</>}
        </>
      )}
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  base: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  sizeSm: {
    minHeight: 36,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  sizeMd: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  sizeLg: {
    minHeight: 54,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  primary: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  secondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.error,
  },
  disabled: {
    opacity: 0.5,
  },
  textBase: {
    fontWeight: '700',
    textAlign: 'center',
  },
  textSm: {
    fontSize: 13,
  },
  textMd: {
    fontSize: 15,
  },
  textLg: {
    fontSize: 16,
  },
  textPrimary: {
    color: '#FFFFFF',
  },
  textSecondary: {
    color: colors.textPrimary,
  },
  textOutline: {
    color: colors.primaryLight,
  },
  textGhost: {
    color: colors.textSecondary,
  },
  textDanger: {
    color: '#FFFFFF',
  },
  textDisabled: {
    color: colors.textMuted,
  },
}));
