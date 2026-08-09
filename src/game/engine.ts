/**
 * Pure game rules. Every function here is side-effect free and returns new data,
 * which is what makes undo trivial and the solver cheap to run.
 *
 * Deliberately free of React and React Native imports so it can be unit tested
 * in plain Node and reused unchanged if the UI is ever rewritten.
 */

import { Board, Color, Move, Tube, TUBE_CAPACITY } from './types';

/** Deep copy of a board. Boards are small (<= ~14 tubes x 4), so this is cheap. */
export function cloneBoard(board: Board): Board {
  return board.map((tube) => tube.slice());
}

/** The color at the surface of a tube, or null when the tube is empty. */
export function topColor(tube: Tube): Color | null {
  return tube.length === 0 ? null : tube[tube.length - 1];
}

/**
 * How many segments of the same color sit at the top of the tube. This is the
 * chunk that lifts on selection and the amount a pour tries to move.
 */
export function topRunLength(tube: Tube): number {
  if (tube.length === 0) return 0;
  const color = tube[tube.length - 1];
  let run = 1;
  for (let i = tube.length - 2; i >= 0; i--) {
    if (tube[i] !== color) break;
    run++;
  }
  return run;
}

/** Unfilled segments remaining in a tube. */
export function freeSpace(tube: Tube): number {
  return TUBE_CAPACITY - tube.length;
}

/** True when a tube is full and every segment is the same color. */
export function isTubeComplete(tube: Tube): boolean {
  return tube.length === TUBE_CAPACITY && topRunLength(tube) === TUBE_CAPACITY;
}

/**
 * A tube the player should not bother touching: either empty, or already a
 * finished single-color stack. Used to grey out tubes and to prune the solver.
 */
export function isTubeSettled(tube: Tube): boolean {
  return tube.length === 0 || isTubeComplete(tube);
}

/**
 * Pour legality. The three genre rules, in order:
 *   1. a tube cannot pour into itself, and the source must have liquid
 *   2. the destination must have room
 *   3. the destination must be empty, or its surface color must match
 */
export function canPour(board: Board, from: number, to: number): boolean {
  if (from === to) return false;
  const source = board[from];
  const dest = board[to];
  if (!source || !dest) return false;
  if (source.length === 0) return false;
  if (dest.length >= TUBE_CAPACITY) return false;

  const destTop = topColor(dest);
  if (destTop !== null && destTop !== topColor(source)) return false;

  // Moving a whole stack into an empty tube just shuffles the problem sideways
  // and never helps. Blocking it removes a large branch of pointless moves from
  // the solver and stops the player wasting a move that cannot progress.
  if (dest.length === 0 && topRunLength(source) === source.length) return false;

  return true;
}

/** Segments that would actually move, limited by whichever runs out first. */
export function pourAmount(board: Board, from: number, to: number): number {
  if (!canPour(board, from, to)) return 0;
  return Math.min(topRunLength(board[from]), freeSpace(board[to]));
}

/**
 * Apply a pour. Returns the new board plus the Move that describes it, or null
 * when the pour is illegal. Callers push the Move onto the undo stack.
 */
export function applyPour(
  board: Board,
  from: number,
  to: number
): { board: Board; move: Move } | null {
  const count = pourAmount(board, from, to);
  if (count === 0) return null;

  const next = cloneBoard(board);
  const moved = next[from].splice(next[from].length - count, count);
  next[to].push(...moved);
  return { board: next, move: { from, to, count } };
}

/** Reverse a pour, moving the segments back where they came from. */
export function undoMove(board: Board, move: Move): Board {
  const next = cloneBoard(board);
  const returning = next[move.to].splice(next[move.to].length - move.count, move.count);
  next[move.from].push(...returning);
  return next;
}

/** The level is won once every tube is empty or a completed single-color stack. */
export function isSolved(board: Board): boolean {
  return board.every(isTubeSettled);
}

/** True if any legal pour exists. When this is false the player must undo or restart. */
export function hasAnyMove(board: Board): boolean {
  for (let from = 0; from < board.length; from++) {
    if (isTubeSettled(board[from])) continue;
    for (let to = 0; to < board.length; to++) {
      if (canPour(board, from, to)) return true;
    }
  }
  return false;
}

/** Every legal pour on the current board. Used by the solver and the hint system. */
export function legalMoves(board: Board): Move[] {
  const moves: Move[] = [];
  for (let from = 0; from < board.length; from++) {
    // A finished stack should never be broken apart, and an empty tube has
    // nothing to give.
    if (isTubeSettled(board[from])) continue;
    for (let to = 0; to < board.length; to++) {
      const count = pourAmount(board, from, to);
      if (count > 0) moves.push({ from, to, count });
    }
  }
  return moves;
}

/**
 * Canonical string key for a board.
 *
 * Tubes are interchangeable - a board is the same puzzle no matter which slot
 * each stack sits in - so we sort the encoded tubes before joining. This
 * collapses a factorial number of equivalent states into one and is the single
 * biggest reason the solver finishes in milliseconds.
 */
export function boardKey(board: Board): string {
  return board
    .map((tube) => tube.join(','))
    .sort()
    .join('|');
}

/** Add an empty tube to the board (the "+1 tube" power-up). */
export function addEmptyTube(board: Board): Board {
  return [...cloneBoard(board), []];
}

/** Count of tubes the player has finished. Drives the progress read-out. */
export function completedCount(board: Board): number {
  return board.filter(isTubeComplete).length;
}
