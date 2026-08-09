/**
 * Level select. Everything up to the highest unlocked level is replayable, so
 * a player chasing three stars can go back for them.
 */

import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameButton } from '../src/components/GameButton';
import { GlassPanel } from '../src/components/GlassPanel';
import { GradientBackground } from '../src/components/GradientBackground';
import { hapticTap } from '../src/feedback/haptics';
import { playSound } from '../src/feedback/sounds';
import { getDifficulty } from '../src/game/difficulty';
import { useProgressStore } from '../src/state/useProgressStore';
import { LIQUIDS, UI } from '../src/theme/colors';

/** How many levels to show beyond the furthest the player has reached. */
const LOOKAHEAD = 24;

export default function LevelsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const unlockedLevel = useProgressStore((s) => s.unlockedLevel);
  const stars = useProgressStore((s) => s.stars);
  const setCurrentLevel = useProgressStore((s) => s.setCurrentLevel);

  const levels = useMemo(
    () => Array.from({ length: unlockedLevel + LOOKAHEAD }, (_, i) => i + 1),
    [unlockedLevel]
  );

  const open = (level: number) => {
    playSound('tap');
    hapticTap();
    setCurrentLevel(level);
    router.push({ pathname: '/game', params: { level: String(level) } });
  };

  return (
    <GradientBackground>
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <GlassPanel style={styles.header} radius={20}>
          <GameButton label="" icon="‹" onPress={() => router.back()} variant="ghost" size="small" style={styles.back} />
          <Text style={styles.title}>Levels</Text>
          <View style={styles.back} />
        </GlassPanel>

        <ScrollView
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 30 }]}
          showsVerticalScrollIndicator={false}
        >
          {levels.map((level) => {
            const locked = level > unlockedLevel;
            const earned = stars[level];
            // Tint each tile with the palette color the level introduces, so the
            // grid shows the difficulty ramp at a glance.
            const tint = LIQUIDS[(getDifficulty(level).colors - 1) % LIQUIDS.length].solid;

            return (
              <Pressable
                key={level}
                onPress={() => !locked && open(level)}
                disabled={locked}
                style={({ pressed }) => [
                  styles.tile,
                  locked ? styles.tileLocked : { borderColor: `${tint}66` },
                  pressed && !locked && styles.tilePressed,
                ]}
              >
                <Text style={[styles.tileNumber, locked && styles.tileNumberLocked]}>
                  {locked ? '🔒' : level}
                </Text>

                {!locked && (
                  <Text style={styles.tileStars}>
                    {earned ? '★'.repeat(earned) + '☆'.repeat(3 - earned) : '☆☆☆'}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  back: {
    width: 46,
  },
  title: {
    color: UI.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  tile: {
    width: 68,
    height: 68,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: UI.panelBorder,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    // Slight lift so the grid reads as a set of physical tiles.
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tileLocked: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tilePressed: {
    backgroundColor: UI.buttonFaceActive,
    transform: [{ scale: 0.95 }],
  },
  tileNumber: {
    color: UI.text,
    fontSize: 19,
    fontWeight: '800',
  },
  tileNumberLocked: {
    fontSize: 16,
    opacity: 0.5,
  },
  tileStars: {
    color: UI.warning,
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 1,
  },
});
