/**
 * The gameplay screen.
 *
 * Keeps itself thin: the board owns the pour choreography, the store owns the
 * rules, and this screen wires them to the chrome, the power-ups, and the win
 * flow.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameButton } from '../src/components/GameButton';
import { GlassPanel } from '../src/components/GlassPanel';
import { GradientBackground } from '../src/components/GradientBackground';
import { LevelCompleteModal } from '../src/components/LevelCompleteModal';
import { TubeBoard } from '../src/components/TubeBoard';
import { hapticInvalid, hapticWin } from '../src/feedback/haptics';
import { playSound } from '../src/feedback/sounds';
import { getDifficulty } from '../src/game/difficulty';
import { completedCount, hasAnyMove } from '../src/game/engine';
import { useGameStore } from '../src/state/useGameStore';
import { useProgressStore } from '../src/state/useProgressStore';
import { UI } from '../src/theme/colors';
import { computeLayout } from '../src/theme/layout';

/** Vertical space taken by the header and power-up bar, excluding safe areas. */
const CHROME_HEIGHT = 210;

/** Progress toward finishing the level, shown as a filling bar in the header. */
function ProgressBar({ done, total }: { done: number; total: number }) {
  const fill = useSharedValue(0);
  const target = total > 0 ? done / total : 0;

  useEffect(() => {
    fill.value = withSpring(target, { damping: 16, stiffness: 130 });
  }, [target, fill]);

  const style = useAnimatedStyle(() => ({ width: `${Math.min(100, fill.value * 100)}%` }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, style]} />
    </View>
  );
}

