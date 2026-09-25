import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react-native';
import { api, ApiError, extractErrorMessage } from '../../src/api/client';
import { Button, Input, SheetScreen } from '../../src/components/ui';
import { useAuth } from '../../src/providers/auth';
import { clearWorkoutDraft } from '../../src/features/workout/draft';
import { makeStyles, radius, spacing, useTheme } from '../../src/theme';
import { haptics } from '../../src/lib/haptics';

const LOST = [
  'Every workout, set and personal record',
  'Meals, macro targets and water logs',
  'Weigh-ins, measurements and daily check-ins',
  'Your plans and gym memberships',
];

export default function DeleteAccountScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.deleteAccount(password),
    onSuccess: async () => {
      haptics.success();
      clearWorkoutDraft();
      queryClient.clear();
      await logout();
      router.replace('/(auth)/login');
    },
    onError: () => haptics.error(),
  });

  const confirmDelete = () => {
    haptics.warning();
    Alert.alert('Delete your account?', 'This is permanent and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: () => mutation.mutate() },
    ]);
  };

  const passwordErr =
    mutation.error instanceof ApiError && Array.isArray(mutation.error.data?.password)
      ? String(mutation.error.data.password[0])
      : undefined;

  return (
    <SheetScreen
      title="Delete account"
      footer={
        <Button
          title="Delete my account"
          variant="danger"
          size="lg"
          disabled={!password}
          loading={mutation.isPending}
          onPress={confirmDelete}
        />
      }
    >
      <View style={styles.warning}>
        <AlertTriangle size={20} color={colors.error} />
        <Text style={styles.warningTitle}>This permanently deletes:</Text>
      </View>
      {LOST.map((item) => (
        <Text key={item} style={styles.item}>
          •  {item}
        </Text>
      ))}

      <Input
        label="Enter your password to confirm"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        error={passwordErr}
        containerStyle={styles.input}
      />
      {mutation.error && !passwordErr ? (
        <Text style={styles.errorText}>{extractErrorMessage(mutation.error)}</Text>
      ) : null}
    </SheetScreen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.errorBackground,
    marginBottom: spacing.md,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.error,
  },
  item: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  input: {
    marginTop: spacing.xl,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
}));
