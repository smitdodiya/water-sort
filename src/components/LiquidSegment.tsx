/**
 * One band of liquid inside a tube.
 *
 * Three layers make it read as liquid in a cylinder rather than a colored
 * rectangle: a vertical base gradient for the color, a horizontal light ramp
 * for the curve of the tube, and - on the top band only - an ellipse for the
 * surface. The ellipse is what sells the 3D, because a flat top edge is the
 * single biggest giveaway that a tube is really a rectangle.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { liquid } from '../theme/colors';
import { ellipseHeight, LIQUID_CYLINDER } from '../theme/shading';

interface Props {
  color: number;
  width: number;
  height: number;
  isBottom: boolean;
  isTop: boolean;
  bottomRadius: number;
  /** Grow in from zero height. Set for segments that just arrived from a pour. */
  animateIn: boolean;
  /** Draw the color's glyph so hue is not the only way to tell liquids apart. */
  showSymbol: boolean;
}

function LiquidSegmentComponent({
  color,
  width,
  height,
  isBottom,
  isTop,
  bottomRadius,
  animateIn,
  showSymbol,
}: Props) {
  const paint = liquid(color);
  const surfaceHeight = ellipseHeight(width);

  // Start collapsed only when this segment is arriving; existing liquid must
  // not re-animate every time the board re-renders.
  const grow = useSharedValue(animateIn ? 0 : 1);
  /** Surface wobble after liquid lands, damped over two bounces. */
  const wobble = useSharedValue(0);

  useEffect(() => {
    if (animateIn) {
      grow.value = withTiming(1, { duration: 190, easing: Easing.out(Easing.quad) });
      // The surface keeps moving briefly after the level settles, which is what
      // makes it read as liquid rather than a rising solid block.
      wobble.value = withDelay(
        120,
        withSequence(
          withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }),
          withTiming(-0.55, { duration: 130, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.25, { duration: 120, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 140, easing: Easing.out(Easing.quad) })
        )
      );
    } else {
      grow.value = 1;
      wobble.value = 0;
    }
  }, [animateIn, grow, wobble]);

  const bodyStyle = useAnimatedStyle(() => ({
    height: height * grow.value,
    opacity: 0.4 + 0.6 * grow.value,
  }));

  const surfaceStyle = useAnimatedStyle(() => ({
    // Squash and stretch the surface ellipse, and rock it slightly, so the
    // liquid looks like it is sloshing.
    transform: [
      { translateY: wobble.value * surfaceHeight * 0.32 },
      { scaleY: 1 + wobble.value * 0.42 },
      { scaleX: 1 - wobble.value * 0.05 },
    ],
  }));

  return (
    <Animated.View style={[styles.container, { width }, bodyStyle]}>
      {/* Base color, deeper at the bottom of the band. */}
      <LinearGradient
        colors={[paint.gradient[0], paint.gradient[1]]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          StyleSheet.absoluteFill,
          isBottom && { borderBottomLeftRadius: bottomRadius, borderBottomRightRadius: bottomRadius },
        ]}
      />

      {/* Horizontal light ramp: the curve of the cylinder. */}
      <LinearGradient
        colors={LIQUID_CYLINDER.colors}
        locations={LIQUID_CYLINDER.locations}
        start={LIQUID_CYLINDER.start}
        end={LIQUID_CYLINDER.end}
        style={[
          StyleSheet.absoluteFill,
          isBottom && { borderBottomLeftRadius: bottomRadius, borderBottomRightRadius: bottomRadius },
        ]}
        pointerEvents="none"
      />

      {/* The visible surface of the liquid, drawn as a shallow ellipse. */}
      {isTop && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.surface,
            {
              height: surfaceHeight,
              top: -surfaceHeight / 2,
              borderRadius: width,
              backgroundColor: paint.gradient[0],
            },
            surfaceStyle,
          ]}
        >
          {/* Bright crescent along the near edge of the surface. */}
          <View
            style={[
              styles.surfaceSheen,
              { borderRadius: width, borderColor: 'rgba(255,255,255,0.55)' },
            ]}
          />
        </Animated.View>
      )}

      {showSymbol && isTop && (
        <View style={styles.symbolWrap} pointerEvents="none">
          <Text style={[styles.symbol, { fontSize: Math.max(9, width * 0.3) }]}>{paint.symbol}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Overflow must stay visible or the surface ellipse, which sits half above
    // the band, would be clipped away.
    overflow: 'visible',
  },
  surface: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  surfaceSheen: {
    ...StyleSheet.absoluteFill,
    borderTopWidth: 1.4,
    borderLeftWidth: 0.6,
    borderRightWidth: 0.6,
    borderBottomWidth: 0,
  },
  symbolWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    color: 'rgba(0,0,0,0.42)',
    fontWeight: '900',
  },
});

// Segments re-render on every board change; memoizing keeps a 12-tube board cheap.
export const LiquidSegment = React.memo(LiquidSegmentComponent);
