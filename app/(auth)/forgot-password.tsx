import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import {
  Dumbbell,
  Mail,
  KeyRound,
  Lock,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  Check,
  RefreshCw,
} from 'lucide-react-native';
import { api, extractErrorMessage } from '../../src/api/client';
import { Button, Input, Card, useToast } from '../../src/components/ui';
import { radius, spacing, makeStyles, useTheme } from '../../src/theme';
import { haptics } from '../../src/lib/haptics';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ email?: string }>();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const shake = () => {
    shakeX.set(
      withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 70 }),
        withTiming(-6, { duration: 60 }),
        withTiming(6, { duration: 60 }),
        withTiming(0, { duration: 50 })
      )
    );
  };

  const requestMutation = useMutation({
    mutationFn: () => api.requestPasswordReset(email.trim().toLowerCase()),
    onSuccess: () => {
      haptics.success();
      setError(null);
      setStep('code');
      toast({ message: `6-digit reset code sent to ${email.trim()}` });
    },
    onError: (err) => {
      haptics.error();
      setError(extractErrorMessage(err));
      shake();
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.confirmPasswordReset(email.trim().toLowerCase(), code.trim(), password),
    onSuccess: () => {
      haptics.success();
      toast({ message: 'Password updated successfully! Sign in with your new password.' });
      router.replace('/(auth)/login');
    },
    onError: (err) => {
      haptics.error();
      setError(extractErrorMessage(err));
      shake();
    },
  });

  const sendCode = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      haptics.warning();
      shake();
      return;
    }
    setError(null);
    requestMutation.mutate();
  };

  const resetPassword = () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Please enter the 6-digit code received via email.');
      haptics.warning();
      shake();
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.');
      haptics.warning();
      shake();
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      haptics.warning();
      shake();
      return;
    }
    setError(null);
    confirmMutation.mutate();
  };

  // Password criteria indicators
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordsMatch = Boolean(confirm && password === confirm);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Ambient Background Aura */}
          <View style={styles.ambientAura} />

          <View style={styles.contentWrapper}>
            {/* Top Back Navigation Link */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                haptics.selection();
                router.back();
              }}
              hitSlop={12}
            >
              <ArrowLeft size={16} color={colors.textSecondary} />
              <Text style={styles.backBtnText}>Back to Login</Text>
            </TouchableOpacity>

            {/* Brand Header */}
            <Animated.View entering={FadeInUp.duration(500)} style={styles.brandContainer}>
              <View style={styles.badgePill}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>ACCOUNT SECURITY & RECOVERY</Text>
              </View>

              <View style={styles.logoIcon}>
                <KeyRound size={26} color={colors.primaryLight} strokeWidth={2.4} />
              </View>

              <View style={styles.logoTextRow}>
                <Text style={styles.brandTitle}>FIT</Text>
                <Text style={styles.brandTitleAccent}>LOG</Text>
              </View>
              <Text style={styles.brandTagline}>Password Recovery System</Text>
            </Animated.View>

            {/* Recovery Card */}
            <Animated.View entering={FadeInDown.delay(100).duration(500)}>
              <Animated.View style={shakeStyle}>
                <Card elevated style={styles.card}>
                  {/* Step Progress Pills */}
                  <View style={styles.stepProgressRow}>
                    <View
                      style={[
                        styles.stepPill,
                        step === 'email' ? styles.stepPillActive : styles.stepPillDone,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepPillText,
                          step === 'email' ? styles.stepPillTextActive : styles.stepPillTextDone,
                        ]}
                      >
                        1. Verification Email
                      </Text>
                    </View>
                    <View style={styles.stepDivider} />
                    <View
                      style={[
                        styles.stepPill,
                        step === 'code' ? styles.stepPillActive : styles.stepPillInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepPillText,
                          step === 'code' ? styles.stepPillTextActive : styles.stepPillTextInactive,
                        ]}
                      >
                        2. New Password
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardTitle}>
                    {step === 'email' ? 'Reset your password' : 'Create new password'}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {step === 'email'
                      ? "Enter your account email and we'll send a 6-digit recovery code."
                      : `Enter the 6-digit code sent to ${email.trim()} and choose a strong password.`}
                  </Text>

                  {/* Error Alert Box */}
                  {error && (
                    <Animated.View
                      entering={FadeInDown.duration(200)}
                      style={styles.errorAlert}
                      accessibilityLiveRegion="assertive"
                    >
                      <AlertCircle size={16} color={colors.error} />
                      <Text style={styles.errorAlertText}>{error}</Text>
                    </Animated.View>
                  )}

                  {step === 'email' ? (
                    /* Step 1: Email Form */
                    <View>
                      <Input
                        label="Account Email"
                        placeholder="you@example.com"
                        value={email}
                        onChangeText={(v) => {
                          setEmail(v);
                          if (error) setError(null);
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                        autoFocus
                        returnKeyType="send"
                        onSubmitEditing={sendCode}
                        leftIcon={<Mail size={17} color={colors.textMuted} />}
                      />

                      <Button
                        title="Send Recovery Code"
                        variant="primary"
                        size="lg"
                        loading={requestMutation.isPending}
                        onPress={sendCode}
                        icon={<ArrowRight size={17} color="#FFFFFF" strokeWidth={2.5} />}
                        style={styles.actionBtn}
                      />
                    </View>
                  ) : (
                    /* Step 2: Code & New Password */
                    <View>
                      {/* 6-digit Code */}
                      <Input
                        label="6-Digit Verification Code"
                        placeholder="123456"
                        value={code}
                        onChangeText={(v) => {
                          setCode(v.replace(/\D/g, '').slice(0, 6));
                          if (error) setError(null);
                        }}
                        keyboardType="number-pad"
                        autoComplete="one-time-code"
                        textContentType="oneTimeCode"
                        autoFocus
                        returnKeyType="next"
                        onSubmitEditing={() => passwordRef.current?.focus()}
                        style={styles.codeInput}
                        hint="Check your inbox or spam folder"
                      />

                      {/* New Password */}
                      <Input
                        ref={passwordRef}
                        label="New Password"
                        placeholder="At least 8 characters"
                        value={password}
                        onChangeText={(v) => {
                          setPassword(v);
                          if (error) setError(null);
                        }}
                        secureTextEntry={!showPassword}
                        autoComplete="new-password"
                        textContentType="newPassword"
                        returnKeyType="next"
                        onSubmitEditing={() => confirmRef.current?.focus()}
                        leftIcon={<Lock size={17} color={colors.textMuted} />}
                        rightIcon={
                          <TouchableOpacity
                            onPress={() => {
                              haptics.selection();
                              setShowPassword(!showPassword);
                            }}
                            hitSlop={12}
                          >
                            {showPassword ? (
                              <EyeOff size={18} color={colors.textMuted} />
                            ) : (
                              <Eye size={18} color={colors.textMuted} />
                            )}
                          </TouchableOpacity>
                        }
                      />

                      {/* Live Password Criteria Chips */}
                      {password.length > 0 && (
                        <View style={styles.criteriaRow}>
                          <View
                            style={[
                              styles.criteriaPill,
                              hasMinLength && styles.criteriaPillValid,
                            ]}
                          >
                            {hasMinLength && (
                              <Check size={11} color={colors.primaryLight} strokeWidth={2.5} />
                            )}
                            <Text
                              style={[
                                styles.criteriaText,
                                hasMinLength && styles.criteriaTextValid,
                              ]}
                            >
                              8+ characters
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.criteriaPill,
                              hasLetter && styles.criteriaPillValid,
                            ]}
                          >
                            {hasLetter && (
                              <Check size={11} color={colors.primaryLight} strokeWidth={2.5} />
                            )}
                            <Text
                              style={[
                                styles.criteriaText,
                                hasLetter && styles.criteriaTextValid,
                              ]}
                            >
                              Includes letter
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.criteriaPill,
                              hasNumberOrSymbol && styles.criteriaPillValid,
                            ]}
                          >
                            {hasNumberOrSymbol && (
                              <Check size={11} color={colors.primaryLight} strokeWidth={2.5} />
                            )}
                            <Text
                              style={[
                                styles.criteriaText,
                                hasNumberOrSymbol && styles.criteriaTextValid,
                              ]}
                            >
                              Number or symbol
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Confirm New Password */}
                      <View>
                        <Input
                          ref={confirmRef}
                          label="Confirm New Password"
                          placeholder="Re-enter your new password"
                          value={confirm}
                          onChangeText={(v) => {
                            setConfirm(v);
                            if (error) setError(null);
                          }}
                          secureTextEntry={!showConfirm}
                          autoComplete="new-password"
                          textContentType="newPassword"
                          returnKeyType="go"
                          onSubmitEditing={resetPassword}
                          leftIcon={<Lock size={17} color={colors.textMuted} />}
                          rightIcon={
                            <TouchableOpacity
                              onPress={() => {
                                haptics.selection();
                                setShowConfirm(!showConfirm);
                              }}
                              hitSlop={12}
                            >
                              {showConfirm ? (
                                <EyeOff size={18} color={colors.textMuted} />
                              ) : (
                                <Eye size={18} color={colors.textMuted} />
                              )}
                            </TouchableOpacity>
                          }
                        />
                        {passwordsMatch && (
                          <View style={styles.matchBadge}>
                            <Check size={12} color={colors.primaryLight} strokeWidth={2.5} />
                            <Text style={styles.matchText}>Passwords match</Text>
                          </View>
                        )}
                      </View>

                      {/* Reset Submit */}
                      <Button
                        title="Update Password"
                        variant="primary"
                        size="lg"
                        loading={confirmMutation.isPending}
                        onPress={resetPassword}
                        icon={<Check size={17} color="#FFFFFF" strokeWidth={2.5} />}
                        style={styles.actionBtn}
                      />

                      {/* Resend Code Options */}
                      <View style={styles.resendRow}>
                        <TouchableOpacity
                          style={styles.resendBtn}
                          onPress={() => {
                            haptics.selection();
                            requestMutation.mutate();
                          }}
                          disabled={requestMutation.isPending}
                        >
                          <RefreshCw size={13} color={colors.primaryLight} />
                          <Text style={styles.resendText}>Resend code</Text>
                        </TouchableOpacity>

                        <Text style={styles.resendDot}>•</Text>

                        <TouchableOpacity
                          style={styles.resendBtn}
                          onPress={() => {
                            haptics.selection();
                            setStep('email');
                            setError(null);
                          }}
                        >
                          <Text style={styles.changeEmailText}>Change email</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Footer Return to Login */}
                  <View style={styles.footerRow}>
                    <Text style={styles.footerText}>Remember your password? </Text>
                    <TouchableOpacity
                      onPress={() => {
                        haptics.selection();
                        router.replace('/(auth)/login');
                      }}
                      hitSlop={8}
                    >
                      <Text style={styles.footerLink}>Log In</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </Animated.View>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors, shadows, isDark }) => ({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ambientAura: {
    position: 'absolute',
    top: -60,
    width: 320,
    height: 220,
    borderRadius: 160,
    backgroundColor: colors.primaryLight,
    opacity: isDark ? 0.08 : 0.05,
    alignSelf: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 420,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryLight,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.6,
  },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.primaryLight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.25 : 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  logoTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 27,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 1.2,
  },
  brandTitleAccent: {
    fontSize: 27,
    fontWeight: '900',
    color: colors.primaryLight,
    letterSpacing: 1.2,
  },
  brandTagline: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: spacing.xs - 2,
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  card: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  stepProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  stepPill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm + 1,
  },
  stepPillActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.3 : 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  stepPillDone: {
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(15, 118, 110, 0.08)',
  },
  stepPillInactive: {
    backgroundColor: 'transparent',
  },
  stepPillText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  stepPillTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  stepPillTextDone: {
    color: colors.primaryLight,
    fontWeight: '600',
  },
  stepPillTextInactive: {
    color: colors.textMuted,
  },
  stepDivider: {
    width: 6,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs - 2,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBackground,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 12.5,
    color: colors.error,
    fontWeight: '500',
    lineHeight: 17,
  },
  codeInput: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
  },
  criteriaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  criteriaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.canvas,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  criteriaPillValid: {
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(15, 118, 110, 0.08)',
  },
  criteriaText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: colors.textMuted,
  },
  criteriaTextValid: {
    color: colors.primaryLight,
    fontWeight: '600',
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: -spacing.md + 2,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(15, 118, 110, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  matchText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  actionBtn: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  resendText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  resendDot: {
    color: colors.textMuted,
    fontSize: 12,
  },
  changeEmailText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.xs,
  },
  footerText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryLight,
  },
}));
