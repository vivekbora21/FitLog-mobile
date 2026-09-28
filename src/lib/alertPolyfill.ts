import { Alert, Platform } from 'react-native';

// Polyfill Alert.alert for Web: react-native-web provides a no-op stub for Alert.alert,
// which causes any multi-button confirmation or prompt to silently fail and never fire callbacks.
if (Platform.OS === 'web') {
  Alert.alert = (title?: string, message?: string, buttons?: any[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length === 0) {
      if (typeof window !== 'undefined') window.alert(text);
      return;
    }
    if (buttons.length === 1) {
      if (typeof window !== 'undefined') window.alert(text);
      buttons[0]?.onPress?.();
      return;
    }
    // Multiple buttons: identify cancel vs action
    const cancelBtn = buttons.find((b) => b.style === 'cancel');
    const actionBtn = buttons.find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];
    const confirmed = typeof window !== 'undefined' ? window.confirm(text) : true;
    if (confirmed) {
      actionBtn?.onPress?.();
    } else {
      cancelBtn?.onPress?.();
    }
  };
}
