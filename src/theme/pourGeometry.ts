/**
 * Geometry for the pour animation.
 *
 * Pure and framework-free so it can be unit tested, because getting it wrong is
 * not obvious from reading the code - it only shows up as liquid pouring into
 * thin air next to the target tube.
 *
 * A tube rotates about its own centre, so tilting swings the mouth sideways by
 * half a tube height times sin(angle). For the proportions this game uses
 * (height = 3.5 x width) that is over one and a half tube widths, which is why
 * the placement has to be solved rather than eyeballed.
 */

export interface TubeGeometry {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Where the mouth of a tube ends up.
 *
 * `topLeft` is the tube's rendered position, before any pour transform;
 * `offset` is the pour translation applied to it.
 *
 * NOTE: PourStream repeats these two lines inside a Reanimated worklet, because
 * it has to recompute the mouth every frame from the animated angle. If this
 * formula changes, change it there too - pourGeometry.test.ts locks the
 * relationship the two share.
 */
export function mouthPosition(
  topLeft: Point,
  offset: Point,
  tube: TubeGeometry,
  angleDegrees: number
): Point {
  const radians = (angleDegrees * Math.PI) / 180;
  const centreX = topLeft.x + offset.x + tube.width / 2;
  const centreY = topLeft.y + offset.y + tube.height / 2;

  return {
    x: centreX + (tube.height / 2) * Math.sin(radians),
    y: centreY - (tube.height / 2) * Math.cos(radians),
  };
}

export interface PourPlacement {
  /** Where the source tube's top-left must sit while pouring. */
  targetX: number;
  targetY: number;
  /** Signed tilt, in degrees. */
  angle: number;
}

/**
 * Park the source tube so that, at full tilt, its mouth sits over the centre of
 * the destination and clear of its rim.
 *
 * `side` is +1 when the source approaches from the left, -1 from the right, so
 * a tube never crosses over the tube it is filling.
 */
export function computePourPlacement(
  destination: Point,
  tube: TubeGeometry,
  angleDegrees: number,
  side: 1 | -1
): PourPlacement {
  const radians = (angleDegrees * Math.PI) / 180;

  // Sideways swing of the mouth once tilted.
  const reachX = (tube.height / 2) * Math.sin(radians);
  // How far the mouth rises above the tube's own centre once tilted.
  const riseY = (tube.height / 2) * (1 - Math.cos(radians));

  const destinationCentreX = destination.x + tube.width / 2;

  return {
    // Solve mouthX = destinationCentreX for the tube's top-left.
    targetX: destinationCentreX - side * reachX - tube.width / 2,
    // Clear the rim so the tube never visually intersects the one it fills.
    targetY: destination.y - tube.width * 0.34 - riseY,
    angle: side * angleDegrees,
  };
}
