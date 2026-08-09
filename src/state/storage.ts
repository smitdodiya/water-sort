/**
 * Persistence adapter for zustand.
 *
 * Thin wrapper so every store persists the same way and a storage failure (a
 * full disk, a wiped app sandbox) degrades to an in-memory session rather than
 * crashing the game.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, StateStorage } from 'zustand/middleware';

const safeStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      // Progress is not worth crashing over; the session continues unsaved.
    }
  },
  removeItem: async (name) => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // Same rationale as setItem.
    }
  },
};

export const persistStorage = createJSONStorage(() => safeStorage);
