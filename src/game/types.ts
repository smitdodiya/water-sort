/**
 * Core game types.
 *
 * A tube is an array of color ids where index 0 is the BOTTOM of the tube and
 * the last element is the TOP (the surface of the liquid). An empty array is an
 * empty tube. Tubes never exceed TUBE_CAPACITY entries.
 */

/** Index into the color palette. Colors are plain numbers so states serialize cheaply. */
export type Color = number;

/** Bottom-first stack of liquid segments. */
export type Tube = Color[];

/** The full playfield: an ordered list of tubes. Order is stable and matches the UI. */
export type Board = Tube[];

/** A single pour: `count` segments moved from tube `from` onto tube `to`. */
export interface Move {
  from: number;
  to: number;
  count: number;
}

/** Everything needed to render and reason about a level in progress. */
export interface GameState {
  /** The level number this board was generated from (also the RNG seed). */
  level: number;
  /** Current playfield. */
  board: Board;
  /** Index of the currently selected tube, or null when nothing is picked up. */
  selected: number | null;
  /** Every pour made so far, oldest first. Doubles as the undo stack. */
  history: Move[];
  /** Number of pours made. Equals history.length, kept explicit for clarity in the UI. */
  moves: number;
  /** How many extra tubes the player has added this level (capped by difficulty). */
  extraTubes: number;
}

/** Shape of a generated level, before any player input. */
export interface Level {
  level: number;
  board: Board;
  /** Number of distinct colors in play. */
  colors: number;
  /**
   * Length of the solution the generator verified. Near-optimal rather than
   * provably optimal, which is all the star thresholds need.
   */
  solutionMoves: number;
  /** The verified solution from the starting board, replayed for hints. */
  solution: Move[];
}

/** Tuning knobs for one level, produced by difficulty.ts. */
export interface DifficultyConfig {
  /** Distinct colors, each appearing exactly TUBE_CAPACITY times. */
  colors: number;
  /** Empty tubes handed to the player at the start. Fewer = harder. */
  emptyTubes: number;
  /** Generated levels must need at least this many moves, or we reroll the seed. */
  minMoves: number;
  /** Generated levels must need at most this many moves, or we reroll the seed. */
  maxMoves: number;
  /** How many extra tubes the player may summon via the power-up. */
  maxExtraTubes: number;
}

/** Segments a single tube holds when full. Four is the genre standard. */
export const TUBE_CAPACITY = 4;
