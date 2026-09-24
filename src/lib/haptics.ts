import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Thin, fire-and-forget wrappers. Haptics are unsupported on web and can throw
// on devices without a taptic engine, so every call is guarded and never awaited.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  selection() {
    if (enabled) Haptics.selectionAsync().catch(() => {});
  },
  light() {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  medium() {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  success() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  error() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};
