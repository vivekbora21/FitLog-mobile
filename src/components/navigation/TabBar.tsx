import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { haptics } from '../../lib/haptics';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { QuickAddSheet } from './QuickAddSheet';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

export const TAB_BAR_HEIGHT = 64;
const BAR_MARGIN = 12;
const BAR_BORDER = 1;
const FAB_SIZE = 52;
const SPRING = { damping: 20, stiffness: 220, mass: 0.8 };

/** Bottom padding a tab screen's scroll content needs to clear the floating bar. */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  // The bar is absolutely positioned and the add FAB rises above its top edge.
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, BAR_MARGIN) + spacing.xxl;
}

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [quickAddVisible, setQuickAddVisible] = useState(false);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, BAR_MARGIN) }]}
    >
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isHidden =
            (options.tabBarItemStyle as { display?: string } | undefined)?.display === 'none';
          if (isHidden) return null;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const isFocused = state.index === index;
          const isAdd = route.name === 'add';

          const onPress = () => {
            if (isAdd) {
              haptics.selection();
              setQuickAddVisible(true);
              return;
            }
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

          if (isAdd) {
            return (
              <AddTabItem
                key={route.key}
                label={label}
                icon={options.tabBarIcon?.({ focused: false, color: '#FFFFFF', size: 24 })}
                onPress={onPress}
                onLongPress={onLongPress}
              />
            );
          }

          return (
            <TabItem
              key={route.key}
              label={label}
              focused={isFocused}
              tabBarIcon={options.tabBarIcon}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>

      <QuickAddSheet visible={quickAddVisible} onClose={() => setQuickAddVisible(false)} />
    </View>
  );
}

interface TabItemProps {
  label: string;
  focused: boolean;
  tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ label, focused, tabBarIcon, onPress, onLongPress }: TabItemProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const progress = useSharedValue(focused ? 1 : 0);
  const color = focused ? colors.primaryLight : colors.textMuted;

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
      <Animated.View style={iconStyle}>
        {tabBarIcon?.({ focused, color, size: 22 })}
      </Animated.View>
      <Text style={[styles.label, { color }, focused && styles.labelFocused]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

interface AddTabItemProps {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
}

function AddTabItem({ label, icon, onPress, onLongPress }: AddTabItemProps) {
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
      hitSlop={4}
    >
      <View style={styles.fab}>{icon}</View>
      <Text style={styles.addLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, shadows }) => ({
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
    overflow: 'visible',
    ...shadows.card,
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
    letterSpacing: -0.2,
  },
  labelFocused: {
    fontWeight: '800',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -(FAB_SIZE / 2 + 8),
    borderWidth: 4,
    borderColor: colors.tabBar,
    ...shadows.card,
  },
  addLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: -0.2,
    marginTop: -2,
  },
}));
