/**
 * Live game state for the level being played.
 *
 * Pours are two-phase on purpose. `beginPour` records the move without touching
 * the board so the UI can play the tilt-and-stream animation against the state
 * the player can still see; `commitPour` applies it when the liquid lands. The
 * board is therefore never out of sync with what is on screen mid-animation.
 */

import { create } from 'zustand';
import {
  addEmptyTube,
  applyPour,
  canPour,
  cloneBoard,
  isSolved,
  isTubeSettled,
  undoMove,
} from '../game/engine';
import { generateLevel } from '../game/generator';
import { getDifficulty, starsForMoves } from '../game/difficulty';
import { findHint } from '../game/solver';
import { Board, Level, Move } from '../game/types';

export type GameStatus = 'loading' | 'playing' | 'won';

interface GameState {
  status: GameStatus;
  level: number;
  board: Board;
  /** The generated level, kept for the star thresholds and the reference solution. */
  levelData: Level | null;
  selected: number | null;
  history: Move[];
  moves: number;
  extraTubes: number;
  /** The pour currently being animated. Input is locked while this is set. */
  pending: Move | null;
  /** Move the hint button is pointing at, cleared on the next tap. */
  hint: Move | null;
  /** Tube indices that finished on the last commit, so the UI can celebrate them. */
  justCompleted: number[];

  loadLevel: (level: number) => void;
  /** Handle a tap. Returns what happened so the UI can pick sound and haptics. */
  tapTube: (index: number) => 'select' | 'deselect' | 'pour' | 'invalid' | 'ignored';
  commitPour: () => void;
  undo: () => boolean;
  restart: () => void;
  addTube: () => boolean;
  requestHint: () => Move | null;
  clearHint: () => void;
  clearJustCompleted: () => void;
  starsEarned: () => 1 | 2 | 3;
}

/** Tubes that finished in `next` but had not in `previous`. */
function newlyCompleted(previous: Board, next: Board): number[] {
  const completed: number[] = [];
  for (let i = 0; i < next.length; i++) {
    const wasComplete = previous[i] !== undefined && previous[i].length === 4 && isTubeSettled(previous[i]);
    const isComplete = next[i].length === 4 && isTubeSettled(next[i]);
    if (isComplete && !wasComplete) completed.push(i);
  }
  return completed;
}

export const useGameStore = create<GameState>()((set, get) => ({
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

  loadLevel: (level) => {
    const data = generateLevel(level);
    set({
      status: 'playing',
      level: data.level,
      levelData: data,
      board: cloneBoard(data.board),
      selected: null,
      history: [],
      moves: 0,
      extraTubes: 0,
      pending: null,
      hint: null,
      justCompleted: [],
    });
  },

  tapTube: (index) => {
    const { board, selected, pending, status } = get();

    // Ignore input while a pour is in flight or the level is already won.
    if (pending || status !== 'playing') return 'ignored';
    if (index < 0 || index >= board.length) return 'ignored';

    set({ hint: null });

    if (selected === null) {
      // An empty or already-finished tube has nothing worth picking up.
      if (isTubeSettled(board[index])) return 'ignored';
      set({ selected: index });
      return 'select';
    }

    if (selected === index) {
      set({ selected: null });
      return 'deselect';
    }

    if (canPour(board, selected, index)) {
      // Board is untouched here; commitPour applies it once the pour lands.
      set({ pending: { from: selected, to: index, count: 0 }, selected: null });
      return 'pour';
    }

    // Tapping another pourable tube switches selection rather than erroring,
    // which is what players expect when they change their mind.
    if (!isTubeSettled(board[index])) {
      set({ selected: index });
      return 'select';
    }

    return 'invalid';
  },

  commitPour: () => {
    const { board, pending, history, moves, levelData } = get();
    if (!pending) return;

    const result = applyPour(board, pending.from, pending.to);
    if (!result) {
      // The pour stopped being legal, which should not happen while input is
      // locked. Drop it rather than corrupting the board.
      set({ pending: null });
      return;
    }

    const completed = newlyCompleted(board, result.board);
    const won = isSolved(result.board);

    set({
      board: result.board,
      history: [...history, result.move],
      moves: moves + 1,
      pending: null,
      justCompleted: completed,
      status: won ? 'won' : 'playing',
    });

    void levelData;
  },

  undo: () => {
    const { board, history, moves, pending, status } = get();
    if (pending || history.length === 0 || status === 'won') return false;

    const last = history[history.length - 1];
    set({
      board: undoMove(board, last),
      history: history.slice(0, -1),
      // Undo costs a move so it stays a real decision rather than a free
      // brute-force tool, but it never blocks progress.
      moves: moves + 1,
      selected: null,
      hint: null,
      justCompleted: [],
    });
    return true;
  },

  restart: () => {
    const { levelData } = get();
    if (!levelData) return;
    set({
      board: cloneBoard(levelData.board),
      selected: null,
      history: [],
      moves: 0,
      extraTubes: 0,
      pending: null,
      hint: null,
      justCompleted: [],
      status: 'playing',
    });
  },

  addTube: () => {
    const { board, extraTubes, level, pending, status } = get();
    if (pending || status !== 'playing') return false;
    if (extraTubes >= getDifficulty(level).maxExtraTubes) return false;

    set({ board: addEmptyTube(board), extraTubes: extraTubes + 1, selected: null, hint: null });
    return true;
  },

  requestHint: () => {
    const { board, pending, status } = get();
    if (pending || status !== 'playing') return null;

    const move = findHint(board);
    set({ hint: move, selected: null });
    return move;
  },

  clearHint: () => set({ hint: null }),

  clearJustCompleted: () => set({ justCompleted: [] }),

  starsEarned: () => {
    const { moves, levelData } = get();
    if (!levelData) return 1;
    return starsForMoves(moves, levelData.solutionMoves);
  },
}));
