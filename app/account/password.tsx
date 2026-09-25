import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError, extractErrorMessage } from '../../src/api/client';
import { Button, Input, SheetScreen, useToast } from '../../src/components/ui';
import { makeStyles, spacing } from '../../src/theme';
import { haptics } from '../../src/lib/haptics';

function fieldError(err: unknown, field: string): string | undefined {
  const value = err instanceof ApiError ? err.data?.[field] : undefined;
  return Array.isArray(value) ? String(value[0]) : typeof value === 'string' ? value : undefined;
}

export default function ChangePasswordScreen() {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: () => {
      haptics.success();
      toast({ message: 'Password changed' });
      router.back();
    },
    onError: () => haptics.error(),
  });

  const submit = () => {
    if (!current) return setLocalError('Enter your current password.');
    if (next.length < 8) return setLocalError('Use at least 8 characters for your new password.');
    if (next !== confirm) return setLocalError("The two new passwords don't match.");
    setLocalError(null);
    mutation.mutate();
  };

  const oldErr = fieldError(mutation.error, 'old_password');
  const newErr = fieldError(mutation.error, 'new_password');
  const generalErr = localError ?? (mutation.error && !oldErr && !newErr ? extractErrorMessage(mutation.error) : null);

  return (
    <SheetScreen
      title="Change password"
      footer={<Button title="Update password" size="lg" loading={mutation.isPending} onPress={submit} />}
    >
      <Input
        label="Current password"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        error={oldErr}
        autoFocus
      />
      <Input
        label="New password"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={newErr}
      />
      <Input
        label="Confirm new password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {generalErr ? (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Text style={styles.errorText}>{generalErr}</Text>
        </View>
      ) : null}
    </SheetScreen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  errorBox: {
    padding: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.errorBackground,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
}));
