import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Share,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Trophy, Share2, Sparkles, X, Award, Flame, Check } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useStyles } from './PrCelebrationModal.styles';
import { Button, PressableScale } from '../ui';
import { haptics } from '../../lib/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface PrCelebrationData {
  exercise_name: string;
  max_weight_kg: number;
  reps: number;
  estimated_one_rep_max?: number | null;
  previous_1rm?: number | null;
  achieved_at?: string;
  primary_muscle?: string;
}

interface Props {
  visible: boolean;
  pr: PrCelebrationData | null;
  onClose: () => void;
}

const CONFETTI_COLORS = [
  '#F59E0B', // Amber
  '#EAB308', // Gold
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#FFFFFF', // White
];

interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  shape: 'rect' | 'circle';
  delay: number;
  duration: number;
  swayDist: number;
  rotation: number;
}

function ConfettiPiece({ particle }: { particle: Particle }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      particle.delay,
      withTiming(1, {
        duration: particle.duration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      })
    );
  }, [particle, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = progress.value * (SCREEN_HEIGHT * 0.95);
    const translateX = Math.sin(progress.value * Math.PI * 4) * particle.swayDist;
    const rotate = `${progress.value * particle.rotation}deg`;
    const opacity = progress.value < 0.75 ? 1 : 1 - (progress.value - 0.75) * 4;

    return {
      position: 'absolute',
      left: particle.x,
      top: -20,
      width: particle.size,
      height: particle.shape === 'rect' ? particle.size * 1.6 : particle.size,
      borderRadius: particle.shape === 'circle' ? particle.size / 2 : 2,
      backgroundColor: particle.color,
      opacity,
      transform: [{ translateY }, { translateX }, { rotate }],
    };
  });

  return <Animated.View style={animatedStyle} pointerEvents="none" />;
}

export function PrCelebrationModal({ visible, pr, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();

  // Trigger celebration haptic bursts on open
  useEffect(() => {
    if (!visible || !pr) return;
    haptics.success();
    const t1 = setTimeout(() => haptics.medium(), 180);
    const t2 = setTimeout(() => haptics.selection(), 360);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible, pr]);

  // Generate confetti burst particles
  const particles = useMemo<Particle[]>(() => {
    if (!visible) return [];
    return Array.from({ length: 42 }).map((_, i) => ({
      id: i,
      x: Math.random() * (SCREEN_WIDTH - 20) + 10,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: Math.random() * 6 + 6,
      shape: i % 3 === 0 ? 'circle' : 'rect',
      delay: Math.random() * 320,
      duration: Math.random() * 900 + 1900,
      swayDist: Math.random() * 40 + 20,
      rotation: Math.random() * 720 - 360,
    }));
  }, [visible]);

  if (!pr) return null;

  const e1rm = pr.estimated_one_rep_max
    ? Math.round(pr.estimated_one_rep_max)
    : Math.round(pr.max_weight_kg * (1 + (pr.reps > 1 ? pr.reps / 30 : 0)));

  const delta =
    pr.previous_1rm && e1rm > pr.previous_1rm
      ? Number((e1rm - pr.previous_1rm).toFixed(1))
      : null;

  const handleShare = async () => {
    haptics.selection();
    const shareMessage = `🏆 NEW PERSONAL RECORD!\nJust hit ${pr.max_weight_kg} kg × ${pr.reps} rep${
      pr.reps === 1 ? '' : 's'
    } on ${pr.exercise_name}! Estimated 1RM: ${e1rm} kg.\nTracked with FitLog.`;

    try {
      await Share.share({
        message: shareMessage,
        title: `PR: ${pr.exercise_name}`,
      });
    } catch {
      // User cancelled share
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Confetti Explosion */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {particles.map((p) => (
            <ConfettiPiece key={p.id} particle={p} />
          ))}
        </View>

        {/* Celebration Dialog Card */}
        <Animated.View
          entering={FadeInDown.duration(450).springify().damping(12)}
          exiting={FadeOut.duration(200)}
          style={styles.dialogCard}
        >
          {/* Close button */}
          <PressableScale
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityLabel="Close PR celebration"
          >
            <X size={20} color={colors.textMuted} />
          </PressableScale>

          {/* Trophy Medallion */}
          <Animated.View
            entering={FadeInDown.delay(100).springify().damping(10)}
            style={styles.trophyWrapper}
          >
            <View style={styles.trophyHalo} />
            <View style={styles.trophyCircle}>
              <Trophy size={42} color="#F59E0B" strokeWidth={2.4} />
            </View>
            <View style={styles.sparkleBadge}>
              <Sparkles size={14} color="#FFF" />
            </View>
          </Animated.View>

          {/* Banner Tag */}
          <Animated.View entering={FadeInDown.delay(180)}>
            <View style={styles.bannerPill}>
              <Award size={13} color="#D97706" strokeWidth={2.4} />
              <Text style={styles.bannerText}>NEW PERSONAL RECORD</Text>
            </View>
          </Animated.View>

          {/* Exercise Title */}
          <Animated.View entering={FadeInDown.delay(240)}>
            <Text style={styles.exerciseTitle} numberOfLines={2}>
              {pr.exercise_name}
            </Text>
            {pr.primary_muscle ? (
              <Text style={styles.muscleSub}>{pr.primary_muscle}</Text>
            ) : null}
          </Animated.View>

          {/* Highlight Badge Card */}
          <Animated.View entering={FadeInDown.delay(300)} style={styles.statsCard}>
            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>LIFTED</Text>
              <Text style={styles.statValue}>
                {pr.max_weight_kg}
                <Text style={styles.statUnit}> kg</Text>
              </Text>
              <Text style={styles.statSub}>
                {pr.reps} {pr.reps === 1 ? 'rep' : 'reps'}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>ESTIMATED 1RM</Text>
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                {e1rm}
                <Text style={styles.statUnit}> kg</Text>
              </Text>
              <View style={styles.deltaBadge}>
                {delta != null ? (
                  <>
                    <Flame size={11} color="#10B981" />
                    <Text style={styles.deltaText}>+{delta} kg PR</Text>
                  </>
                ) : (
                  <Text style={styles.deltaText}>All-Time Best</Text>
                )}
              </View>
            </View>
          </Animated.View>

          {pr.achieved_at ? (
            <Text style={styles.dateText}>
              Achieved on {pr.achieved_at.slice(0, 10)}
            </Text>
          ) : null}

          {/* Actions */}
          <Animated.View entering={FadeInUp.delay(360)} style={styles.actionsRow}>
            <PressableScale
              haptic="selection"
              onPress={handleShare}
              style={styles.shareBtn}
              accessibilityLabel="Share PR achievement"
            >
              <Share2 size={16} color={colors.primaryLight} />
              <Text style={styles.shareBtnText}>Share</Text>
            </PressableScale>

            <Button
              title="Awesome!"
              size="md"
              onPress={onClose}
              style={styles.confirmBtn}
              icon={<Check size={16} color="#FFF" />}
              iconPosition="right"
            />
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

