/**
 * Locks the pour placement.
 *
 * This exists because an earlier version parked the pouring tube using a
 * hand-picked fraction of the tube width, which put the mouth almost a full
 * tube width past the destination - the liquid appeared to pour into empty
 * space. Nothing in a type check or a render catches that; only asserting the
 * geometry does.
 */

import { computePourPlacement, mouthPosition, Point, TubeGeometry } from '../src/theme/pourGeometry';

/** Matches the real board: tubes are 3.5x taller than they are wide. */
const TUBE: TubeGeometry = { width: 50, height: 175 };
const ANGLE = 74;

/** Where the mouth ends up once the tube is parked and fully tilted. */
function mouthAtFullTilt(source: Point, destination: Point, side: 1 | -1) {
  const placement = computePourPlacement(destination, TUBE, ANGLE, side);
  return mouthPosition(
    source,
    { x: placement.targetX - source.x, y: placement.targetY - source.y },
    TUBE,
    placement.angle
  );
}

describe('computePourPlacement', () => {
  const destination: Point = { x: 200, y: 100 };

  it.each([
    ['from the left', 1 as const, { x: 40, y: 100 }],
    ['from the right', -1 as const, { x: 360, y: 100 }],
    ['from another row', 1 as const, { x: 40, y: 400 }],
  ])('lands the mouth on the destination centre line when approaching %s', (_label, side, source) => {
    const mouth = mouthAtFullTilt(source, destination, side);
    const destinationCentreX = destination.x + TUBE.width / 2;

    // Sub-pixel, or the stream visibly misses the tube.
    expect(Math.abs(mouth.x - destinationCentreX)).toBeLessThan(0.5);
  });

  it('holds the mouth above the destination rim, not inside it', () => {
    const mouth = mouthAtFullTilt({ x: 40, y: 100 }, destination, 1);

    // Above the rim...
    expect(mouth.y).toBeLessThan(destination.y);
    // ...but not so high the liquid falls from off-screen.
    expect(destination.y - mouth.y).toBeLessThan(TUBE.width);
  });

  it('approaches from the requested side without crossing the target', () => {
    const fromLeft = computePourPlacement(destination, TUBE, ANGLE, 1);
    const fromRight = computePourPlacement(destination, TUBE, ANGLE, -1);

    expect(fromLeft.targetX).toBeLessThan(destination.x);
    expect(fromRight.targetX).toBeGreaterThan(destination.x);
    expect(fromLeft.angle).toBe(ANGLE);
    expect(fromRight.angle).toBe(-ANGLE);
  });

  it('stays correct for other tube proportions and tilt angles', () => {
    // The whole point of solving rather than tuning: change the shape or the
    // angle and the mouth still lands where it should.
    for (const tube of [
      { width: 34, height: 119 },
      { width: 68, height: 238 },
      { width: 50, height: 120 },
    ]) {
      for (const angle of [55, 74, 88]) {
        const placement = computePourPlacement(destination, tube, angle, 1);
        const source = { x: 10, y: 100 };
        const mouth = mouthPosition(
          source,
          { x: placement.targetX - source.x, y: placement.targetY - source.y },
          tube,
          placement.angle
        );
        expect(Math.abs(mouth.x - (destination.x + tube.width / 2))).toBeLessThan(0.5);
      }
    }
  });
});

describe('mouthPosition', () => {
  it('puts the mouth directly above the centre when upright', () => {
    const mouth = mouthPosition({ x: 0, y: 0 }, { x: 0, y: 0 }, TUBE, 0);
    expect(mouth.x).toBeCloseTo(TUBE.width / 2, 5);
    expect(mouth.y).toBeCloseTo(0, 5);
  });

  it('swings the mouth right for a clockwise tilt and left for anticlockwise', () => {
    const centre = { x: 0, y: 0 };
    const right = mouthPosition(centre, { x: 0, y: 0 }, TUBE, 74);
    const left = mouthPosition(centre, { x: 0, y: 0 }, TUBE, -74);

    expect(right.x).toBeGreaterThan(TUBE.width / 2);
    expect(left.x).toBeLessThan(TUBE.width / 2);
    // Symmetric about the tube's own centre line.
    expect(right.x - TUBE.width / 2).toBeCloseTo(TUBE.width / 2 - left.x, 5);
  });

  it('lays the mouth flat with the centre at ninety degrees', () => {
    const mouth = mouthPosition({ x: 0, y: 0 }, { x: 0, y: 0 }, TUBE, 90);
    expect(mouth.y).toBeCloseTo(TUBE.height / 2, 5);
    expect(mouth.x).toBeCloseTo(TUBE.width / 2 + TUBE.height / 2, 5);
  });

  it('carries the pour translation through', () => {
    const base = mouthPosition({ x: 0, y: 0 }, { x: 0, y: 0 }, TUBE, 30);
    const moved = mouthPosition({ x: 0, y: 0 }, { x: 25, y: -40 }, TUBE, 30);
    expect(moved.x - base.x).toBeCloseTo(25, 5);
    expect(moved.y - base.y).toBeCloseTo(-40, 5);
  });
});
