/**
 * Player preferences. Persisted, and read by the audio and haptics helpers
 * before they fire.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

interface SettingsState {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  /** Draws a distinct glyph on each liquid so hue is never the only cue. */
  colorblindMode: boolean;
  toggleSound: () => void;
  toggleHaptics: () => void;
  toggleColorblind: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      hapticsEnabled: true,
      colorblindMode: false,
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
      toggleColorblind: () => set((s) => ({ colorblindMode: !s.colorblindMode })),
    }),
    { name: 'watersort-settings', storage: persistStorage }
  )
);

/**
 * Non-reactive read, for the audio/haptics helpers which fire from callbacks
 * and worklet-adjacent code where a hook is not available.
 */
export const getSettings = () => useSettingsStore.getState();
