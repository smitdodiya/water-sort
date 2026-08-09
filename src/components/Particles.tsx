/**
 * Impact effects: splash droplets where liquid lands, and a ring-and-spark
 * burst when a tube is completed.
 *
 * Both are one-shot: they mount when a signal fires, play, and remove
 * themselves. Nothing loops, so an idle board costs nothing.
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { liquid } from '../theme/colors';

/** Deterministic scatter, so a burst looks varied but never recomputes. */
function makeRandom(seed: number) {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

interface DropletSpec {
  angle: number;
  distance: number;
  size: number;
  delay: number;
  duration: number;
}

function Droplet({ spec, color }: { spec: DropletSpec; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      spec.delay,
      withTiming(1, { duration: spec.duration, easing: Easing.out(Easing.quad) })
    );
  }, [progress, spec.delay, spec.duration]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // Droplets fly outward and are pulled back down, so the arc is horizontal
    // spread plus a gravity term that wins by the end.
    const x = Math.cos(spec.angle) * spec.distance * p;
    const lift = Math.sin(spec.angle) * spec.distance * p;
    const gravity = spec.distance * 1.5 * p * p;
    return {
      opacity: 1 - p * p,
      transform: [{ translateX: x }, { translateY: -lift + gravity }, { scale: 1 - p * 0.45 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/** Splash thrown up where the pour lands. */
export function Splash({
  x,
  y,
  color,
  signal,
  scale,
}: {
  x: number;
  y: number;
  color: number | null;
  /** Changes to fire a new splash. */
  signal: number;
  /** Tube width, so the splash scales with the board. */
  scale: number;
}) {
  const droplets = useMemo<DropletSpec[]>(() => {
    const random = makeRandom(signal + 1);
    return Array.from({ length: 9 }, () => {
      // Bias upward and sideways: liquid does not splash straight down.
      const angle = Math.PI * (0.15 + random() * 0.7);
      return {
        angle,
        distance: scale * (0.35 + random() * 0.55),
        size: Math.max(2.5, scale * (0.07 + random() * 0.09)),
        delay: random() * 70,
        duration: 320 + random() * 220,
      };
    });
  }, [signal, scale]);

  const ring = useSharedValue(0);

  useEffect(() => {
    if (signal === 0) return;
    ring.value = 0;
    ring.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
  }, [signal, ring]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * 0.75,
    transform: [{ scaleX: 0.3 + ring.value * 1.5 }, { scaleY: 0.3 + ring.value * 0.5 }],
  }));

  if (color === null || signal === 0) return null;
  const paint = liquid(color);

  return (
    <View pointerEvents="none" style={[styles.anchor, { left: x, top: y }]}>
      {/* Flat ripple spreading across the surface it hit. */}
      <Animated.View
        style={[
          styles.ripple,
          {
            width: scale,
            height: scale * 0.4,
            marginLeft: -scale / 2,
            marginTop: -scale * 0.2,
            borderRadius: scale,
            borderColor: paint.gradient[0],
          },
          ringStyle,
        ]}
      />
      {droplets.map((spec, index) => (
        <Droplet key={`${signal}-${index}`} spec={spec} color={paint.gradient[0]} />
      ))}
    </View>
  );
}

interface SparkSpec {
  angle: number;
  distance: number;
  size: number;
  duration: number;
}

function Spark({ spec, color }: { spec: SparkSpec; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: spec.duration, easing: Easing.out(Easing.cubic) });
  }, [progress, spec.duration]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: 1 - p,
      transform: [
        { translateX: Math.cos(spec.angle) * spec.distance * p },
        { translateY: Math.sin(spec.angle) * spec.distance * p },
        { scale: 1 - p * 0.6 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 0.9,
          shadowRadius: 6,
        },
        style,
      ]}
    />
  );
}

/** Radiating rings and sparks when a tube is finished. */
export function CompletionBurst({
  x,
  y,
  color,
  signal,
  scale,
}: {
  x: number;
  y: number;
  color: number | null;
  signal: number;
  scale: number;
}) {
  const sparks = useMemo<SparkSpec[]>(() => {
    const random = makeRandom(signal + 7);
    return Array.from({ length: 14 }, (_, i) => ({
      // Even spread with a little jitter, so it reads as a burst not a clock face.
      angle: (i / 14) * Math.PI * 2 + (random() - 0.5) * 0.4,
      distance: scale * (1.1 + random() * 0.9),
      size: Math.max(3, scale * (0.09 + random() * 0.1)),
      duration: 520 + random() * 320,
    }));
  }, [signal, scale]);

  const ring = useSharedValue(0);
  const innerRing = useSharedValue(0);

  useEffect(() => {
    if (signal === 0) return;
    ring.value = 0;
    innerRing.value = 0;
    ring.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) });
    // Second ring trails the first, which reads as a shockwave rather than a
    // single expanding circle.
    innerRing.value = withDelay(110, withTiming(1, { duration: 560, easing: Easing.out(Easing.quad) }));
  }, [signal, ring, innerRing]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * 0.85,
    transform: [{ scale: 0.25 + ring.value * 2.1 }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    opacity: (1 - innerRing.value) * 0.55,
    transform: [{ scale: 0.2 + innerRing.value * 1.5 }],
  }));

  if (color === null || signal === 0) return null;
  const paint = liquid(color);
  const ringSize = scale * 1.6;

  return (
    <View pointerEvents="none" style={[styles.anchor, { left: x, top: y }]}>
      <Animated.View
        style={[
          styles.burstRing,
          {
            width: ringSize,
            height: ringSize,
            marginLeft: -ringSize / 2,
            marginTop: -ringSize / 2,
            borderRadius: ringSize / 2,
            borderColor: paint.gradient[0],
          },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.burstRing,
          {
            width: ringSize,
            height: ringSize,
            marginLeft: -ringSize / 2,
            marginTop: -ringSize / 2,
            borderRadius: ringSize / 2,
            borderColor: '#FFFFFF',
          },
          innerStyle,
        ]}
      />
      {sparks.map((spec, index) => (
        <Spark key={`${signal}-${index}`} spec={spec} color={paint.solid} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    zIndex: 120,
  },
  ripple: {
    position: 'absolute',
    borderWidth: 2,
  },
  burstRing: {
    position: 'absolute',
    borderWidth: 2.5,
  },
});
