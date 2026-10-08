import React from 'react';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

export interface FitLogDumbbellProps {
  width?: number;
  height?: number;
  color?: string;
  secondaryColor?: string;
}

/**
 * FitLog signature horizontal dumbbell mark.
 * Symmetrical weight plates, center bar, and subtle gradient.
 */
export function FitLogDumbbell({
  width = 68,
  height = 36,
  color = '#00D09C',
  secondaryColor = '#00BFA5',
}: FitLogDumbbellProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 72 38" fill="none">
      <Defs>
        <LinearGradient id="dumbbellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={color} />
          <Stop offset="100%" stopColor={secondaryColor} />
        </LinearGradient>
      </Defs>

      {/* Left tip collar */}
      <Rect x="5" y="16" width="3" height="6" rx="1.5" fill="url(#dumbbellGrad)" />
      {/* Left outer plate */}
      <Rect x="10" y="8" width="6" height="22" rx="3" fill="url(#dumbbellGrad)" />
      {/* Left inner plate */}
      <Rect x="18" y="2" width="7" height="34" rx="3.5" fill="url(#dumbbellGrad)" />

      {/* Center bar */}
      <Rect x="25" y="16" width="22" height="6" rx="3" fill="url(#dumbbellGrad)" />

      {/* Right inner plate */}
      <Rect x="47" y="2" width="7" height="34" rx="3.5" fill="url(#dumbbellGrad)" />
      {/* Right outer plate */}
      <Rect x="56" y="8" width="6" height="22" rx="3" fill="url(#dumbbellGrad)" />
      {/* Right tip collar */}
      <Rect x="64" y="16" width="3" height="6" rx="1.5" fill="url(#dumbbellGrad)" />
    </Svg>
  );
}
