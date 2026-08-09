/**
 * Haptics, gated on the player's setting.
 *
 * Every call is fire-and-forget and swallows errors - haptics are unavailable
 * on some devices and emulators, and a missing vibration motor must never
 * interrupt gameplay.
 */

import * as Haptics from 'expo-haptics';
import { getSettings } from '../state/useSettingsStore';

function enabled(): boolean {
  return getSettings().hapticsEnabled;
}

/** Picking up a tube: the lightest possible tick. */
export function hapticSelect(): void {
  if (!enabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Liquid landing: a bit more body than a select. */
export function hapticPour(): void {
  if (!enabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** A tube just filled - the reward beat. */
export function hapticComplete(): void {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Rejected tap. Distinct from the others so it reads as "no" without a sound. */
export function hapticInvalid(): void {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** Level cleared. */
export function hapticWin(): void {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Generic button press. */
export function hapticTap(): void {
  if (!enabled()) return;
  Haptics.selectionAsync().catch(() => {});
}
