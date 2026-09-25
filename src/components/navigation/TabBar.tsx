import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { haptics } from '../../lib/haptics';
import { colors, radius, shadows, spacing } from '../../theme';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

export const TAB_BAR_HEIGHT = 64;
const BAR_MARGIN = 12;
const PILL_INSET = 6;
const BAR_BORDER = 1;
const SPRING = { damping: 20, stiffness: 220, mass: 0.8 };

/** Bottom padding a tab screen's scroll content needs to clear the floating bar. */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, BAR_MARGIN) + spacing.xl;
}

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const tabWidth = barWidth / state.routes.length;
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth > 0) {
      translateX.set(withSpring(state.index * tabWidth, SPRING));
    }
  }, [state.index, tabWidth, translateX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    // Absolute children are positioned inside the border, so measure the inner width.
    const width = e.nativeEvent.layout.width - BAR_BORDER * 2;
    if (width !== barWidth) {
      setBarWidth(width);
      // Snap without animating on first layout / rotation.
      translateX.set(state.index * (width / state.routes.length));
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, BAR_MARGIN) }]}
    >
      <View style={styles.bar} onLayout={onLayout} accessibilityRole="tablist">
        {tabWidth > 0 && (
          <Animated.View
            style={[styles.pill, { width: tabWidth - PILL_INSET * 2 }, pillStyle]}
          />
        )}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const isFocused = state.index === index;
          const color = isFocused ? colors.primaryLight : colors.textMuted;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              haptics.selection();
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TabItem
              key={route.key}
              label={label}
              focused={isFocused}
              icon={options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
              color={color}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

interface TabItemProps {
  label: string;
  focused: boolean;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ label, focused, icon, color, onPress, onLongPress }: TabItemProps) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.set(withSpring(focused ? 1 : 0, SPRING));
  }, [focused, progress]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * progress.value }, { scale: 1 + 0.08 * progress.value }],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
      hitSlop={4}
    >
      <Animated.View style={iconStyle}>{icon}</Animated.View>
      <Text style={[styles.label, { color }, focused && styles.labelFocused]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: BAR_MARGIN + 4,
  },
  bar: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    backgroundColor: colors.tabBar,
    borderRadius: radius.xl + 4,
    borderWidth: BAR_BORDER,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  pill: {
    position: 'absolute',
    top: PILL_INSET,
    bottom: PILL_INSET,
    left: PILL_INSET,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelFocused: {
    fontWeight: '800',
  },
});
