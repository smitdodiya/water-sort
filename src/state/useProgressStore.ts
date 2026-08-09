/**
 * Long-lived progress: how far the player has got and how well they did.
 * Persisted across launches.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

interface ProgressState {
  /** Highest level unlocked. The player may replay anything at or below this. */
  unlockedLevel: number;
  /** The level the Continue button resumes. */
  currentLevel: number;
  /** Best star rating per level, keyed by level number. */
  stars: Record<number, 1 | 2 | 3>;
  /** Lifetime counters, shown on the home screen. */
  levelsCompleted: number;
  totalMoves: number;

  completeLevel: (level: number, stars: 1 | 2 | 3, moves: number) => void;
  setCurrentLevel: (level: number) => void;
  resetProgress: () => void;
}

const initial = {
  unlockedLevel: 1,
  currentLevel: 1,
  stars: {} as Record<number, 1 | 2 | 3>,
  levelsCompleted: 0,
  totalMoves: 0,
};

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      ...initial,

      completeLevel: (level, stars, moves) =>
        set((state) => {
          const previousBest = state.stars[level];
          // Replaying a level can improve a rating but never lower it.
          const bestStars = previousBest === undefined || stars > previousBest ? stars : previousBest;
          const isFirstClear = previousBest === undefined;

          return {
            stars: { ...state.stars, [level]: bestStars },
            unlockedLevel: Math.max(state.unlockedLevel, level + 1),
            currentLevel: level + 1,
            levelsCompleted: isFirstClear ? state.levelsCompleted + 1 : state.levelsCompleted,
            totalMoves: state.totalMoves + moves,
          };
        }),

      setCurrentLevel: (level) => set({ currentLevel: Math.max(1, level) }),

      resetProgress: () => set({ ...initial, stars: {} }),
    }),
    { name: 'watersort-progress', storage: persistStorage }
  )
);
