/**
 * App backdrop.
 *
 * Built in depth layers rather than as a single flat gradient: a deep base,
 * three slow aurora blooms that drift and breathe on their own cycles, a
 * starfield, rising bubbles, and a vignette that darkens the edges so the board
 * always sits in the brightest part of the screen.
 *
 * Everything is soft and slow on purpose. The background has to stay
 * interesting on a screen the player stares at for a long time without ever
 * competing with the tubes for attention.
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Rect, RadialGradient as SvgRadial, Stop } from 'react-native-svg';
import { UI } from '../theme/colors';

const BUBBLE_COUNT = 14;
const STAR_COUNT = 34;

/** Deterministic scatter so the layout never reshuffles between renders. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

interface BloomSpec {
  color: string;
  size: number;
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  duration: number;
  delay: number;
  peakOpacity: number;
}

/**
 * A large soft colour bloom. Drawn as an SVG radial gradient because a blurred
 * View costs far more per frame and blur support is uneven across platforms.
 */
function Bloom({ spec, index }: { spec: BloomSpec; index: number }) {
  const drift = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    drift.value = withDelay(
      spec.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: spec.duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: spec.duration, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
    // Offset from the drift so the two never sync up into an obvious pulse.
    breathe.value = withDelay(
      spec.delay + 1400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: spec.duration * 0.7, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: spec.duration * 0.7, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
  }, [drift, breathe, spec.delay, spec.duration]);

  const style = useAnimatedStyle(() => ({
    opacity: spec.peakOpacity * (0.62 + 0.38 * breathe.value),
    transform: [
      { translateX: spec.driftX * drift.value },
      { translateY: spec.driftY * drift.value },
      { scale: 0.9 + 0.22 * breathe.value },
    ],
  }));

  const id = `bloom${index}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: spec.x, top: spec.y, width: spec.size, height: spec.size },
        style,
      ]}
    >
      <Svg width={spec.size} height={spec.size}>
        <Defs>
          <SvgRadial id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={spec.color} stopOpacity={0.85} />
            <Stop offset="0.45" stopColor={spec.color} stopOpacity={0.32} />
            <Stop offset="1" stopColor={spec.color} stopOpacity={0} />
          </SvgRadial>
        </Defs>
        <Rect x="0" y="0" width={spec.size} height={spec.size} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

interface BubbleSpec {
  x: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
}

function Bubble({ spec, travel }: { spec: BubbleSpec; travel: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      spec.delay,
      withRepeat(withTiming(1, { duration: spec.duration, easing: Easing.linear }), -1, false)
    );
  }, [progress, spec.delay, spec.duration]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateY: -travel * p },
        // A gentle sine sway reads as buoyancy rather than a straight line.
        { translateX: Math.sin(p * Math.PI * 2) * spec.drift },
        { scale: 0.85 + 0.3 * p },
      ],
      // Fade in and out at the extremes so bubbles never pop into existence.
      opacity: spec.opacity * Math.sin(Math.PI * p),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: spec.x,
          bottom: -spec.size,
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size / 2,
          borderWidth: 1,
          borderColor: 'rgba(190, 225, 255, 0.22)',
          backgroundColor: 'rgba(120,190,255,0.05)',
        },
        style,
      ]}
    >
      {/* Highlight dot, so a bubble reads as a sphere rather than a ring. */}
      <View
        style={{
          position: 'absolute',
          top: spec.size * 0.16,
          left: spec.size * 0.2,
          width: spec.size * 0.22,
          height: spec.size * 0.22,
          borderRadius: spec.size,
          backgroundColor: 'rgba(255,255,255,0.4)',
        }}
      />
    </Animated.View>
  );
}

function Twinkle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const glow = useSharedValue(0.3);

  useEffect(() => {
    glow.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.22, { duration: 1700, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
  }, [glow, delay]);

  const style = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#DCEBFF',
        },
        style,
      ]}
    />
  );
}

export function GradientBackground({ children }: { children?: React.ReactNode }) {
  const { width, height } = useWindowDimensions();

  const blooms = useMemo<BloomSpec[]>(() => {
    const size = Math.max(width, height) * 0.95;
    return [
      {
        color: '#2F6BFF',
        size,
        x: -size * 0.42,
        y: -size * 0.28,
        driftX: width * 0.12,
        driftY: height * 0.05,
        duration: 14000,
        delay: 0,
        peakOpacity: 0.5,
      },
      {
        color: '#00D3B8',
        size: size * 0.85,
        x: width - size * 0.5,
        y: height * 0.36,
        driftX: -width * 0.14,
        driftY: -height * 0.07,
        duration: 17000,
        delay: 2600,
        peakOpacity: 0.34,
      },
      {
        color: '#B33BF6',
        size: size * 0.8,
        x: width * 0.1,
        y: height - size * 0.42,
        driftX: width * 0.1,
        driftY: -height * 0.04,
        duration: 20000,
        delay: 5200,
        peakOpacity: 0.36,
      },
    ];
  }, [width, height]);

  const bubbles = useMemo<BubbleSpec[]>(() => {
    const random = makeRandom(24681357);
    return Array.from({ length: BUBBLE_COUNT }, () => ({
      x: random() * width,
      size: 8 + random() * 40,
      duration: 12000 + random() * 13000,
      delay: random() * 11000,
      drift: 12 + random() * 32,
      opacity: 0.14 + random() * 0.24,
    }));
  }, [width]);

  const stars = useMemo(() => {
    const random = makeRandom(1357911);
    return Array.from({ length: STAR_COUNT }, () => ({
      x: random() * width,
      y: random() * height,
      size: 1 + random() * 2.2,
      delay: random() * 3400,
    }));
  }, [width, height]);

  return (
    <View style={styles.root}>
      {/* Deep base, painted flat so nothing behind can show through. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: UI.backdrop[0] }]} />

      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <SvgRadial id="baseWash" cx="50%" cy="34%" r="78%">
            <Stop offset="0" stopColor="#1B2A63" stopOpacity={1} />
            <Stop offset="0.6" stopColor="#101841" stopOpacity={1} />
            <Stop offset="1" stopColor="#070B1E" stopOpacity={1} />
          </SvgRadial>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#baseWash)" />
      </Svg>

      {stars.map((star, index) => (
        <Twinkle key={index} {...star} />
      ))}

      {blooms.map((spec, index) => (
        <Bloom key={index} spec={spec} index={index} />
      ))}

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {bubbles.map((spec, index) => (
          <Bubble key={index} spec={spec} travel={height + spec.size * 2} />
        ))}
      </View>

      {/* Vignette: darkens the corners so the eye is pulled to the centre. */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        <Defs>
          <SvgRadial id="vignette" cx="50%" cy="45%" r="72%">
            <Stop offset="0.45" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.62} />
          </SvgRadial>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#vignette)" />
      </Svg>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.backdrop[0],
  },
});
