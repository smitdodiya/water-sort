/**
 * Water sort solver.
 *
 * Used for two things:
 *   1. the generator refuses to ship a level this cannot solve, so an impossible
 *      board can never reach a player
 *   2. the hint button re-solves whatever the player has made of the board and
 *      points at the next good move
 *
 * Strategy is a depth-first search with heuristic move ordering and a visited
 * set keyed on the canonical (tube-order-independent) board string. Move
 * ordering is strong enough that the first solution found is usually at or near
 * optimal, and the visited set keeps the search space tiny. A node cap
 * guarantees we return rather than hang, whatever the input.
 */

import { boardKey, isSolved, isTubeComplete, legalMoves, topColor, topRunLength } from './engine';
import { Board, Move, TUBE_CAPACITY } from './types';

export interface SolveOptions {
  /** Abort and report failure after exploring this many nodes. */
  nodeCap?: number;
  /** Abort and report failure past this search depth. */
  maxDepth?: number;
}

export interface SolveResult {
  /** True only when `moves` genuinely reaches a solved board. */
  solved: boolean;
  /** The winning sequence, empty when unsolved. */
  moves: Move[];
  /** Nodes visited, exposed so tests can assert the cap is respected. */
  nodes: number;
  /** True when the search gave up on the cap rather than proving unsolvability. */
  hitCap: boolean;
}

const DEFAULT_NODE_CAP = 200_000;
const DEFAULT_MAX_DEPTH = 220;

/**
 * Rank a candidate move. Higher is tried first.
 *
 * The ordering encodes how a strong human plays: finish a tube if you can, free
 * up a tube if you can, otherwise move as much liquid as possible and avoid
 * spending empty tubes you might need later.
 */
function scoreMove(board: Board, move: Move): number {
  const source = board[move.from];
  const dest = board[move.to];
  let score = 0;

  // Completing a tube is almost always right and permanently shrinks the puzzle.
  if (dest.length + move.count === TUBE_CAPACITY && (dest.length === 0 || topColor(dest) === topColor(source))) {
    const wouldBeUniform = dest.length === 0 ? move.count === TUBE_CAPACITY : topRunLength(dest) === dest.length;
    if (wouldBeUniform) score += 1000;
  }

  // Emptying a tube hands us a free slot, which is the scarcest resource.
  if (move.count === source.length) score += 500;

  // Pouring onto a matching surface consolidates; pouring into an empty tube
  // spends a slot, so it is a last resort.
  if (dest.length > 0) score += 200;

  // All else equal, move more liquid per move.
  score += move.count * 10;

  return score;
}

/**
 * Solve `board`. Returns the move sequence, or `solved: false` when the puzzle
 * is unsolvable or the search hit its cap.
 */
export function solve(board: Board, options: SolveOptions = {}): SolveResult {
  const nodeCap = options.nodeCap ?? DEFAULT_NODE_CAP;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  const visited = new Set<string>();
  const path: Move[] = [];
  let nodes = 0;
  let hitCap = false;

  // Mutating one board in place and undoing after each branch avoids allocating
  // a fresh board per node, which matters at hundreds of thousands of nodes.
  const working: Board = board.map((tube) => tube.slice());

  const search = (depth: number): boolean => {
    if (isSolved(working)) return true;
    if (depth >= maxDepth) return false;

    if (nodes >= nodeCap) {
      hitCap = true;
      return false;
    }
    nodes++;

    const key = boardKey(working);
    if (visited.has(key)) return false;
    visited.add(key);

    const moves = legalMoves(working);
    moves.sort((a, b) => scoreMove(working, b) - scoreMove(working, a));

    for (const move of moves) {
      const moved = working[move.from].splice(working[move.from].length - move.count, move.count);
      working[move.to].push(...moved);
      path.push(move);

      if (search(depth + 1)) return true;

      path.pop();
      const returning = working[move.to].splice(working[move.to].length - move.count, move.count);
      working[move.from].push(...returning);

      // Once the cap trips, unwind the whole stack instead of trying siblings.
      if (hitCap) return false;
    }

    return false;
  };

  const solved = search(0);
  return { solved, moves: solved ? path.slice() : [], nodes, hitCap };
}

/**
 * The next move a player should make from the current board.
 *
 * Runs with a smaller cap than generation because this is on the interaction
 * path - a hint that takes half a second feels broken. Returns null when the
 * position is already lost or the search could not find anything in budget.
 */
export function findHint(board: Board): Move | null {
  if (isSolved(board)) return null;

  const result = solve(board, { nodeCap: 60_000 });
  if (result.solved && result.moves.length > 0) return result.moves[0];

  // No full solution in budget. Fall back to the best single move so the button
  // still does something useful rather than nothing.
  const moves = legalMoves(board);
  if (moves.length === 0) return null;
  return moves.reduce((best, move) => (scoreMove(board, move) > scoreMove(board, best) ? move : best));
}

/**
 * Whether the current board can still be won. Powers the "no moves left" state
 * so the player is told to undo instead of staring at a dead board.
 */
export function isStillSolvable(board: Board): boolean {
  if (isSolved(board)) return true;
  const result = solve(board, { nodeCap: 60_000 });
  // On a cap hit we have proved nothing, so assume solvable rather than
  // accusing the player of a dead end that may not exist.
  return result.solved || result.hitCap;
}

/** Convenience for tests and difficulty banding. */
export function countCompletedTubes(board: Board): number {
  return board.filter(isTubeComplete).length;
}
