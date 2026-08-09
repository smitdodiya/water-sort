import {
  addEmptyTube,
  applyPour,
  boardKey,
  canPour,
  completedCount,
  freeSpace,
  hasAnyMove,
  isSolved,
  isTubeComplete,
  legalMoves,
  pourAmount,
  topColor,
  topRunLength,
  undoMove,
} from '../src/game/engine';
import { Board } from '../src/game/types';

describe('tube inspection', () => {
  it('reads the surface color, treating the last element as the top', () => {
    expect(topColor([0, 0, 1])).toBe(1);
    expect(topColor([])).toBeNull();
  });

  it('measures the contiguous run at the top only', () => {
    expect(topRunLength([1, 0, 0, 0])).toBe(3);
    expect(topRunLength([0, 0, 0, 1])).toBe(1);
    expect(topRunLength([2, 2, 2, 2])).toBe(4);
    expect(topRunLength([])).toBe(0);
  });

  it('reports free space and completion', () => {
    expect(freeSpace([])).toBe(4);
    expect(freeSpace([1, 1])).toBe(2);
    expect(isTubeComplete([1, 1, 1, 1])).toBe(true);
    expect(isTubeComplete([1, 1, 1])).toBe(false);
    expect(isTubeComplete([1, 1, 1, 2])).toBe(false);
  });
});

describe('canPour', () => {
  it('rejects pouring a tube into itself', () => {
    expect(canPour([[0, 1], [2]], 0, 0)).toBe(false);
  });

  it('rejects pouring from an empty tube', () => {
    expect(canPour([[], [1]], 0, 1)).toBe(false);
  });

  it('rejects pouring into a full tube', () => {
    expect(canPour([[1], [1, 1, 1, 1]], 0, 1)).toBe(false);
  });

  it('rejects a color mismatch', () => {
    expect(canPour([[0], [1]], 0, 1)).toBe(false);
  });

  it('allows a matching surface color with room', () => {
    expect(canPour([[0], [0, 0]], 0, 1)).toBe(true);
  });

  it('allows pouring into an empty tube', () => {
    expect(canPour([[1, 0], []], 0, 1)).toBe(true);
  });

  it('refuses to move a whole uniform stack into an empty tube, which never progresses', () => {
    expect(canPour([[2, 2], []], 0, 1)).toBe(false);
    expect(canPour([[2, 2, 2, 2], []], 0, 1)).toBe(false);
  });
});

describe('applyPour', () => {
  it('moves the whole top run when there is room', () => {
    const board: Board = [
      [1, 0, 0],
      [0],
    ];
    const result = applyPour(board, 0, 1)!;
    expect(result.board[0]).toEqual([1]);
    expect(result.board[1]).toEqual([0, 0, 0]);
    expect(result.move).toEqual({ from: 0, to: 1, count: 2 });
  });

  it('moves only as much as fits, leaving the remainder behind', () => {
    const board: Board = [
      [0, 0, 0],
      [0, 0, 0],
    ];
    const result = applyPour(board, 0, 1)!;
    expect(result.move.count).toBe(1);
    expect(result.board[0]).toEqual([0, 0]);
    expect(result.board[1]).toEqual([0, 0, 0, 0]);
  });

  it('returns null for an illegal pour', () => {
    expect(applyPour([[0], [1]], 0, 1)).toBeNull();
  });

  it('does not mutate the input board', () => {
    const board: Board = [[1, 0], [0]];
    const snapshot = JSON.stringify(board);
    applyPour(board, 0, 1);
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it('reports pourAmount consistently with the applied move', () => {
    const board: Board = [[3, 3, 3], [3, 3]];
    expect(pourAmount(board, 0, 1)).toBe(2);
    expect(applyPour(board, 0, 1)!.move.count).toBe(2);
  });
});

describe('undoMove', () => {
  it('restores the exact prior board', () => {
    const board: Board = [
      [1, 0, 0],
      [0],
      [],
    ];
    const before = JSON.stringify(board);
    const { board: after, move } = applyPour(board, 0, 1)!;
    expect(JSON.stringify(undoMove(after, move))).toBe(before);
  });

  it('round-trips a partial pour', () => {
    const board: Board = [[0, 0, 0], [0, 0, 0]];
    const before = JSON.stringify(board);
    const { board: after, move } = applyPour(board, 0, 1)!;
    expect(JSON.stringify(undoMove(after, move))).toBe(before);
  });
});

describe('win detection', () => {
  it('accepts a board of completed and empty tubes', () => {
    expect(isSolved([[0, 0, 0, 0], [1, 1, 1, 1], []])).toBe(true);
  });

  it('rejects a board with a mixed tube', () => {
    expect(isSolved([[0, 0, 0, 1], [1, 1, 1, 0]])).toBe(false);
  });

  it('rejects a partially filled single-color tube', () => {
    expect(isSolved([[0, 0, 0], [0], []])).toBe(false);
  });

  it('counts completed tubes', () => {
    expect(completedCount([[0, 0, 0, 0], [1, 1], []])).toBe(1);
  });
});

describe('legalMoves and hasAnyMove', () => {
  it('never suggests breaking up a finished tube', () => {
    const board: Board = [[0, 0, 0, 0], [1, 1], []];
    expect(legalMoves(board).every((m) => m.from !== 0)).toBe(true);
  });

  it('detects a dead board with no legal pour', () => {
    // Every tube is full and none share a surface color.
    const board: Board = [
      [0, 1, 0, 1],
      [1, 0, 1, 0],
    ];
    expect(hasAnyMove(board)).toBe(false);
    expect(legalMoves(board)).toHaveLength(0);
  });

  it('finds moves on a live board', () => {
    expect(hasAnyMove([[0, 1], [1], []])).toBe(true);
  });
});

describe('boardKey', () => {
  it('treats tube order as irrelevant', () => {
    expect(boardKey([[0, 1], [2], []])).toBe(boardKey([[2], [], [0, 1]]));
  });

  it('still distinguishes genuinely different boards', () => {
    expect(boardKey([[0, 1], []])).not.toBe(boardKey([[1, 0], []]));
  });
});

describe('addEmptyTube', () => {
  it('appends an empty tube without touching the others', () => {
    const board: Board = [[0, 1]];
    const next = addEmptyTube(board);
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual([]);
    expect(board).toHaveLength(1);
  });
});
