import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/** Measures a chart's rendered width via onLayout, ignoring the transient 0-width pass. */
export function useChartLayout(initialWidth = 320) {
  const [width, setWidth] = useState(initialWidth);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 50) setWidth(w);
  }, []);
  return { width, onLayout };
}
