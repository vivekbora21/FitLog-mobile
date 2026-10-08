import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * The tab bar intercepts presses on this tab and opens the QuickAddSheet instead
 * of navigating here. This route only exists so expo-router has a screen to
 * register for the "add" tab; redirect home if it's ever reached directly.
 */
export default function AddTabPlaceholder() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)');
  }, [router]);

  return null;
}
