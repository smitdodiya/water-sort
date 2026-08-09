/**
 * A single glass tube, drawn to read as a cylinder rather than a rectangle.
 *
 * The 3D comes from four stacked layers: a contact shadow on the ground, a
 * clipped body carrying the liquid and a horizontal light ramp, an open ellipse
 * at the mouth, and a rim highlight. No 3D engine involved - just shading that
 * matches where the light is coming from.
 *
 * Motion owned here:
 *   - lift, when the tube is selected
 *   - the pour arc, driven by board-level shared values so only the pouring
 *     tube reacts and the rest stay perfectly still
 *   - a shake, when a tap is rejected
 *   - squash and stretch, when liquid lands in it
 *   - a pulse and glow, the moment the tube is completed
 *
 * All of it runs in Reanimated worklets on the UI thread, so the solver can be
 * thinking on the JS thread without the animation stuttering.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { isTubeComplete, topRunLength } from '../game/engine';
import { Tube as TubeModel } from '../game/types';
import { liquid, UI } from '../theme/colors';
import { BoardLayout } from '../theme/layout';
import { ellipseHeight, FLOOR_SHADE, GLASS_CYLINDER } from '../theme/shading';
import { LiquidSegment } from './LiquidSegment';

/** Shared values every tube reads to know whether (and how) it is pouring. */
export interface PourAnimation {
  /** Index of the pouring tube, or -1 when nothing is in flight. */
  from: SharedValue<number>;
  /** 0 -> 1 across the whole lift/tilt/flow/return choreography. */
  progress: SharedValue<number>;
  /** Offset from the source's home position to the pour position. */
  dx: SharedValue<number>;
  dy: SharedValue<number>;
  /** Tilt in degrees, signed by which side of the target the source sits on. */
  angle: SharedValue<number>;
  /** Keyframes the tube transform interpolates across. */
  stops: SharedValue<number[]>;
}

interface Props {
  index: number;
  tube: TubeModel;
  layout: BoardLayout;
  x: number;
  y: number;
  isSelected: boolean;
  isPouring: boolean;
  /** How many segments arrived on the last commit, so only those grow in. */
  arrivingCount: number;
  /** Bumped to trigger a shake. */
  shakeSignal: number;
  /** Bumped to trigger squash and stretch as liquid lands. */
  impactSignal: number;
  /** Bumped to trigger the completion celebration. */
  completeSignal: number;
  /** Highlighted as the source or target of the current hint. */
  hintRole: 'from' | 'to' | null;
  colorblind: boolean;
  pour: PourAnimation;
  onPress: (index: number) => void;
}

