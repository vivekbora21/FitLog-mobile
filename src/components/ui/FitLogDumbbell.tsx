import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

export interface FitLogDumbbellProps {
  width?: number;
  height?: number;
  color?: string;
  secondaryColor?: string;
}

/**
 * FitLog signature diagonal dumbbell mark.
 * Matches the lucide-react `Dumbbell` icon used on the web app's logo.
 */
export function FitLogDumbbell({
  width = 36,
  height = 36,
  color = '#00D09C',
  secondaryColor = '#00BFA5',
}: FitLogDumbbellProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="dumbbellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={color} />
          <Stop offset="100%" stopColor={secondaryColor} />
        </LinearGradient>
      </Defs>

      <Path
        d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"
        stroke="url(#dumbbellGrad)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="m2.5 21.5 1.4-1.4" stroke="url(#dumbbellGrad)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="m20.1 3.9 1.4-1.4" stroke="url(#dumbbellGrad)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"
        stroke="url(#dumbbellGrad)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="m9.6 14.4 4.8-4.8" stroke="url(#dumbbellGrad)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
