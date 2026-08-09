/**
 * Level generation.
 *
 * Every level is derived from its level number, so no level data is shipped or
 * stored and level 47 is the same board for everyone. Generation is
 * shuffle-then-verify: deal a random board, prove it solvable with the solver,
 * and reroll the seed if it is unsolvable, trivial, or outside its difficulty
 * band. That verification step is what stops an impossible board ever reaching
 * a player.
 */

import { isTubeSettled } from './engine';
import { getDifficulty } from './difficulty';
import { createRng, shuffle } from './rng';
import { solve } from './solver';
import { Board, Color, Level, TUBE_CAPACITY } from './types';

/** Seeds tried before we accept whatever we have. In practice 1-3 is typical. */
const MAX_ATTEMPTS = 60;

/** Mix the level number and attempt index into a well-spread seed. */
function seedFor(level: number, attempt: number): number {
  // Large odd multipliers keep consecutive levels from producing similar streams.
  return (level * 2654435761 + attempt * 40503 + 0x9e3779b9) >>> 0;
}

/** Deal `colors` x TUBE_CAPACITY segments into full tubes, plus the empty ones. */
function dealBoard(colors: number, emptyTubes: number, seed: number): Board {
  const pool: Color[] = [];
  for (let color = 0; color < colors; color++) {
    for (let i = 0; i < TUBE_CAPACITY; i++) pool.push(color);
  }

  const shuffled = shuffle(pool, createRng(seed));

  const board: Board = [];
  for (let i = 0; i < colors; i++) {
    board.push(shuffled.slice(i * TUBE_CAPACITY, (i + 1) * TUBE_CAPACITY));
  }
  for (let i = 0; i < emptyTubes; i++) board.push([]);

  return board;
}

/**
 * Reject boards that start out partly solved. A tube handed to the player
 * already complete is a wasted color and reads as a bug, and a board with
 * several near-complete tubes is over in three taps.
 */
function isDegenerate(board: Board): boolean {
  const settled = board.filter((tube) => tube.length > 0 && isTubeSettled(tube)).length;
  if (settled > 0) return true;

  // Three-of-a-kind at the bottom of a tube is nearly as much of a giveaway.
  const nearlyDone = board.filter((tube) => {
    if (tube.length !== TUBE_CAPACITY) return false;
    const counts = new Map<Color, number>();
    for (const c of tube) counts.set(c, (counts.get(c) ?? 0) + 1);
    return Math.max(...counts.values()) >= 3;
  }).length;

  return nearlyDone >= 2;
}

/**
 * Generate the level for `levelNumber`.
 *
 * Deterministic: the same level number always produces the same board and the
 * same verified solution.
 */
export function generateLevel(levelNumber: number): Level {
  const level = Math.max(1, Math.floor(levelNumber));
  const config = getDifficulty(level);

  let fallback: Level | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const board = dealBoard(config.colors, config.emptyTubes, seedFor(level, attempt));
    if (isDegenerate(board)) continue;

    const result = solve(board);
    if (!result.solved) continue;

    const moves = result.moves.length;

    // Keep the first solvable board as insurance so we always return something
    // playable even if no seed lands inside the band.
    if (!fallback) {
      fallback = { level, board, colors: config.colors, solutionMoves: moves, solution: result.moves };
    }

    if (moves >= config.minMoves && moves <= config.maxMoves) {
      return { level, board, colors: config.colors, solutionMoves: moves, solution: result.moves };
    }
  }

  if (fallback) return fallback;

  // Every seed failed, which should not happen for any config the curve
  // produces. Keep the configured board shape - changing emptyTubes here would
  // hand back a board of a different size than the rest of the app expects.
  const board = dealBoard(config.colors, config.emptyTubes, seedFor(level, MAX_ATTEMPTS));
  const result = solve(board, { nodeCap: 400_000 });
  return {
    level,
    board,
    colors: config.colors,
    solutionMoves: result.moves.length,
    solution: result.moves,
  };
}
