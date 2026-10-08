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
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Users,
  ShieldCheck,
  Check,
} from 'lucide-react-native';
import { useAuth } from '../../src/providers/auth';
import { extractErrorMessage } from '../../src/api/client';
import { Button, Input, Card } from '../../src/components/ui';
import { radius, spacing, makeStyles, useTheme } from '../../src/theme';
import { haptics } from '../../src/lib/haptics';
import { getFlag } from '../../src/lib/secureStore';
import { needsOnboarding, onboardingSkipKey } from '../../src/lib/onboarding';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface DemoPersona {
  id: string;
  name: string;
  role: string;
  sub: string;
  email: string;
  IconComponent: typeof Dumbbell;
}

const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: 'alex',
    name: 'Alex',
    role: 'Member',
    sub: 'Lifter',
    email: 'alex.member@example.com',
    IconComponent: Dumbbell,
  },
  {
    id: 'marcus',
    name: 'Marcus',
    role: 'Coach',
    sub: 'Trainer',
    email: 'coach.marcus@apexfit.com',
    IconComponent: Users,
  },
  {
    id: 'david',
    name: 'David',
    role: 'Owner',
    sub: 'Admin',
    email: 'owner@apexfit.com',
    IconComponent: ShieldCheck,
  },
];

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

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
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const loggedUser = await login(data.email, data.password);
      haptics.success();
      const skipped = await getFlag(onboardingSkipKey(loggedUser.id));
      if (!skipped && needsOnboarding(loggedUser.profile)) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      const msg = extractErrorMessage(err) || 'Invalid email or password.';
      setServerError(msg);
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

  const fillDemoCredentials = (persona: DemoPersona) => {
    haptics.selection();
    setSelectedPersona(persona.id);
    setValue('email', persona.email, { shouldValidate: true });
    setValue('password', 'fitlog123', { shouldValidate: true });
    setServerError(null);
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
              <Text style={styles.brandTagline}>Precision Athletic & Hypertrophy Tracking</Text>
            </Animated.View>

            {/* Login Card */}
            <Animated.View entering={FadeInDown.delay(100).duration(500)}>
              <Animated.View style={shakeStyle}>
                <Card elevated style={styles.loginCard}>
                  {/* Top Segmented Tab Switcher */}
                  <View style={styles.segmentedControl}>
                    <TouchableOpacity
                      style={[styles.segmentBtn, styles.segmentBtnActive]}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.segmentText, styles.segmentTextActive]}>Log In</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.segmentBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        haptics.selection();
                        router.push('/(auth)/signup' as any);
                      }}
                    >
                      <Text style={styles.segmentText}>Sign Up</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.cardTitle}>Welcome back</Text>
                  <Text style={styles.cardSubtitle}>
                    Log in to synchronize your workouts, macros, and pacing.
                  </Text>

                  {/* Server Error Alert */}
                  {serverError && (
                    <Animated.View
                      entering={FadeInDown.duration(200)}
                      style={styles.errorAlert}
                      accessibilityLiveRegion="assertive"
                    >
                      <AlertCircle size={16} color={colors.error} />
                      <Text style={styles.errorAlertText}>{serverError}</Text>
                    </Animated.View>
                  )}

                  {/* Email Input */}
                  <Controller
                    control={control}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Email"
                        placeholder="you@example.com"
                        value={value}
                        onChangeText={(val) => {
                          setSelectedPersona(null);
                          onChange(val);
                        }}
                        onBlur={onBlur}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="username"
                        returnKeyType="next"
                        submitBehavior="submit"
                        onSubmitEditing={() => passwordRef.current?.focus()}
                        error={errors.email?.message}
                        leftIcon={<Mail size={17} color={colors.textMuted} />}
                      />
                    )}
                  />

                  {/* Password Input */}
                  <Controller
                    control={control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Password"
                        placeholder="••••••••"
                        value={value}
                        onChangeText={(val) => {
                          setSelectedPersona(null);
                          onChange(val);
                        }}
                        onBlur={onBlur}
                        ref={passwordRef}
                        secureTextEntry={!showPassword}
                        autoComplete="current-password"
                        textContentType="password"
                        returnKeyType="go"
                        onSubmitEditing={handleSubmit(onSubmit, onInvalid)}
                        error={errors.password?.message}
                        leftIcon={<Lock size={17} color={colors.textMuted} />}
                        rightIcon={
                          <TouchableOpacity
                            onPress={() => {
                              haptics.selection();
                              setShowPassword(!showPassword);
                            }}
                            hitSlop={12}
                            accessibilityRole="button"
                            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
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

                  {/* Forgot Password Link */}
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      router.push('/(auth)/forgot-password');
                    }}
                    hitSlop={8}
                    style={styles.forgotLink}
                    accessibilityRole="link"
                  >
                    <Text style={styles.forgotLinkText}>Forgot password?</Text>
                  </TouchableOpacity>

                  {/* Submit Button */}
                  <Button
                    title="Log In"
                    variant="primary"
                    size="lg"
                    loading={isSubmitting}
                    onPress={handleSubmit(onSubmit, onInvalid)}
                    icon={<ArrowRight size={17} color="#FFFFFF" strokeWidth={2.5} />}
                    style={styles.submitBtn}
                  />

                  {/* Quick Demo Access Personas */}
                  <View style={styles.demoSection}>
                    <View style={styles.demoDividerRow}>
                      <View style={styles.demoDividerLine} />
                      <View style={styles.demoDividerBadge}>
                        <Sparkles size={12} color={colors.primaryLight} />
                        <Text style={styles.demoDividerText}>QUICK DEMO LOGIN</Text>
                      </View>
                      <View style={styles.demoDividerLine} />
                    </View>

                    <View style={styles.demoCardsRow}>
                      {DEMO_PERSONAS.map((persona) => {
                        const isSelected = selectedPersona === persona.id;
                        const PersonaIcon = persona.IconComponent;
                        return (
                          <TouchableOpacity
                            key={persona.id}
                            style={[
                              styles.demoCard,
                              isSelected && styles.demoCardActive,
                            ]}
                            activeOpacity={0.75}
                            onPress={() => fillDemoCredentials(persona)}
                          >
                            <View
                              style={[
                                styles.demoCardIconWrap,
                                isSelected && styles.demoCardIconWrapActive,
                              ]}
                            >
                              {isSelected ? (
                                <Check size={14} color={colors.primaryLight} strokeWidth={2.5} />
                              ) : (
                                <PersonaIcon size={14} color={colors.textMuted} />
                              )}
                            </View>
                            <Text
                              style={[
                                styles.demoCardName,
                                isSelected && styles.demoCardNameActive,
                              ]}
                              numberOfLines={1}
                            >
                              {persona.name}
                            </Text>
                            <View
                              style={[
                                styles.demoCardRolePill,
                                isSelected && styles.demoCardRolePillActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.demoCardRoleText,
                                  isSelected && styles.demoCardRoleTextActive,
                                ]}
                              >
                                {persona.role}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Sign Up Link */}
                  <View style={styles.footerRow}>
                    <Text style={styles.footerText}>Don&apos;t have an account? </Text>
                    <TouchableOpacity
                      onPress={() => {
                        haptics.selection();
                        router.push('/(auth)/signup' as any);
                      }}
                      hitSlop={8}
                    >
                      <Text style={styles.footerLink}>Sign Up</Text>
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
  loginCard: {
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
    color: colors.error,
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 17,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
    paddingVertical: 2,
  },
  forgotLinkText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  submitBtn: {
    marginTop: 2,
    borderRadius: radius.md,
  },
  demoSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.xs,
  },
  demoDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  demoDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  demoDividerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  demoDividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  demoCardsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  demoCard: {
    flex: 1,
    minHeight: 74,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  demoCardActive: {
    borderColor: colors.primaryLight,
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 118, 110, 0.06)',
  },
  demoCardIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  demoCardIconWrapActive: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.surface,
  },
  demoCardName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  demoCardNameActive: {
    color: colors.primaryLight,
  },
  demoCardRolePill: {
    backgroundColor: colors.canvas,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  demoCardRolePillActive: {
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 118, 110, 0.12)',
  },
  demoCardRoleText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  demoCardRoleTextActive: {
    color: colors.primaryLight,
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