export default function GameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ level?: string }>();

  const requestedLevel = Math.max(1, Number(params.level) || 1);

  const status = useGameStore((s) => s.status);
  const level = useGameStore((s) => s.level);
  const board = useGameStore((s) => s.board);
  const moves = useGameStore((s) => s.moves);
  const history = useGameStore((s) => s.history);
  const extraTubes = useGameStore((s) => s.extraTubes);
  const pending = useGameStore((s) => s.pending);
  const levelData = useGameStore((s) => s.levelData);
  const loadLevel = useGameStore((s) => s.loadLevel);
  const undo = useGameStore((s) => s.undo);
  const restart = useGameStore((s) => s.restart);
  const addTube = useGameStore((s) => s.addTube);
  const requestHint = useGameStore((s) => s.requestHint);
  const starsEarned = useGameStore((s) => s.starsEarned);

  const completeLevel = useProgressStore((s) => s.completeLevel);
  const setCurrentLevel = useProgressStore((s) => s.setCurrentLevel);

  const [showWin, setShowWin] = useState(false);
  const [awardedStars, setAwardedStars] = useState<1 | 2 | 3>(1);

  /** Board entrance: the tubes drop in together when a level loads. */
  const entrance = useSharedValue(0);

  // Load whenever the requested level changes, including on first mount.
  useEffect(() => {
    loadLevel(requestedLevel);
    setShowWin(false);

    entrance.value = 0;
    entrance.value = withDelay(60, withTiming(1, { duration: 520, easing: Easing.out(Easing.back(1.4)) }));
    playSound('levelStart');
  }, [requestedLevel, loadLevel, entrance]);

  const boardStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [
      { translateY: (1 - entrance.value) * -40 },
      { scale: 0.92 + entrance.value * 0.08 },
    ],
  }));

  // Record the win once, then reveal the celebration after the final pour has
  // finished playing.
  useEffect(() => {
    if (status !== 'won') return;

    const stars = starsEarned();
    setAwardedStars(stars);
    completeLevel(level, stars, moves);

    playSound('win');
    hapticWin();

    const timer = setTimeout(() => setShowWin(true), 760);
    return () => clearTimeout(timer);
  }, [status, level, moves, starsEarned, completeLevel]);

  const layout = useMemo(() => {
    const available = height - insets.top - insets.bottom - CHROME_HEIGHT;
    return computeLayout(width, Math.max(220, available), board.length || 1);
  }, [width, height, insets.top, insets.bottom, board.length]);

  const canAddTube = extraTubes < getDifficulty(level).maxExtraTubes && status === 'playing';
  const canUndo = history.length > 0 && status === 'playing' && !pending;

  const solvedTubes = completedCount(board);
  const totalColors = levelData?.colors ?? 0;

  // A board with liquid left but no legal pour is a dead end, so say so rather
  // than leaving the player tapping at nothing.
  const stuck = status === 'playing' && !pending && board.length > 0 && !hasAnyMove(board);

  const handleUndo = useCallback(() => {
    if (!undo()) hapticInvalid();
  }, [undo]);

  const handleAddTube = useCallback(() => {
    if (!addTube()) hapticInvalid();
  }, [addTube]);

  const handleHint = useCallback(() => {
    if (!requestHint()) hapticInvalid();
  }, [requestHint]);

  const handleNext = useCallback(() => {
    const next = level + 1;
    setShowWin(false);
    setCurrentLevel(next);
    router.setParams({ level: String(next) });
  }, [level, router, setCurrentLevel]);

  const handleReplay = useCallback(() => {
    setShowWin(false);
    restart();
  }, [restart]);

  const handleHome = useCallback(() => {
    setShowWin(false);
    router.replace('/');
  }, [router]);

  return (
    <GradientBackground>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <GlassPanel style={styles.header} radius={22}>
          <View style={styles.headerRow}>
            <GameButton label="" icon="‹" onPress={handleHome} variant="ghost" size="small" style={styles.backButton} />

            <View style={styles.headerCenter}>
              <Text style={styles.levelLabel}>LEVEL</Text>
              <Text style={styles.levelValue}>{level}</Text>
            </View>

            <View style={styles.movesBox}>
              <Text style={styles.movesValue}>{moves}</Text>
              <Text style={styles.movesLabel}>MOVES</Text>
            </View>
          </View>

          <View style={styles.progressRow}>
            <ProgressBar done={solvedTubes} total={totalColors} />
            <Text style={styles.progressText}>
              {solvedTubes}/{totalColors}
            </Text>
          </View>
        </GlassPanel>

        <View style={styles.boardArea}>
          {status === 'loading' ? (
            <Text style={styles.loading}>Mixing colors…</Text>
          ) : (
            <Animated.View style={boardStyle}>
              <TubeBoard layout={layout} />
            </Animated.View>
          )}
        </View>

        {stuck && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.stuckBanner}>
            <Text style={styles.stuckText}>No moves left — undo or restart</Text>
          </Animated.View>
        )}

        <GlassPanel style={styles.powerBar} radius={24}>
          <GameButton label="Undo" icon="↺" onPress={handleUndo} size="small" disabled={!canUndo} />
          <GameButton label="Hint" icon="✦" onPress={handleHint} size="small" disabled={status !== 'playing'} />
          <GameButton
            label="Add Tube"
            icon="⊕"
            onPress={handleAddTube}
            size="small"
            disabled={!canAddTube}
            badge={canAddTube ? '1' : undefined}
          />
          <GameButton label="Restart" icon="⟳" onPress={restart} size="small" disabled={status !== 'playing'} />
        </GlassPanel>
      </View>

      <LevelCompleteModal
        visible={showWin}
        level={level}
        moves={moves}
        stars={awardedStars}
        bestPossible={levelData?.solutionMoves ?? moves}
        onNext={handleNext}
        onReplay={handleReplay}
        onHome={handleHome}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 14,
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
  },
  backButton: {
    width: 44,
  },
  headerCenter: {
    alignItems: 'center',
  },
  levelLabel: {
    color: UI.textFaint,
    fontSize: 9.5,
    letterSpacing: 3,
    fontWeight: '800',
  },
  levelValue: {
    color: UI.text,
    fontSize: 27,
    fontWeight: '900',
    marginTop: -3,
    textShadowColor: 'rgba(79,195,247,0.5)',
    textShadowRadius: 12,
  },
  movesBox: {
    alignItems: 'center',
    minWidth: 52,
  },
  movesValue: {
    color: UI.accent,
    fontSize: 21,
    fontWeight: '900',
  },
  movesLabel: {
    color: UI.textFaint,
    fontSize: 8.5,
    letterSpacing: 1.6,
    fontWeight: '800',
    marginTop: -1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: UI.success,
    shadowColor: UI.success,
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  progressText: {
    color: UI.textDim,
    fontSize: 11,
    fontWeight: '800',
    minWidth: 34,
    textAlign: 'right',
  },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    color: UI.textDim,
    fontSize: 15,
    fontWeight: '600',
  },
  stuckBanner: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 90, 126, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 126, 0.45)',
    marginBottom: 10,
  },
  stuckText: {
    color: UI.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  powerBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
  },
});
