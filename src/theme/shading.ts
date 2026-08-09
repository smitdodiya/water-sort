/**
 * Shading recipes that make flat rectangles read as rounded glass.
 *
 * The whole 3D impression comes from one idea: a cylinder lit from the upper
 * left has a dark left edge, a bright specular band about a third of the way
 * across, a mid-tone body, and a dimmer rim on the right where the surface
 * curves away. Painting that horizontal ramp over a flat fill is what turns a
 * rectangle into a tube.
 */

/**
 * expo-linear-gradient types `colors` and `locations` as non-empty tuples, so
 * these aliases keep the constants below assignable without casting at every
 * call site.
 */
type GradientColors = readonly [string, string, ...string[]];
type GradientLocations = readonly [number, number, ...number[]];

interface Ramp {
  colors: GradientColors;
  locations?: GradientLocations;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

/** Horizontal light ramp painted over the glass body. */
export const GLASS_CYLINDER: Ramp = {
  colors: [
    'rgba(0,0,0,0.34)',
    'rgba(255,255,255,0.10)',
    'rgba(255,255,255,0.42)',
    'rgba(255,255,255,0.06)',
    'rgba(0,0,0,0.16)',
    'rgba(0,0,0,0.40)',
  ],
  locations: [0, 0.12, 0.27, 0.46, 0.82, 1],
  start: { x: 0, y: 0.5 },
  end: { x: 1, y: 0.5 },
};

/**
 * The same ramp at lower contrast, painted over liquid.
 *
 * Liquid sits inside the glass, so it picks up less direct highlight than the
 * outer surface - matching the glass exactly would make the bands look like
 * they float in front of the tube rather than inside it.
 */
export const LIQUID_CYLINDER: Ramp = {
  colors: [
    'rgba(0,0,0,0.40)',
    'rgba(0,0,0,0.10)',
    'rgba(255,255,255,0.30)',
    'rgba(255,255,255,0.08)',
    'rgba(0,0,0,0.14)',
    'rgba(0,0,0,0.34)',
  ],
  locations: [0, 0.13, 0.29, 0.5, 0.84, 1],
  start: { x: 0, y: 0.5 },
  end: { x: 1, y: 0.5 },
};

/** Vertical darkening at the very bottom, where the tube curves under. */
export const FLOOR_SHADE: Ramp = {
  colors: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.30)'],
  start: { x: 0.5, y: 0 },
  end: { x: 0.5, y: 1 },
};

/**
 * How tall an ellipse is relative to its width, used for the tube opening and
 * every liquid surface. A shallow ellipse reads as a cylinder seen from
 * slightly above, which is the angle these games are drawn at.
 */
export const ELLIPSE_RATIO = 0.3;

/** Height of the drawn ellipse for a given tube width. */
export function ellipseHeight(width: number): number {
  return Math.max(4, width * ELLIPSE_RATIO);
}
