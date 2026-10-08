import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FitLogDumbbell } from '../../src/components/ui/FitLogDumbbell';
import { haptics } from '../../src/lib/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleGetStarted = () => {
    haptics.medium();
    router.push('/(auth)/signup' as any);
  };

  const handleSignIn = () => {
    haptics.selection();
    router.push('/(auth)/login' as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Atmospheric Fitness Hero Background */}
      <Image
        source={require('../../assets/images/landing-hero.jpg')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={300}
        priority="high"
      />

      {/* Multi-Stop Cinematic Vignette & Ambient Darkness */}
      <Svg
        height={SCREEN_HEIGHT}
        width={SCREEN_WIDTH}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="heroVignette" x1="0%" y1="0%" x2="0%" y2="100%">
            {/* Top status bar dark shade */}
            <Stop offset="0%" stopColor="#000000" stopOpacity={0.65} />
            <Stop offset="18%" stopColor="#000000" stopOpacity={0.25} />
            {/* Mid body silhouette area */}
            <Stop offset="42%" stopColor="#04080D" stopOpacity={0.35} />
            <Stop offset="62%" stopColor="#04080D" stopOpacity={0.7} />
            {/* Bottom high-contrast action container */}
            <Stop offset="82%" stopColor="#03060A" stopOpacity={0.94} />
            <Stop offset="100%" stopColor="#020406" stopOpacity={0.98} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#heroVignette)" />
      </Svg>

      {/* Main Foreground Container */}
      <View
        style={[
          styles.contentContainer,
          {
            paddingTop: Math.max(insets.top, 24),
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
      >
        {/* Top spacer to balance vertical layout */}
        <View style={styles.topSpacer} />

        {/* Center Brand Identity (Dumbbell + FitLog + Tagline) */}
        <Animated.View
          entering={FadeInUp.duration(700).springify().damping(18)}
          style={styles.brandHero}
        >
          {/* Signature Teal Dumbbell Icon */}
          <View style={styles.iconContainer}>
            <FitLogDumbbell
              width={76}
              height={40}
              color="#00D09C"
              secondaryColor="#00BFA5"
            />
          </View>

          {/* "FitLog" Typography */}
          <View style={styles.brandTitleRow}>
            <Text style={styles.brandTitleFit}>Fit</Text>
            <View style={styles.lWrapper}>
              <Text style={styles.brandTitleLog}>L</Text>
              {/* Turquoise accent on the base of the letter 'L' */}
              <View style={styles.lTealFoot} />
            </View>
            <Text style={styles.brandTitleLog}>og</Text>
          </View>

          {/* Tagline: Track. Train. Fuel. Grow. */}
          <Animated.View
            entering={FadeIn.delay(200).duration(600)}
            style={styles.taglineWrapper}
          >
            <Text style={styles.tagline}>
              <Text style={styles.taglineWhite}>Track. Train. </Text>
              <Text style={styles.taglineTeal}>Fuel. Grow.</Text>
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Bottom Call-to-Actions (Get Started + Sign In) */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(650).springify().damping(18)}
          style={styles.bottomActions}
        >
          {/* Primary "Get Started" Pill Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleGetStarted}
            style={styles.getStartedBtn}
            accessibilityRole="button"
            accessibilityLabel="Get Started"
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>

          {/* Secondary "Sign In" Link */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleSignIn}
            style={styles.signInBtn}
            accessibilityRole="button"
            accessibilityLabel="Sign In"
          >
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020406',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  topSpacer: {
    flex: 0.8,
  },
  brandHero: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 380,
  },
  iconContainer: {
    marginBottom: 16,
    shadowColor: '#00D09C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  brandTitleFit: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  brandTitleLog: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  lWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lTealFoot: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 7 : 9,
    left: Platform.OS === 'ios' ? 7 : 8,
    right: 0,
    height: 5.5,
    backgroundColor: '#00D09C',
    borderRadius: 1.5,
    shadowColor: '#00D09C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  taglineWrapper: {
    marginTop: 14,
    alignItems: 'center',
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  taglineWhite: {
    color: '#F8FAFC',
  },
  taglineTeal: {
    color: '#00D09C',
    fontWeight: '700',
  },
  bottomActions: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    paddingBottom: 8,
  },
  getStartedBtn: {
    width: '100%',
    height: 56,
    backgroundColor: '#009E86',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#009E86',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  signInBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
