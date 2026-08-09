/**
 * Deterministic seeded RNG.
 *
 * Levels are generated from their level number, so level 47 is byte-identical on
 * every device and across reinstalls. That means we never ship or persist level
 * data - the seed IS the level.
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

/**
 * mulberry32 - small, fast, and good enough statistically for shuffling a deck
 * of at most ~50 items. Same seed always yields the same stream.
 */
export function createRng(seed: number): Rng {
  // Force to a 32-bit unsigned integer so callers can pass any number safely.
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (maxExclusive: number) => Math.floor(next() * maxExclusive),
  };
}

/**
 * Fisher-Yates shuffle. Returns a new array; the input is left untouched so
 * callers can safely reshuffle the same source pool with a different seed.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
