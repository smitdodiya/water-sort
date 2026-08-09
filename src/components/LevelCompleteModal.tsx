/**
 * Win celebration.
 *
 * Paced rather than shown all at once: the card springs up, a light sweeps
 * across it, then the stars land one at a time with a pop and a flare. The
 * stagger is what turns a result screen into a reward.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { UI } from '../theme/colors';
import { Confetti } from './Confetti';
import { GameButton } from './GameButton';
import { GlassPanel } from './GlassPanel';

interface Props {
  visible: boolean;
  level: number;
  moves: number;
  stars: 1 | 2 | 3;
  /** The reference solution length, shown so the rating feels earned. */
  bestPossible: number;
  onNext: () => void;
  onReplay: () => void;
  onHome: () => void;
}

function Star({ index, earned }: { index: number; earned: boolean }) {
  const scale = useSharedValue(0);
  const spin = useSharedValue(-140);
  const flare = useSharedValue(0);

  useEffect(() => {
    const delay = 320 + index * 210;
    scale.value = withDelay(
      delay,
      withSequence(
        withSpring(1.28, { damping: 7, stiffness: 220 }),
        withSpring(1, { damping: 11, stiffness: 260 })
      )
    );
    spin.value = withDelay(delay, withTiming(0, { duration: 460, easing: Easing.out(Easing.back(2.6)) }));
    if (earned) {
      // A flash behind the star at the moment it lands.
      flare.value = withDelay(
        delay + 60,
        withSequence(withTiming(1, { duration: 130 }), withTiming(0, { duration: 480 }))
      );
    }
  }, [index, earned, scale, spin, flare]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${spin.value}deg` }],
  }));

  const flareStyle = useAnimatedStyle(() => ({
    opacity: flare.value * 0.9,
    transform: [{ scale: 0.5 + flare.value * 1.6 }],
  }));

  return (
    <View style={styles.starSlot}>
      <Animated.View pointerEvents="none" style={[styles.starFlare, flareStyle]} />
      <Animated.Text style={[styles.star, !earned && styles.starEmpty, style]}>
        {earned ? '★' : '☆'}
      </Animated.Text>
    </View>
  );
}

export function LevelCompleteModal({
  visible,
  level,
  moves,
  stars,
  bestPossible,
  onNext,
  onReplay,
  onHome,
}: Props) {
  const cardY = useSharedValue(80);
  const cardOpacity = useSharedValue(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      cardY.value = withDelay(90, withSpring(0, { damping: 15, stiffness: 180 }));
      cardOpacity.value = withDelay(90, withTiming(1, { duration: 280 }));
      // A light sweeping across the card, repeating slowly.
      sweep.value = 0;
      sweep.value = withDelay(
        420,
        withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, false)
      );
    } else {
      cardY.value = 80;
      cardOpacity.value = 0;
      sweep.value = 0;
    }
  }, [visible, cardY, cardOpacity, sweep]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: sweep.value > 0 && sweep.value < 1 ? 0.5 * Math.sin(Math.PI * sweep.value) : 0,
    transform: [{ translateX: -220 + sweep.value * 520 }, { rotate: '18deg' }],
  }));

  const headline = stars === 3 ? 'PERFECT!' : stars === 2 ? 'NICELY DONE!' : 'LEVEL CLEAR!';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onHome}>
      <View style={styles.backdrop}>
        <Confetti active={visible} />

        <Animated.View style={[styles.cardWrap, cardStyle]}>
          <GlassPanel radius={30} elevated tint={stars === 3 ? '#FFC857' : undefined} style={styles.card}>
            {/* Specular sweep, clipped by the panel. */}
            <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]}>
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.subhead}>Level {level}</Text>

            <View style={styles.stars}>
              {[0, 1, 2].map((i) => (
                <Star key={i} index={i} earned={i < stars} />
              ))}
            </View>

            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{moves}</Text>
                <Text style={styles.statLabel}>your moves</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{bestPossible}</Text>
                <Text style={styles.statLabel}>par</Text>
              </View>
            </View>

            <GameButton
              label="NEXT LEVEL"
              onPress={onNext}
              variant="primary"
              size="large"
              style={styles.primaryButton}
            />

            <View style={styles.row}>
              <GameButton label="Replay" icon="⟳" onPress={onReplay} size="small" style={styles.rowButton} />
              <GameButton label="Home" icon="⌂" onPress={onHome} size="small" style={styles.rowButton} />
            </View>
          </GlassPanel>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 20, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 390,
  },
  card: {
    paddingVertical: 30,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  sweep: {
    position: 'absolute',
    top: -60,
    width: 90,
    height: 460,
  },
  headline: {
    color: UI.text,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(127, 224, 255, 0.55)',
    textShadowRadius: 18,
  },
  subhead: {
    color: UI.textDim,
    fontSize: 14,
    marginTop: 5,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  stars: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 6,
    gap: 6,
  },
  starSlot: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starFlare: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFD98A',
    shadowColor: '#FFC857',
    shadowOpacity: 1,
    shadowRadius: 24,
  },
  star: {
    fontSize: 47,
    color: UI.warning,
    textShadowColor: 'rgba(255, 200, 87, 0.8)',
    textShadowRadius: 16,
  },
  starEmpty: {
    color: 'rgba(255,255,255,0.16)',
    textShadowRadius: 0,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 22,
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: UI.panelBorder,
  },
  statValue: {
    color: UI.text,
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: UI.textFaint,
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  primaryButton: {
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowButton: {
    minWidth: 98,
  },
});
