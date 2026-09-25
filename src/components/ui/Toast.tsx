import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

interface ToastOptions {
  message: string;
  /** e.g. "Undo" — pressing it runs `onAction` and dismisses the toast. */
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastState extends ToastOptions {
  id: number;
}

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

// Sits above the floating tab bar so undo prompts never hide behind it.
const TAB_BAR_OFFSET = 88;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const show = useCallback((options: ToastOptions) => {
    seq.current += 1;
    setToast({ ...options, id: seq.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    timer.current = setTimeout(() => setToast(null), toast.durationMs ?? (toast.actionLabel ? 5000 : 2500));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDismiss={() => setToast(null)} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_OFFSET }]}
      pointerEvents="box-none"
    >
      <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Text style={styles.message} numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.actionLabel ? (
          <PressableScale
            haptic="light"
            onPress={() => {
              toast.onAction?.();
              onDismiss();
            }}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={toast.actionLabel}
          >
            <Text style={[styles.actionText, { color: isDark ? colors.primary : colors.primaryLight }]}>{toast.actionLabel}</Text>
          </PressableScale>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.textPrimary,
    ...shadows.card,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
    paddingVertical: spacing.md,
  },
  action: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '800',
  },
}));
