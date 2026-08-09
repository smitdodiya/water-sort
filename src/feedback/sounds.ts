/**
 * Sound effects.
 *
 * Players are created once at startup and reused, because building a player per
 * tap adds latency exactly where the game needs to feel immediate. Every call
 * is gated on the sound setting and never throws - audio is a nicety, not
 * something worth interrupting a level for.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { getSettings } from '../state/useSettingsStore';

export type SoundName =
  | 'tap'
  | 'select'
  | 'pour'
  | 'drop'
  | 'complete'
  | 'win'
  | 'invalid'
  | 'levelStart';

// Static requires so Metro bundles the assets.
const SOURCES: Record<SoundName, number> = {
  tap: require('../../assets/sounds/tap.wav'),
  select: require('../../assets/sounds/select.wav'),
  pour: require('../../assets/sounds/pour.wav'),
  drop: require('../../assets/sounds/drop.wav'),
  complete: require('../../assets/sounds/complete.wav'),
  win: require('../../assets/sounds/win.wav'),
  invalid: require('../../assets/sounds/invalid.wav'),
  levelStart: require('../../assets/sounds/levelStart.wav'),
};

/**
 * Per-sound mix.
 *
 * Balanced by how often each fires: the pour plays on every single move, so it
 * sits well under the completion and win cues that should still feel like
 * events after an hour of play.
 */
const VOLUME: Record<SoundName, number> = {
  tap: 0.4,
  select: 0.5,
  pour: 0.62,
  drop: 0.45,
  complete: 0.85,
  win: 0.95,
  invalid: 0.5,
  levelStart: 0.5,
};

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let initialised = false;

/**
 * Prepare the audio session and warm every player. Called once from the root
 * layout; safe to call again.
 */
export async function initAudio(): Promise<void> {
  if (initialised) return;
  initialised = true;

  try {
    await setAudioModeAsync({
      // The game is silent-switch friendly and must never take over playback
      // from whatever the player is already listening to.
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    });
  } catch {
    // An unavailable audio session still leaves the game fully playable.
  }

  for (const name of Object.keys(SOURCES) as SoundName[]) {
    try {
      const player = createAudioPlayer(SOURCES[name]);
      player.volume = VOLUME[name];
      players[name] = player;
    } catch {
      // Skip this effect; play() below will simply find nothing to play.
    }
  }
}

/**
 * Play an effect from the start. Rewinding first means rapid repeat taps
 * retrigger the sound instead of being swallowed while it is still playing.
 */
export function playSound(name: SoundName): void {
  if (!getSettings().soundEnabled) return;

  const player = players[name];
  if (!player) return;

  try {
    // seekTo resolves asynchronously; swallow it explicitly so a failed rewind
    // never surfaces as an unhandled rejection.
    Promise.resolve(player.seekTo(0)).catch(() => {});
    player.play();
  } catch {
    // Ignore - a failed effect must not interrupt the game.
  }
}

/** Release every player. For completeness; the app keeps them for its lifetime. */
export function releaseAudio(): void {
  for (const name of Object.keys(players) as SoundName[]) {
    try {
      players[name]?.release();
    } catch {
      // Already released or never created.
    }
    delete players[name];
  }
  initialised = false;
}