function TubeComponent({
  index,
  tube,
  layout,
  x,
  y,
  isSelected,
  isPouring,
  arrivingCount,
  shakeSignal,
  impactSignal,
  completeSignal,
  hintRole,
  colorblind,
  pour,
  onPress,
}: Props) {
  const lift = useSharedValue(0);
  const shake = useSharedValue(0);
  const pulse = useSharedValue(1);
  const squash = useSharedValue(0);
  const glow = useSharedValue(0);
  const hintPulse = useSharedValue(0);

  const complete = isTubeComplete(tube);
  const runLength = topRunLength(tube);
  const mouthHeight = ellipseHeight(layout.tubeWidth);

  useEffect(() => {
    lift.value = withSpring(isSelected ? -layout.liftDistance : 0, {
      damping: 14,
      stiffness: 260,
      mass: 0.6,
    });
  }, [isSelected, layout.liftDistance, lift]);

  useEffect(() => {
    // Signals start at 0 and only ever increment, so skip the initial render.
    if (shakeSignal === 0) return;
    shake.value = withSequence(
      withTiming(-8, { duration: 45 }),
      withTiming(8, { duration: 55 }),
      withTiming(-4, { duration: 45 }),
      withTiming(0, { duration: 45 })
    );
  }, [shakeSignal, shake]);

  useEffect(() => {
    if (impactSignal === 0) return;
    // Squash on the hit, then overshoot tall before settling - the classic
    // weight cue, and the reason a landing reads as having mass.
    squash.value = withSequence(
      withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 7, stiffness: 260, mass: 0.5 })
    );
  }, [impactSignal, squash]);

  useEffect(() => {
    if (completeSignal === 0) return;
    pulse.value = withSequence(
      withTiming(1.14, { duration: 140, easing: Easing.out(Easing.back(2.4)) }),
      withSpring(1, { damping: 8, stiffness: 210 })
    );
    glow.value = withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(120, withTiming(0, { duration: 620 }))
    );
  }, [completeSignal, pulse, glow]);

  useEffect(() => {
    if (hintRole) {
      hintPulse.value = withSequence(
        withTiming(1, { duration: 320 }),
        withTiming(0.25, { duration: 320 }),
        withTiming(1, { duration: 320 }),
        withTiming(0, { duration: 320 })
      );
    } else {
      hintPulse.value = withTiming(0, { duration: 150 });
    }
  }, [hintRole, hintPulse]);

  const animatedStyle = useAnimatedStyle(() => {
    const pouring = pour.from.value === index;
    // Squash widens as it flattens, conserving apparent volume.
    const squashY = 1 - squash.value * 0.09;
    const squashX = 1 + squash.value * 0.07;

    if (!pouring) {
      return {
        transform: [
          { translateX: shake.value },
          { translateY: lift.value },
          { scale: pulse.value },
          { scaleX: squashX },
          { scaleY: squashY },
        ],
      };
    }

    // Flat middle section: the tube travels out, holds while the liquid flows,
    // then travels home.
    const stops = pour.stops.value;
    const p = pour.progress.value;

    return {
      transform: [
        { translateX: interpolate(p, stops, [0, pour.dx.value, pour.dx.value, 0]) },
        { translateY: interpolate(p, stops, [0, pour.dy.value, pour.dy.value, 0]) },
        { rotate: `${interpolate(p, stops, [0, pour.angle.value, pour.angle.value, 0])}deg` },
        { scale: pulse.value },
        { scaleX: squashX },
        { scaleY: squashY },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: Math.max(glow.value * 0.85, hintPulse.value * 0.75),
    transform: [{ scale: 1 + Math.max(glow.value, hintPulse.value) * 0.06 }],
  }));

  const shadowStyle = useAnimatedStyle(() => {
    // The contact shadow shrinks and softens as the tube lifts away from it,
    // which is most of what makes the lift read as height rather than a slide.
    const height = Math.abs(lift.value) / Math.max(1, layout.liftDistance);
    return {
      opacity: 0.42 - height * 0.22,
      transform: [{ scaleX: 1 - height * 0.14 }, { scaleY: 1 - height * 0.2 }],
    };
  });

  const glowColor = complete && tube.length > 0 ? liquid(tube[0]).solid : UI.accent;

  // Segments that arrived on the last commit sit at the top of the stack.
  const arrivingFrom = tube.length - arrivingCount;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          left: x,
          top: y,
          width: layout.tubeWidth,
          height: layout.tubeHeight,
          // The pouring tube must pass over its neighbours, and a selected tube
          // over the row below it.
          zIndex: isPouring ? 100 : isSelected ? 20 : 1,
        },
        animatedStyle,
      ]}
    >
      {/* Contact shadow on the ground, which anchors the tube in space. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.contactShadow,
          {
            height: mouthHeight * 0.9,
            bottom: -mouthHeight * 0.42,
            borderRadius: layout.tubeWidth,
          },
          shadowStyle,
        ]}
      />

      {/* Glow behind the glass, driven by completion and hints. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            borderRadius: layout.radius * 1.25,
            shadowColor: glowColor,
            backgroundColor: glowColor,
          },
          glowStyle,
        ]}
      />

      <Pressable
        onPress={() => onPress(index)}
        // Generous slop: tubes are narrow and thumbs are not.
        hitSlop={{ top: 12, bottom: 16, left: 8, right: 8 }}
        style={styles.pressArea}
      >
        {/* Clipped body: everything that must not spill past the glass. */}
        <View
          style={[
            styles.body,
            {
              borderRadius: layout.radius,
              borderTopLeftRadius: layout.radius * 0.2,
              borderTopRightRadius: layout.radius * 0.2,
            },
          ]}
        >
          <View style={styles.stack}>
            {tube.map((color, segmentIndex) => (
              <LiquidSegment
                key={segmentIndex}
                color={color}
                width={layout.tubeWidth}
                height={layout.segmentHeight}
                isBottom={segmentIndex === 0}
                isTop={segmentIndex === tube.length - 1}
                bottomRadius={layout.radius * 0.85}
                animateIn={arrivingCount > 0 && segmentIndex >= arrivingFrom}
                showSymbol={colorblind}
              />
            ))}
          </View>

          {/* Horizontal light ramp: the curve of the glass cylinder. */}
          <LinearGradient
            colors={GLASS_CYLINDER.colors}
            locations={GLASS_CYLINDER.locations}
            start={GLASS_CYLINDER.start}
            end={GLASS_CYLINDER.end}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* The tube curves under at the base, so the light falls off there. */}
          <LinearGradient
            colors={FLOOR_SHADE.colors}
            start={FLOOR_SHADE.start}
            end={FLOOR_SHADE.end}
            style={[styles.floor, { height: layout.tubeWidth * 0.55 }]}
            pointerEvents="none"
          />

          {/* Tight vertical glare on the front face. */}
          <View
            pointerEvents="none"
            style={[
              styles.glare,
              {
                left: layout.tubeWidth * 0.2,
                width: Math.max(2.5, layout.tubeWidth * 0.075),
                top: mouthHeight,
                bottom: layout.tubeWidth * 0.5,
                borderRadius: layout.tubeWidth,
              },
            ]}
          />
        </View>

        {/* The opening, drawn as a ring so liquid at the brim shows through. */}
        <View
          pointerEvents="none"
          style={[
            styles.mouth,
            {
              height: mouthHeight,
              top: -mouthHeight / 2,
              borderRadius: layout.tubeWidth,
              borderColor: isSelected ? UI.accent : 'rgba(255,255,255,0.55)',
            },
          ]}
        />

        {/* Outer wall, drawn last so nothing paints over it. */}
        <View
          pointerEvents="none"
          style={[
            styles.wall,
            {
              borderRadius: layout.radius,
              borderTopLeftRadius: layout.radius * 0.2,
              borderTopRightRadius: layout.radius * 0.2,
              borderColor: isSelected ? UI.accent : UI.glassBorder,
              borderWidth: isSelected ? 2 : 1.2,
            },
          ]}
        />
      </Pressable>

      {/* Count of the liftable run, shown only while selected - a small nudge
          that tells the player how much liquid they are about to move. */}
      {isSelected && runLength > 1 && (
        <View style={styles.runBadge} pointerEvents="none">
          <Animated.Text style={styles.runBadgeText}>{runLength}</Animated.Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
  },
  pressArea: {
    flex: 1,
    // Visible, or the mouth ellipse that sits half above the body is clipped.
    overflow: 'visible',
  },
  contactShadow: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  glow: {
    ...StyleSheet.absoluteFill,
    margin: -7,
    shadowOpacity: 0.95,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
    opacity: 0,
  },
  body: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(160, 190, 230, 0.09)',
    overflow: 'hidden',
  },
  stack: {
    ...StyleSheet.absoluteFill,
    // Array index 0 is the bottom of the tube, so reverse the column to match.
    flexDirection: 'column-reverse',
  },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  glare: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  mouth: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderWidth: 1.4,
    backgroundColor: 'transparent',
  },
  wall: {
    ...StyleSheet.absoluteFill,
  },
  runBadge: {
    position: 'absolute',
    top: -26,
    alignSelf: 'center',
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: UI.accent,
  },
  runBadgeText: {
    color: '#04121F',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
});

export const Tube = React.memo(TubeComponent);
