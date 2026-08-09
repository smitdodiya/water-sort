/**
 * End-to-end tests for the store the UI actually drives.
 *
 * These play real generated levels to completion through the same calls the
 * screen makes - tapTube, commitPour, undo, addTube - so the two-phase pour
 * flow and the win transition are covered without needing a device.
 */

import { isSolved, topColor, topRunLength } from '../src/game/engine';
import { useGameStore } from '../src/state/useGameStore';
import { Move } from '../src/game/types';

const store = () => useGameStore.getState();

/** Perform one pour the way the UI does: tap source, tap target, commit. */
function playMove(move: Move): void {
  const source = store().selected;
  if (source !== move.from) {
    // Clear any stale selection before picking the intended source.
    if (source !== null) store().tapTube(source);
    expect(store().tapTube(move.from)).toBe('select');
  }
  expect(store().tapTube(move.to)).toBe('pour');
  expect(store().pending).not.toBeNull();
  store().commitPour();
  expect(store().pending).toBeNull();
}

describe('game store', () => {
  beforeEach(() => {
    useGameStore.setState({
      status: 'loading',
      level: 1,
      board: [],
      levelData: null,
      selected: null,
      history: [],
      moves: 0,
      extraTubes: 0,
      pending: null,
      hint: null,
      justCompleted: [],
    });
  });

  it('loads a level into a playable state', () => {
    store().loadLevel(7);
    const state = store();
    expect(state.status).toBe('playing');
    expect(state.level).toBe(7);
    expect(state.board.length).toBeGreaterThan(0);
    expect(state.moves).toBe(0);
    expect(state.selected).toBeNull();
    expect(state.levelData?.solution.length).toBeGreaterThan(0);
  });

  describe.each([1, 3, 12, 26, 55, 90])('playing level %i to completion', (levelNumber) => {
    it('reaches a won state by following the stored solution', () => {
      store().loadLevel(levelNumber);
      const solution = store().levelData!.solution;

      for (const move of solution) {
        playMove(move);
      }

      const state = store();
      expect(isSolved(state.board)).toBe(true);
      expect(state.status).toBe('won');
      expect(state.moves).toBe(solution.length);
      expect([1, 2, 3]).toContain(state.starsEarned());
    });
  });

  it('locks out input while a pour is in flight', () => {
    store().loadLevel(4);
    const move = store().levelData!.solution[0];

    store().tapTube(move.from);
    store().tapTube(move.to);
    expect(store().pending).not.toBeNull();

    // Every tap must be refused until the animation commits.
    expect(store().tapTube(0)).toBe('ignored');
    expect(store().tapTube(1)).toBe('ignored');
    expect(store().undo()).toBe(false);

    store().commitPour();
    expect(store().pending).toBeNull();
  });

  it('selects, deselects, and switches selection', () => {
    store().loadLevel(9);
    expect(store().tapTube(0)).toBe('select');
    expect(store().selected).toBe(0);

    expect(store().tapTube(0)).toBe('deselect');
    expect(store().selected).toBeNull();

    store().tapTube(0);
    // Tapping another pourable tube switches rather than erroring, unless the
    // move is legal - in which case it pours.
    const outcome = store().tapTube(1);
    expect(['select', 'pour']).toContain(outcome);
  });

  it('undo restores the previous board exactly', () => {
    store().loadLevel(15);
    const before = JSON.stringify(store().board);

    playMove(store().levelData!.solution[0]);
    expect(JSON.stringify(store().board)).not.toBe(before);

    expect(store().undo()).toBe(true);
    expect(JSON.stringify(store().board)).toBe(before);
    expect(store().history).toHaveLength(0);
  });

  it('counts undo as a move so it stays a real decision', () => {
    store().loadLevel(15);
    playMove(store().levelData!.solution[0]);
    expect(store().moves).toBe(1);
    store().undo();
    expect(store().moves).toBe(2);
  });

  it('refuses to undo with empty history', () => {
    store().loadLevel(5);
    expect(store().undo()).toBe(false);
    expect(store().moves).toBe(0);
  });

  it('restart returns the board to the generated state', () => {
    store().loadLevel(20);
    const original = JSON.stringify(store().levelData!.board);

    playMove(store().levelData!.solution[0]);
    playMove(store().levelData!.solution[1]);
    store().restart();

    expect(JSON.stringify(store().board)).toBe(original);
    expect(store().moves).toBe(0);
    expect(store().history).toHaveLength(0);
    expect(store().status).toBe('playing');
  });

  it('grants exactly one extra tube per level', () => {
    store().loadLevel(30);
    const before = store().board.length;

    expect(store().addTube()).toBe(true);
    expect(store().board).toHaveLength(before + 1);
    expect(store().board[before]).toEqual([]);

    // The power-up is capped, so a second request is refused.
    expect(store().addTube()).toBe(false);
    expect(store().board).toHaveLength(before + 1);
  });

  it('reports the tubes that just completed', () => {
    store().loadLevel(2);
    const solution = store().levelData!.solution;

    let sawCompletion = false;
    for (const move of solution) {
      playMove(move);
      if (store().justCompleted.length > 0) sawCompletion = true;
      store().clearJustCompleted();
    }

    expect(sawCompletion).toBe(true);
  });

  it('offers a hint that is legal on the current board', () => {
    store().loadLevel(18);
    const hint = store().requestHint();

    expect(hint).not.toBeNull();
    expect(store().hint).toEqual(hint);

    const board = store().board;
    expect(topRunLength(board[hint!.from])).toBeGreaterThan(0);
    const destinationTop = topColor(board[hint!.to]);
    if (destinationTop !== null) {
      expect(destinationTop).toBe(topColor(board[hint!.from]));
    }
  });

  it('clears the hint on the next tap', () => {
    store().loadLevel(18);
    store().requestHint();
    expect(store().hint).not.toBeNull();

    store().tapTube(0);
    expect(store().hint).toBeNull();
  });

  it('ignores taps once the level is won', () => {
    store().loadLevel(1);
    for (const move of store().levelData!.solution) playMove(move);

    expect(store().status).toBe('won');
    expect(store().tapTube(0)).toBe('ignored');
    expect(store().undo()).toBe(false);
    expect(store().addTube()).toBe(false);
  });

  it('awards three stars for following the reference solution exactly', () => {
    store().loadLevel(11);
    for (const move of store().levelData!.solution) playMove(move);
    expect(store().starsEarned()).toBe(3);
  });
});
