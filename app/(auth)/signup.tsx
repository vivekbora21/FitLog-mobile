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
  AlertCircle,
  Eye,
  EyeOff,
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
  const { colors } = useTheme();
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
          {/* Brand Header */}
          <Animated.View entering={FadeInUp.duration(550)} style={styles.brandContainer}>
            <View style={styles.logoIcon}>
              <Dumbbell size={30} color={colors.primaryLight} strokeWidth={2.5} />
            </View>
            <View style={styles.logoTextRow}>
              <Text style={styles.brandTitle}>FIT</Text>
              <Text style={styles.brandTitleAccent}>LOG</Text>
            </View>
            <Text style={styles.brandTagline}>Create Your Athletic Account</Text>
          </Animated.View>

          {/* Signup Card */}
          <Animated.View entering={FadeInDown.delay(120).duration(550)}>
            <Animated.View style={shakeStyle}>
              <Card elevated style={styles.card}>
                <Text style={styles.cardTitle}>Join FitLog</Text>
                <Text style={styles.cardSubtitle}>
                  Track your hypertrophy, workouts, and macro pacing.
                </Text>

                {/* Server Error Alert */}
                {serverError && (
                  <Animated.View entering={FadeInDown.duration(250)} style={styles.errorAlert}>
                    <AlertCircle size={18} color={colors.error} />
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
                      leftIcon={<Mail size={18} color={colors.textMuted} />}
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
                      leftIcon={<Lock size={18} color={colors.textMuted} />}
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

                {/* Confirm Password Field */}
                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
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
                      leftIcon={<Lock size={18} color={colors.textMuted} />}
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
                  )}
                />

                {/* Submit Button */}
                <Button
                  title="Create Account"
                  variant="primary"
                  size="lg"
                  loading={isSubmitting}
                  onPress={handleSubmit(onSubmit, onInvalid)}
                  icon={<ArrowRight size={18} color="#FFFFFF" />}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.borderGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  logoTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 1.5,
  },
  brandTitleAccent: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.primaryLight,
    letterSpacing: 1.5,
  },
  brandTagline: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  card: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
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
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
    fontWeight: '500',
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
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
