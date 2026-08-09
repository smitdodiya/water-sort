/**
 * The falling column of liquid between a tilted tube and its target.
 *
 * The previous version drew a straight vertical bar above the destination,
 * which never lined up with anything - the liquid appeared out of thin air
 * beside the tube. This one solves for where the mouth of the tube actually is
 * after the lift, travel and tilt, and arcs from that point.
 *
 * Finding the mouth: the tube rotates about its own centre, and its opening
 * sits half a tube-height directly above that centre. Rotating that offset by
 * the tilt angle gives the mouth in board space:
 *
 *   mouth = centre + R(angle) . (0, -height/2)
 *         = (cx + (h/2)*sin(angle),  cy - (h/2)*cos(angle))
 *
 * The arc itself is a quadratic bezier with its control point at
 * (landX, mouthY). That places the outgoing tangent horizontal at the lip and
 * the incoming tangent vertical at the landing point, which is exactly the
 * shape liquid takes leaving a spout under gravity.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { interpolate, SharedValue, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { liquid } from '../theme/colors';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Padding around the board so the arc is not clipped when it rises above row 0. */
export const STREAM_PAD = 110;

interface Props {
  progress: SharedValue<number>;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
  angle: SharedValue<number>;
  stops: SharedValue<number[]>;
  /** Home position of the pouring tube, in board space. */
  sourceX: number;
  sourceY: number;
  tubeWidth: number;
  tubeHeight: number;
  /** Where the liquid lands: destination centre, at its liquid surface. */
  landX: number;
  landY: number;
  /** Board size, used to size the SVG canvas. */
  boardWidth: number;
  boardHeight: number;
  /** Color id being poured, or null when nothing is in flight. */
  color: number | null;
}

export function PourStream({
  progress,
  dx,
  dy,
  angle,
  stops,
  sourceX,
  sourceY,
  tubeWidth,
  tubeHeight,
  landX,
  landY,
  boardWidth,
  boardHeight,
  color,
}: Props) {
  /** Solve the arc for the current frame. */
  const pathProps = useAnimatedProps(() => {
    const p = progress.value;
    const keys = stops.value;

    // Mirror the tube's own transform exactly, or the stream detaches from the
    // lip during the travel and return phases.
    const tx = interpolate(p, keys, [0, dx.value, dx.value, 0]);
    const ty = interpolate(p, keys, [0, dy.value, dy.value, 0]);
    const degrees = interpolate(p, keys, [0, angle.value, angle.value, 0]);
    const radians = (degrees * Math.PI) / 180;

    const centreX = sourceX + tx + tubeWidth / 2 + STREAM_PAD;
    const centreY = sourceY + ty + tubeHeight / 2 + STREAM_PAD;

    const mouthX = centreX + (tubeHeight / 2) * Math.sin(radians);
    const mouthY = centreY - (tubeHeight / 2) * Math.cos(radians);

    const targetX = landX + STREAM_PAD;
    const targetY = landY + STREAM_PAD;

    // Rough arc length, only needed to drive the dash that grows and retracts
    // the stream; exactness would buy nothing visible.
    const length = Math.abs(targetY - mouthY) + Math.abs(targetX - mouthX) + 1;

    // The head runs ahead as the pour starts; the tail catches up as it ends,
    // so the stream visibly detaches from the lip and drains into the tube
    // rather than vanishing all at once.
    const head = interpolate(p, [0.235, 0.35], [0, 1], 'clamp');
    const tail = interpolate(p, [0.6, 0.73], [0, 1], 'clamp');
    const visible = Math.max(0, head - tail);

    return {
      d: `M ${mouthX} ${mouthY} Q ${targetX} ${mouthY} ${targetX} ${targetY}`,
      strokeDasharray: [length * visible, length * 2],
      strokeDashoffset: -length * tail,
    };
  });

  if (color === null) return null;

  const paint = liquid(color);
  const width = Math.max(5, tubeWidth * 0.19);

  return (
    <Svg
      pointerEvents="none"
      style={styles.canvas}
      width={boardWidth + STREAM_PAD * 2}
      height={boardHeight + STREAM_PAD * 2}
    >
      <Defs>
        <SvgGradient id="stream" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={paint.gradient[1]} />
          <Stop offset="0.35" stopColor={paint.gradient[0]} />
          <Stop offset="1" stopColor={paint.gradient[1]} />
        </SvgGradient>
      </Defs>

      {/* Soft outer body of the stream. */}
      <AnimatedPath
        animatedProps={pathProps}
        stroke={paint.solid}
        strokeWidth={width * 1.5}
        strokeOpacity={0.32}
        strokeLinecap="round"
        fill="none"
      />

      {/* The liquid itself. */}
      <AnimatedPath
        animatedProps={pathProps}
        stroke="url(#stream)"
        strokeWidth={width}
        strokeLinecap="round"
        fill="none"
      />

      {/* Specular thread down the near side, the same trick the tubes use. */}
      <AnimatedPath
        animatedProps={pathProps}
        stroke="rgba(255,255,255,0.65)"
        strokeWidth={Math.max(1.2, width * 0.22)}
        strokeLinecap="round"
        fill="none"
        translateX={-width * 0.24}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
    left: -STREAM_PAD,
    top: -STREAM_PAD,
    zIndex: 95,
  },
});
