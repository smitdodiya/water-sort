/**
 * Level number -> difficulty knobs.
 *
 * The curve is deliberately gentle for the first dozen levels: the genre lives
 * or dies on new players finishing level 1 without being taught anything, then
 * feeling the ramp. Colors climb first because they are the real difficulty
 * lever; empty tubes only tighten much later.
 */

import { DifficultyConfig, TUBE_CAPACITY } from './types';

/** Palette size ceiling. Beyond this the board stops fitting a phone screen legibly. */
export const MAX_COLORS = 12;

export function getDifficulty(level: number): DifficultyConfig {
  const n = Math.max(1, Math.floor(level));

  let colors: number;

  /*
   * Always two empty tubes.
   *
   * A single spare tube looks like an obvious difficulty lever, but a randomly
   * dealt one-empty board is unsolvable the overwhelming majority of the time -
   * the generator burned every seed it had and still could not find one. Games
   * that ship those levels build them by reversing from a solved state, which
   * produces a noticeably different (and flatter) kind of puzzle.
   *
   * Color count is the honest lever, so the curve rides that instead.
   */
  const emptyTubes = 2;

  if (n <= 2) {
    colors = 3;
  } else if (n <= 5) {
    colors = 4;
  } else if (n <= 12) {
    colors = 5;
  } else if (n <= 25) {
    colors = 6;
  } else if (n <= 45) {
    colors = 7;
  } else if (n <= 70) {
    colors = 8;
  } else if (n <= 100) {
    colors = 9;
  } else if (n <= 150) {
    colors = 10;
  } else if (n <= 220) {
    colors = 11;
  } else {
    colors = MAX_COLORS;
  }

  // A solvable board needs at least one pour per color to consolidate, and in
  // practice good levels sit well above that. The band rejects seeds that
  // happen to deal a nearly-sorted (boring) or pathologically long board.
  const minMoves = Math.max(4, Math.round(colors * 1.6));
  const maxMoves = Math.round(colors * 5.5) + 12;

  return {
    colors,
    emptyTubes,
    minMoves,
    maxMoves,
    // A single bail-out tube per level. More than one turns any board trivial.
    maxExtraTubes: 1,
  };
}

/**
 * Star thresholds, based on the solution the generator verified.
 *
 * 3 stars means the player was near the reference solution, 2 means they got
 * there without much flailing, 1 is simply finishing. Undo does not cost moves,
 * so this rewards thinking rather than punishing experimentation.
 */
export function starsForMoves(moves: number, solutionMoves: number): 1 | 2 | 3 {
  if (moves <= solutionMoves + Math.ceil(solutionMoves * 0.15)) return 3;
  if (moves <= solutionMoves + Math.ceil(solutionMoves * 0.6)) return 2;
  return 1;
}

/** Total tubes on screen at the start of a level. */
export function tubeCountForLevel(level: number): number {
  const { colors, emptyTubes } = getDifficulty(level);
  return colors + emptyTubes;
}

/** Total liquid segments in play. Handy for layout maths and tests. */
export function segmentCountForLevel(level: number): number {
  return getDifficulty(level).colors * TUBE_CAPACITY;
}
