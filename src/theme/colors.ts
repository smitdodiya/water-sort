/**
 * Palette.
 *
 * Liquid colors are picked to stay distinguishable at small sizes on a dark
 * background - the failure mode in this genre is two similar blues that make a
 * level feel unfair. Each entry carries its own light/dark stops so a segment
 * can be drawn as a real gradient instead of a flat fill.
 */

export interface LiquidColor {
  /** Human name, used by the colorblind label mode and for debugging. */
  name: string;
  /** Gradient stops, top (lighter) to bottom (deeper). */
  gradient: [string, string];
  /** Solid representative color, used for glows, the pour stream, and shadows. */
  solid: string;
  /** Glyph shown in colorblind mode so hue is never the only signal. */
  symbol: string;
}

/**
 * Up to MAX_COLORS liquids. Hues are spaced around the wheel and alternate
 * between light and deep so neighbours never read as the same color.
 */
export const LIQUIDS: LiquidColor[] = [
  { name: 'Ruby', gradient: ['#FF5A7E', '#E01E45'], solid: '#F43066', symbol: '●' },
  { name: 'Ocean', gradient: ['#4FC3F7', '#0277BD'], solid: '#29A3E0', symbol: '▲' },
  { name: 'Lime', gradient: ['#B2F04A', '#5CA904'], solid: '#8FD62B', symbol: '■' },
  { name: 'Amber', gradient: ['#FFC857', '#F08A00'], solid: '#FFA51F', symbol: '★' },
  { name: 'Violet', gradient: ['#C08BFF', '#7B2FF7'], solid: '#9D5CFF', symbol: '◆' },
  { name: 'Teal', gradient: ['#5FF0D5', '#00A88E'], solid: '#22CBAF', symbol: '▼' },
  { name: 'Coral', gradient: ['#FF9E7A', '#F2542D'], solid: '#FF7A49', symbol: '✚' },
  { name: 'Indigo', gradient: ['#8FA6FF', '#2B3FD9'], solid: '#5A73F0', symbol: '❤' },
  { name: 'Magenta', gradient: ['#FF7BE0', '#C2189E'], solid: '#EE45C4', symbol: '⬟' },
  { name: 'Sand', gradient: ['#F3E0A8', '#C9A227'], solid: '#E2C75B', symbol: '◐' },
  { name: 'Mint', gradient: ['#C8FFB0', '#48B02B'], solid: '#8CE86A', symbol: '✦' },
  { name: 'Slate', gradient: ['#B8C6D6', '#5A6B80'], solid: '#8A9BB0', symbol: '⬢' },
];

/** Look up a liquid by color id, wrapping defensively rather than crashing. */
export function liquid(color: number): LiquidColor {
  return LIQUIDS[color % LIQUIDS.length];
}

/** UI chrome. Dark, cool, and low-contrast so the liquids are the only bright thing. */
export const UI = {
  /** Background gradient, top to bottom. */
  backdrop: ['#0B1026', '#141B3D', '#0A0E20'] as const,

  glassBody: 'rgba(255, 255, 255, 0.07)',
  glassBorder: 'rgba(255, 255, 255, 0.20)',
  glassHighlight: 'rgba(255, 255, 255, 0.45)',
  glassShadow: 'rgba(0, 0, 0, 0.45)',

  text: '#F2F5FF',
  textDim: 'rgba(242, 245, 255, 0.62)',
  textFaint: 'rgba(242, 245, 255, 0.35)',

  accent: '#4FC3F7',
  accentDeep: '#0277BD',
  success: '#3DDC97',
  warning: '#FFC857',
  danger: '#FF5A7E',

  panel: 'rgba(18, 24, 54, 0.92)',
  panelBorder: 'rgba(255, 255, 255, 0.12)',

  buttonFace: 'rgba(255, 255, 255, 0.10)',
  buttonFaceActive: 'rgba(255, 255, 255, 0.18)',
  buttonDisabled: 'rgba(255, 255, 255, 0.04)',
} as const;

/** Confetti pulls from the liquid palette so a win feels like the level itself. */
export const CONFETTI_COLORS = LIQUIDS.map((l) => l.solid);
