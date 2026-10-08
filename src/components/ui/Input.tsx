import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  ViewStyle,
  Platform,
} from 'react-native';
import { radius, spacing, makeStyles, useTheme } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  ref?: React.Ref<TextInput>;
}

export function Input({
  label,
  error,
  hint,
  containerStyle,
  leftIcon,
  rightIcon,
  style,
  onFocus,
  onBlur,
  ref,
  ...rest
}: InputProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputWrapperFocused,
          !!error && styles.inputWrapperError,
        ]}
      >
        {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primaryLight}
          cursorColor={colors.primaryLight}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightIcon && <View style={styles.iconContainer}>{rightIcon}</View>}
      </View>
      {error ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  hintText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.xs,
    marginLeft: 2,
  },
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs + 2,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
        } as any)
      : {}),
  },
  inputWrapperFocused: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 0 3px rgba(15, 118, 110, 0.15)',
        } as any)
      : {}),
  },
  inputWrapperError: {
    borderColor: colors.error,
    backgroundColor: colors.errorBackground,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)',
        } as any)
      : {}),
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    paddingVertical: Platform.OS === 'web' ? spacing.md : spacing.sm,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
        } as any)
      : {}),
  },
  iconContainer: {
    marginHorizontal: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
}));
