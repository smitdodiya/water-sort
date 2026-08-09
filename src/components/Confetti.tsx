/**
 * Confetti burst for a level win.
 *
 * Pieces are generated once with fixed pseudo-random parameters and each drives
 * its own worklet, so the whole burst runs on the UI thread with no per-frame
 * JS work.
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { CONFETTI_COLORS } from '../theme/colors';

const PIECE_COUNT = 34;

interface PieceSpec {
  color: string;
  startX: number;
  driftX: number;
  fallTo: number;
  delay: number;
  duration: number;
  size: number;
  spin: number;
  isCircle: boolean;
}

function Piece({ spec }: { spec: PieceSpec }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      spec.delay,
      withTiming(1, { duration: spec.duration, easing: Easing.out(Easing.quad) })
    );
  }, [progress, spec.delay, spec.duration]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1,
      transform: [
        { translateX: spec.driftX * p },
        { translateY: spec.fallTo * p },
        { rotate: `${spec.spin * p}deg` },
        { scale: 0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, p * 1.4)) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: spec.startX,
          top: -20,
          width: spec.size,
          height: spec.isCircle ? spec.size : spec.size * 0.5,
          backgroundColor: spec.color,
          borderRadius: spec.isCircle ? spec.size / 2 : 2,
        },
        style,
      ]}
    />
  );
}

export function Confetti({ active }: { active: boolean }) {
  const { width, height } = useWindowDimensions();

  const pieces = useMemo<PieceSpec[]>(() => {
    // Fixed pseudo-random sequence so the burst is varied but never recomputed
    // mid-animation.
    let seed = 987654321;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    return Array.from({ length: PIECE_COUNT }, (): PieceSpec => {
      const size = 7 + random() * 9;
      return {
        color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)],
        startX: random() * width,
        driftX: (random() - 0.5) * width * 0.5,
        fallTo: height * (0.75 + random() * 0.35),
        delay: random() * 420,
        duration: 1500 + random() * 1100,
        size,
        spin: (random() - 0.5) * 900,
        isCircle: random() > 0.6,
      };
    });
  }, [width, height]);

  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((spec, index) => (
        <Piece key={index} spec={spec} />
      ))}
    </View>
  );
}
