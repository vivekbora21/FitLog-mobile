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
  AlertCircle,
  Eye,
  EyeOff,
  Server,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '../../src/providers/auth';
import { api, extractErrorMessage } from '../../src/api/client';
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

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(api.getBaseUrl());
  const passwordRef = useRef<TextInput>(null);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const shake = () => {
    shakeX.set(withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 70 }),
      withTiming(-6, { duration: 60 }),
      withTiming(6, { duration: 60 }),
      withTiming(0, { duration: 50 })
    ));
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

  const handleApplyServerUrl = () => {
    if (customServerUrl) {
      api.setBaseUrl(customServerUrl);
      setShowServerConfig(false);
      setServerError(null);
    }
  };

  const onInvalid = () => {
    haptics.warning();
    shake();
  };

  const fillDemoCredentials = (email: string) => {
    haptics.selection();
    setValue('email', email, { shouldValidate: true });
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
        {/* Brand Header */}
        <Animated.View entering={FadeInUp.duration(550)} style={styles.brandContainer}>
          <View style={styles.logoIcon}>
            <Dumbbell size={32} color={colors.primaryLight} strokeWidth={2.5} />
          </View>
          <View style={styles.logoTextRow}>
            <Text style={styles.brandTitle}>FIT</Text>
            <Text style={styles.brandTitleAccent}>LOG</Text>
          </View>
          <Text style={styles.brandTagline}>Precision Athletic & Hypertrophy Tracking</Text>
        </Animated.View>

        {/* Login Card */}
        <Animated.View entering={FadeInDown.delay(120).duration(550)}>
        <Animated.View style={shakeStyle}>
        <Card elevated style={styles.loginCard}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSubtitle}>
            Log in to synchronize your workouts, macros, and pacing.
          </Text>

          {/* Server Error Alert */}
          {serverError && (
            <Animated.View entering={FadeInDown.duration(250)} style={styles.errorAlert} accessibilityLiveRegion="assertive">
              <AlertCircle size={18} color={colors.error} />
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
                placeholder="alex.member@example.com"
                value={value}
                onChangeText={onChange}
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
                leftIcon={<Mail size={18} color={colors.textMuted} />}
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
                onChangeText={onChange}
                onBlur={onBlur}
                ref={passwordRef}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSubmit(onSubmit, onInvalid)}
                error={errors.password?.message}
                leftIcon={<Lock size={18} color={colors.textMuted} />}
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

          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              router.push('/(auth)/forgot-password');
            }}
            hitSlop={8}
            style={styles.forgotLink}
            accessibilityRole="link"
          >
            <Text style={styles.footerLink}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <Button
            title="Log In"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit, onInvalid)}
            icon={<ArrowRight size={18} color="#FFFFFF" />}
            style={styles.submitBtn}
          />

          {/* Demo Credentials Quick Fill — development builds only */}
          {__DEV__ && (
          <View style={styles.demoSection}>
            <View style={styles.demoHeader}>
              <Sparkles size={14} color={colors.primaryLight} />
              <Text style={styles.demoTitle}>Quick Demo Login</Text>
            </View>
            <View style={styles.demoButtonsRow}>
              <TouchableOpacity
                style={styles.demoPill}
                onPress={() => fillDemoCredentials('alex.member@example.com')}
              >
                <Text style={styles.demoPillText}>Member (Alex)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.demoPill}
                onPress={() => fillDemoCredentials('coach.marcus@apexfit.com')}
              >
                <Text style={styles.demoPillText}>Coach Marcus</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.demoPill}
                onPress={() => fillDemoCredentials('owner@apexfit.com')}
              >
                <Text style={styles.demoPillText}>Owner David</Text>
              </TouchableOpacity>
            </View>
          </View>
          )}
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

        {/* Backend Server Configuration Toggle */}
        {/* <TouchableOpacity
          style={styles.serverConfigToggle}
          onPress={() => setShowServerConfig(!showServerConfig)}
        >
          <Server size={14} color={colors.textMuted} />
          <Text style={styles.serverConfigToggleText}>
            Server URL: {api.getBaseUrl()}
          </Text>
        </TouchableOpacity> */}

        {showServerConfig && (
          <Card elevated style={styles.serverConfigCard}>
            <Text style={styles.serverConfigTitle}>Configure Backend URL</Text>
            <Text style={styles.serverConfigDescription}>
              Select preset or enter your machine&apos;s IP address for physical device testing:
            </Text>

            <Input
              value={customServerUrl}
              onChangeText={setCustomServerUrl}
              placeholder="http://10.0.2.2:8000/api"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => setCustomServerUrl('http://192.168.0.176:8000/api')}
              >
                <Text style={styles.presetButtonText}>Wi-Fi (192.168.0.176)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => setCustomServerUrl('http://10.0.2.2:8000/api')}
              >
                <Text style={styles.presetButtonText}>Emulator (10.0.2.2)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => setCustomServerUrl('http://localhost:8000/api')}
              >
                <Text style={styles.presetButtonText}>Localhost</Text>
              </TouchableOpacity>
            </View>

            <Button
              title="Apply Server URL"
              variant="secondary"
              size="sm"
              onPress={handleApplyServerUrl}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        )}
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
    paddingVertical: spacing.xxl,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.borderGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
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
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 1.5,
  },
  brandTitleAccent: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primaryLight,
    letterSpacing: 1.5,
  },
  brandTagline: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    letterSpacing: 0.2,
  },
  loginCard: {
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
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBackground,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorAlertText: {
    flex: 1,
    color: colors.error,
    fontSize: 13,
    fontWeight: '500',
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
  demoSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  demoPill: {
    minHeight: 36,
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  demoPillText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  serverConfigToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  serverConfigToggleText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serverConfigCard: {
    marginTop: spacing.md,
    padding: spacing.md,
  },
  serverConfigTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  serverConfigDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  presetButton: {
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  presetButtonText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
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
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryLight,
  },
}));
