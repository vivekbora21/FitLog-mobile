import React, { useRef, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dumbbell,
  Mail,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react-native';
import { useAuth } from '../../src/providers/auth';
import { extractErrorMessage } from '../../src/api/client';
import { Button, Input, Card } from '../../src/components/ui';
import { radius, spacing, makeStyles, useTheme } from '../../src/theme';
import { haptics } from '../../src/lib/haptics';

const signupSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, 'First name is required')
      .min(2, 'First name must be at least 2 characters')
      .max(50, 'First name cannot exceed 50 characters')
      .refine((val) => !/[0-9<>{}\[\]\\]/.test(val), {
        message: 'First name contains invalid characters',
      }),
    lastName: z
      .string()
      .trim()
      .min(1, 'Last name is required')
      .max(50, 'Last name cannot exceed 50 characters')
      .refine((val) => !/[0-9<>{}\[\]\\]/.test(val), {
        message: 'Last name contains invalid characters',
      }),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password cannot exceed 128 characters')
      .refine((val) => /[a-zA-Z]/.test(val), {
        message: 'Password must contain at least one letter',
      })
      .refine((val) => /[0-9!@#$%^&*(),.?":{}|<>]/.test(val), {
        message: 'Password must contain at least one number or symbol',
      }),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupScreen() {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { register: registerUser } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

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

  const {
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password') || '';
  const confirmPasswordValue = watch('confirmPassword') || '';

  // Password Strength Calculation
  const hasMinLength = passwordValue.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(passwordValue);
  const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(passwordValue);
  const isComplex =
    passwordValue.length >= 10 &&
    /[0-9]/.test(passwordValue) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(passwordValue);

  let strengthScore = 0;
  if (hasMinLength) strengthScore++;
  if (hasLetter) strengthScore++;
  if (hasNumberOrSymbol) strengthScore++;
  if (isComplex) strengthScore++;

  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthLabel = strengthLabels[strengthScore] || '';
  const strengthColors = [colors.border, '#EF4444', '#F59E0B', '#0D9488', '#059669'];
  const currentStrengthColor = strengthColors[strengthScore] || colors.border;
  const passwordsMatch = Boolean(confirmPasswordValue && passwordValue === confirmPasswordValue);

  const onSubmit = async (data: SignupFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await registerUser({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
      });
      haptics.success();
      router.replace('/onboarding');
    } catch (err: any) {
      const msg = extractErrorMessage(err) || 'Failed to create account. Please try again.';
      setServerError(msg);

      const response = err?.response;
      if (response && typeof response === 'object') {
        if (response.first_name) {
          setError('firstName', {
            message: Array.isArray(response.first_name) ? response.first_name[0] : response.first_name,
          });
        }
        if (response.last_name) {
          setError('lastName', {
            message: Array.isArray(response.last_name) ? response.last_name[0] : response.last_name,
          });
        }
        if (response.email) {
          setError('email', {
            message: Array.isArray(response.email) ? response.email[0] : response.email,
          });
        }
        if (response.password) {
          setError('password', {
            message: Array.isArray(response.password) ? response.password[0] : response.password,
          });
        }
      }

      haptics.error();
      shake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const onInvalid = () => {
    haptics.warning();
    shake();
  };

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
          {/* Subtle Ambient Background Aura */}
          <View style={styles.ambientAura} />

          <View style={styles.contentWrapper}>
            {/* Top Back Navigation */}
            {router.canGoBack() && (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  haptics.selection();
                  router.back();
                }}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <ArrowLeft size={16} color={colors.textSecondary} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            )}

            {/* Athletic Brand Header */}
            <Animated.View entering={FadeInUp.duration(500)} style={styles.brandContainer}>
              <View style={styles.badgePill}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>ATHLETIC PERFORMANCE SYSTEM</Text>
              </View>

              <View style={styles.logoIcon}>
                <Dumbbell size={28} color={colors.primaryLight} strokeWidth={2.4} />
              </View>

              <View style={styles.logoTextRow}>
                <Text style={styles.brandTitle}>FIT</Text>
                <Text style={styles.brandTitleAccent}>LOG</Text>
              </View>
              <Text style={styles.brandTagline}>Start Your Athletic Transformation</Text>
            </Animated.View>

            {/* Signup Card */}
            <Animated.View entering={FadeInDown.delay(100).duration(500)}>
              <Animated.View style={shakeStyle}>
                <Card elevated style={styles.card}>
                  {/* Top Segmented Tab Switcher */}
                  <View style={styles.segmentedControl}>
                    <TouchableOpacity
                      style={styles.segmentBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        haptics.selection();
                        router.push('/(auth)/login');
                      }}
                    >
                      <Text style={styles.segmentText}>Log In</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.segmentBtn, styles.segmentBtnActive]}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.segmentText, styles.segmentTextActive]}>Sign Up</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.cardTitle}>Join FitLog</Text>
                  <Text style={styles.cardSubtitle}>
                    Track your hypertrophy, workouts, and macro pacing.
                  </Text>

                  {/* Server Error Alert */}
                  {serverError && (
                    <Animated.View entering={FadeInDown.duration(200)} style={styles.errorAlert}>
                      <AlertCircle size={16} color={colors.error} />
                      <Text style={styles.errorAlertText}>{serverError}</Text>
                    </Animated.View>
                  )}

                  {/* First Name & Last Name */}
                  <View style={styles.nameRow}>
                    <View style={styles.nameCol}>
                      <Controller
                        control={control}
                        name="firstName"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            label="First Name"
                            placeholder="Alex"
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            returnKeyType="next"
                            onSubmitEditing={() => lastNameRef.current?.focus()}
                            error={errors.firstName?.message}
                            leftIcon={<User size={16} color={colors.textMuted} />}
                            autoCapitalize="words"
                          />
                        )}
                      />
                    </View>
                    <View style={styles.nameCol}>
                      <Controller
                        control={control}
                        name="lastName"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            ref={lastNameRef}
                            label="Last Name"
                            placeholder="Chen"
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            returnKeyType="next"
                            onSubmitEditing={() => emailRef.current?.focus()}
                            error={errors.lastName?.message}
                            leftIcon={<User size={16} color={colors.textMuted} />}
                            autoCapitalize="words"
                          />
                        )}
                      />
                    </View>
                  </View>

                  {/* Email Field */}
                  <Controller
                    control={control}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        ref={emailRef}
                        label="Email"
                        placeholder="you@example.com"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                        returnKeyType="next"
                        onSubmitEditing={() => passwordRef.current?.focus()}
                        error={errors.email?.message}
                        leftIcon={<Mail size={17} color={colors.textMuted} />}
                      />
                    )}
                  />

                  {/* Password Field */}
                  <Controller
                    control={control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        ref={passwordRef}
                        label="Password"
                        placeholder="At least 8 characters"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        secureTextEntry={!showPassword}
                        autoComplete="new-password"
                        textContentType="newPassword"
                        returnKeyType="next"
                        onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                        error={errors.password?.message}
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
                    )}
                  />

                  {/* Interactive Password Strength Indicator */}
                  {passwordValue.length > 0 && (
                    <Animated.View entering={FadeInDown.duration(200)} style={styles.strengthContainer}>
                      <View style={styles.strengthHeader}>
                        <Text style={styles.strengthHeading}>PASSWORD STRENGTH</Text>
                        <Text style={[styles.strengthValue, { color: currentStrengthColor }]}>
                          {strengthLabel}
                        </Text>
                      </View>

                      {/* 4 Strength Bars */}
                      <View style={styles.strengthBarsRow}>
                        {[1, 2, 3, 4].map((step) => {
                          const isActive = strengthScore >= step;
                          return (
                            <View
                              key={step}
                              style={[
                                styles.strengthBar,
                                {
                                  backgroundColor: isActive ? currentStrengthColor : colors.borderSubtle,
                                },
                              ]}
                            />
                          );
                        })}
                      </View>

                      {/* Live Criteria Chips */}
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
                    </Animated.View>
                  )}

                  {/* Confirm Password Field */}
                  <Controller
                    control={control}
                    name="confirmPassword"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <View>
                        <Input
                          ref={confirmPasswordRef}
                          label="Confirm Password"
                          placeholder="Re-enter your password"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          secureTextEntry={!showConfirmPassword}
                          autoComplete="new-password"
                          textContentType="newPassword"
                          returnKeyType="go"
                          onSubmitEditing={handleSubmit(onSubmit, onInvalid)}
                          error={errors.confirmPassword?.message}
                          leftIcon={<Lock size={17} color={colors.textMuted} />}
                          rightIcon={
                            <TouchableOpacity
                              onPress={() => {
                                haptics.selection();
                                setShowConfirmPassword(!showConfirmPassword);
                              }}
                              hitSlop={12}
                            >
                              {showConfirmPassword ? (
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
                    )}
                  />

                  {/* Submit Button */}
                  <Button
                    title="Create Account"
                    variant="primary"
                    size="lg"
                    loading={isSubmitting}
                    onPress={handleSubmit(onSubmit, onInvalid)}
                    icon={<ArrowRight size={17} color="#FFFFFF" strokeWidth={2.5} />}
                    style={styles.submitBtn}
                  />

                  {/* Return to Login */}
                  <View style={styles.footerRow}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <TouchableOpacity
                      onPress={() => {
                        haptics.selection();
                        router.push('/(auth)/login');
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
    paddingHorizontal: 4,
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
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm + 1,
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.3 : 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
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
  nameRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  nameCol: {
    flex: 1,
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
  strengthContainer: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    marginTop: -spacing.xs,
    marginBottom: spacing.lg,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  strengthHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  strengthValue: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  strengthBarsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: spacing.sm,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
  },
  criteriaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
  submitBtn: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
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
