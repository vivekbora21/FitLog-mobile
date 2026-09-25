import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Mail } from 'lucide-react-native';
import { api, extractErrorMessage } from '../../src/api/client';
import { Button, Input, SheetScreen, useToast } from '../../src/components/ui';
import { makeStyles, spacing, useTheme } from '../../src/theme';
import { haptics } from '../../src/lib/haptics';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ email?: string }>();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const requestMutation = useMutation({
    mutationFn: () => api.requestPasswordReset(email),
    onSuccess: () => {
      haptics.success();
      setError(null);
      setStep('code');
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.confirmPasswordReset(email, code, password),
    onSuccess: () => {
      haptics.success();
      toast({ message: 'Password updated. Sign in with your new password.' });
      router.back();
    },
    onError: (err) => {
      haptics.error();
      setError(extractErrorMessage(err));
    },
  });

  const sendCode = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter the email address you signed up with.');
      return;
    }
    requestMutation.mutate();
  };

  const resetPassword = () => {
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code from the email.');
    if (password.length < 8) return setError('Use at least 8 characters for your new password.');
    if (password !== confirm) return setError("The two passwords don't match.");
    setError(null);
    confirmMutation.mutate();
  };

  return (
    <SheetScreen
      title="Reset password"
      subtitle={step === 'email' ? "We'll email you a 6-digit code" : `Code sent to ${email.trim()}`}
      footer={
        step === 'email' ? (
          <Button title="Send code" size="lg" loading={requestMutation.isPending} onPress={sendCode} />
        ) : (
          <Button title="Set new password" size="lg" loading={confirmMutation.isPending} onPress={resetPassword} />
        )
      }
    >
      {step === 'email' ? (
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          autoFocus
          returnKeyType="send"
          onSubmitEditing={sendCode}
          leftIcon={<Mail size={18} color={colors.textMuted} />}
        />
      ) : (
        <>
          <Input
            label="6-digit code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            style={styles.code}
          />
          <Input
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            leftIcon={<KeyRound size={18} color={colors.textMuted} />}
          />
          <Input
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={resetPassword}
            leftIcon={<KeyRound size={18} color={colors.textMuted} />}
          />
          <Button
            title="Didn't get it? Send a new code"
            variant="ghost"
            size="sm"
            loading={requestMutation.isPending}
            onPress={() => requestMutation.mutate()}
          />
        </>
      )}

      {error ? (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </SheetScreen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  code: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 8,
  },
  errorBox: {
    marginTop: spacing.md,
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
