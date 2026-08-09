import { applyPour, isSolved } from '../src/game/engine';
import { findHint, isStillSolvable, solve } from '../src/game/solver';
import { Board, Move } from '../src/game/types';

/** Replay a solution and assert it genuinely reaches a solved board. */
function replay(board: Board, moves: Move[]): Board {
  let current = board;
  for (const move of moves) {
    const result = applyPour(current, move.from, move.to);
    if (!result) throw new Error(`illegal move in solution: ${JSON.stringify(move)}`);
    expect(result.move.count).toBe(move.count);
    current = result.board;
  }
  return current;
}

describe('solve', () => {
  it('reports an already-solved board with no moves', () => {
    const result = solve([[0, 0, 0, 0], [1, 1, 1, 1], []]);
    expect(result.solved).toBe(true);
    expect(result.moves).toHaveLength(0);
  });

  it('solves a simple two-color board and the solution replays cleanly', () => {
    const board: Board = [
      [0, 1, 0, 1],
      [1, 0, 1, 0],
      [],
      [],
    ];
    const result = solve(board);
    expect(result.solved).toBe(true);
    expect(isSolved(replay(board, result.moves))).toBe(true);
  });

  it('solves a harder six-color board', () => {
    const board: Board = [
      [0, 1, 2, 3],
      [4, 5, 0, 1],
      [2, 3, 4, 5],
      [0, 1, 2, 3],
      [4, 5, 0, 1],
      [2, 3, 4, 5],
      [],
      [],
    ];
    const result = solve(board);
    expect(result.solved).toBe(true);
    expect(isSolved(replay(board, result.moves))).toBe(true);
  });

  it('proves an unsolvable board unsolvable rather than hitting the cap', () => {
    // Two full tubes, interleaved, with no spare space anywhere: nothing can move.
    const board: Board = [
      [0, 1, 0, 1],
      [1, 0, 1, 0],
    ];
    const result = solve(board);
    expect(result.solved).toBe(false);
    expect(result.hitCap).toBe(false);
  });

  it('respects the node cap instead of running away', () => {
    const board: Board = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [3, 2, 1, 0],
      [7, 6, 5, 4],
      [0, 2, 4, 6],
      [1, 3, 5, 7],
      [6, 4, 2, 0],
      [7, 5, 3, 1],
      [],
    ];
    const result = solve(board, { nodeCap: 50 });
    expect(result.nodes).toBeLessThanOrEqual(50);
  });

  it('never returns moves when it reports failure', () => {
    const board: Board = [
      [0, 1, 0, 1],
      [1, 0, 1, 0],
    ];
    expect(solve(board).moves).toHaveLength(0);
  });
});

describe('findHint', () => {
  it('returns a legal move that makes progress', () => {
    const board: Board = [
      [0, 1, 0, 1],
      [1, 0, 1, 0],
      [],
      [],
    ];
    const hint = findHint(board)!;
    expect(hint).not.toBeNull();
    const applied = applyPour(board, hint.from, hint.to);
    expect(applied).not.toBeNull();
  });

  it('returns null on a solved board', () => {
    expect(findHint([[0, 0, 0, 0], []])).toBeNull();
  });

  it('returns null when nothing is legal', () => {
    expect(findHint([[0, 1, 0, 1], [1, 0, 1, 0]])).toBeNull();
  });

  it('takes an immediate winning move when one exists', () => {
    // Both consolidating pours win in a single move, so assert the outcome
    // rather than pinning which of the two equally-good moves is chosen.
    const board: Board = [
      [0, 0, 0],
      [0],
      [1, 1, 1, 1],
    ];
    const hint = findHint(board)!;
    const applied = applyPour(board, hint.from, hint.to)!;
    expect(applied).not.toBeNull();
    expect(isSolved(applied.board)).toBe(true);
  });
});

describe('isStillSolvable', () => {
  it('is true for a live board', () => {
    expect(isStillSolvable([[0, 1, 0, 1], [1, 0, 1, 0], [], []])).toBe(true);
  });

  it('is false once the player has locked the board', () => {
    expect(isStillSolvable([[0, 1, 0, 1], [1, 0, 1, 0]])).toBe(false);
  });

  it('is true for an already solved board', () => {
    expect(isStillSolvable([[0, 0, 0, 0], []])).toBe(true);
  });
});
