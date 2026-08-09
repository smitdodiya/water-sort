import { getDifficulty, starsForMoves, tubeCountForLevel } from '../src/game/difficulty';
import { applyPour, isSolved, isTubeSettled } from '../src/game/engine';
import { generateLevel } from '../src/game/generator';
import { createRng, shuffle } from '../src/game/rng';
import { Board, Color, Move, TUBE_CAPACITY } from '../src/game/types';

function replay(board: Board, moves: Move[]): Board {
  let current = board;
  for (const move of moves) {
    const result = applyPour(current, move.from, move.to);
    if (!result) throw new Error(`illegal move ${JSON.stringify(move)}`);
    current = result.board;
  }
  return current;
}

function colorCounts(board: Board): Map<Color, number> {
  const counts = new Map<Color, number>();
  for (const tube of board) {
    for (const color of tube) counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return counts;
}

describe('seeded rng', () => {
  it('produces the same stream for the same seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('stays inside [0, 1) and int() inside range', () => {
    const rng = createRng(99);
    for (let i = 0; i < 500; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(rng.int(7)).toBeLessThan(7);
    }
  });

  it('shuffle preserves the multiset and leaves the source untouched', () => {
    const source = [1, 1, 2, 2, 3, 3, 4, 4];
    const out = shuffle(source, createRng(7));
    expect(out.slice().sort()).toEqual(source.slice().sort());
    expect(source).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('generateLevel', () => {
  it('is deterministic - the same level number gives the same board', () => {
    expect(generateLevel(42).board).toEqual(generateLevel(42).board);
    expect(generateLevel(42).solution).toEqual(generateLevel(42).solution);
  });

  it('gives different levels different boards', () => {
    expect(generateLevel(10).board).not.toEqual(generateLevel(11).board);
  });

  it('clamps junk input to level 1', () => {
    expect(generateLevel(0).level).toBe(1);
    expect(generateLevel(-5).level).toBe(1);
  });

  /**
   * The critical regression test: sweep a wide span of levels and prove each one
   * is well formed AND actually winnable by replaying the stored solution.
   */
  describe.each([
    ['early', 1, 30],
    ['mid', 31, 100],
    ['late', 101, 160],
    ['deep', 200, 240],
  ])('%s levels %i-%i', (_label, start, end) => {
    const levels = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    it('every board is solvable and its stored solution wins', () => {
      for (const n of levels) {
        const level = generateLevel(n);
        expect(level.solution.length).toBeGreaterThan(0);
        const final = replay(level.board, level.solution);
        if (!isSolved(final)) {
          throw new Error(`level ${n} solution did not solve the board`);
        }
      }
    });

    it('every color appears exactly four times and tube counts match the curve', () => {
      for (const n of levels) {
        const level = generateLevel(n);
        const config = getDifficulty(n);
        const counts = colorCounts(level.board);

        expect(counts.size).toBe(config.colors);
        for (const [color, count] of counts) {
          if (count !== TUBE_CAPACITY) {
            throw new Error(`level ${n} color ${color} appears ${count} times, expected ${TUBE_CAPACITY}`);
          }
        }

        expect(level.board).toHaveLength(tubeCountForLevel(n));
        expect(level.board.filter((t) => t.length === 0)).toHaveLength(config.emptyTubes);
        expect(level.board.every((t) => t.length <= TUBE_CAPACITY)).toBe(true);
      }
    });

    it('no level starts partly solved', () => {
      for (const n of levels) {
        const level = generateLevel(n);
        const settled = level.board.filter((t) => t.length > 0 && isTubeSettled(t));
        if (settled.length > 0) {
          throw new Error(`level ${n} starts with ${settled.length} already-finished tube(s)`);
        }
      }
    });

    it('solution length sits inside the difficulty band', () => {
      const outliers: string[] = [];
      for (const n of levels) {
        const level = generateLevel(n);
        const config = getDifficulty(n);
        if (level.solutionMoves < config.minMoves || level.solutionMoves > config.maxMoves) {
          outliers.push(`level ${n}: ${level.solutionMoves} moves, band ${config.minMoves}-${config.maxMoves}`);
        }
      }
      expect(outliers).toEqual([]);
    });
  });

  it('difficulty ramps monotonically in color count', () => {
    let previous = 0;
    for (let n = 1; n <= 300; n++) {
      const { colors } = getDifficulty(n);
      expect(colors).toBeGreaterThanOrEqual(previous);
      previous = colors;
    }
  });

  it('generates a level in reasonable time even at the top of the curve', () => {
    const start = Date.now();
    generateLevel(250);
    expect(Date.now() - start).toBeLessThan(4000);
  });
});

describe('starsForMoves', () => {
  it('awards three stars for a near-reference solve', () => {
    expect(starsForMoves(20, 20)).toBe(3);
    expect(starsForMoves(22, 20)).toBe(3);
  });

  it('awards two stars for a loose solve', () => {
    expect(starsForMoves(30, 20)).toBe(2);
  });

  it('awards one star for finishing the long way round', () => {
    expect(starsForMoves(60, 20)).toBe(1);
  });
});
