/**
 * Home screen. The Play button resumes wherever the player left off.
 */

import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameButton } from '../src/components/GameButton';
import { GlassPanel } from '../src/components/GlassPanel';
import { GradientBackground } from '../src/components/GradientBackground';
import { useProgressStore } from '../src/state/useProgressStore';
import { LIQUIDS, UI } from '../src/theme/colors';
import { ellipseHeight, GLASS_CYLINDER, LIQUID_CYLINDER } from '../src/theme/shading';
import { LinearGradient } from 'expo-linear-gradient';

const MINI_WIDTH = 38;
const MINI_HEIGHT = 124;

/**
 * Decorative tube for the title, shaded the same way the real ones are so the
 * home screen previews what the game looks like.
 */
function BobbingTube({ colors, index }: { colors: number[]; index: number }) {
  const offset = useSharedValue(0);
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(
      160 + index * 110,
      withSpring(1, { damping: 11, stiffness: 150 })
    );
    offset.value = withDelay(
      index * 300,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
  }, [index, offset, enter]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: offset.value + (1 - enter.value) * 30 },
      { scale: 0.8 + enter.value * 0.2 },
    ],
  }));

  const segmentHeight = MINI_HEIGHT / colors.length;
  const surfaceHeight = ellipseHeight(MINI_WIDTH);

  return (
    <Animated.View style={[styles.miniTube, style]}>
      <View style={styles.miniBody}>
        {/* Rendered top-down, so reverse to put array index 0 at the bottom. */}
        {colors
          .slice()
          .reverse()
          .map((color, i) => (
            <View key={i} style={{ height: segmentHeight, backgroundColor: LIQUIDS[color].solid }}>
              <LinearGradient
                colors={LIQUID_CYLINDER.colors}
                locations={LIQUID_CYLINDER.locations}
                start={LIQUID_CYLINDER.start}
                end={LIQUID_CYLINDER.end}
                style={StyleSheet.absoluteFill}
              />
            </View>
          ))}

        <LinearGradient
          colors={GLASS_CYLINDER.colors}
          locations={GLASS_CYLINDER.locations}
          start={GLASS_CYLINDER.start}
          end={GLASS_CYLINDER.end}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      {/* Open mouth, matching the in-game tubes. */}
      <View
        pointerEvents="none"
        style={[styles.miniMouth, { height: surfaceHeight, top: -surfaceHeight / 2 }]}
      />
      <View pointerEvents="none" style={styles.miniWall} />
    </Animated.View>
  );
}

function TitleTubes() {
  const tubes = [
    [0, 1, 0, 1],
    [4, 2, 4, 2],
    [3, 5, 3, 5],
  ];

  return (
    <View style={styles.titleTubes}>
      {tubes.map((tube, tubeIndex) => (
        <BobbingTube key={tubeIndex} colors={tube} index={tubeIndex} />
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentLevel = useProgressStore((s) => s.currentLevel);
  const levelsCompleted = useProgressStore((s) => s.levelsCompleted);
  const stars = useProgressStore((s) => s.stars);

  const totalStars = Object.values(stars).reduce<number>((sum, value) => sum + value, 0);

  const titleScale = useSharedValue(0.82);
  const titleOpacity = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    titleScale.value = withSpring(1, { damping: 12, stiffness: 140 });
    titleOpacity.value = withTiming(1, { duration: 480 });
    // Slow breathing glow behind the wordmark.
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2300, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [titleScale, titleOpacity, shimmer]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + shimmer.value * 0.45,
    transform: [{ scale: 0.95 + shimmer.value * 0.1 }],
  }));

  return (
    <GradientBackground>
      <View style={[styles.container, { paddingTop: insets.top + 34, paddingBottom: insets.bottom + 30 }]}>
        <Animated.View style={[styles.titleBlock, titleStyle]}>
          <View style={styles.titleWrap}>
            <Animated.View pointerEvents="none" style={[styles.titleGlow, glowStyle]} />
            <Text style={styles.title}>WATER</Text>
            <Text style={styles.titleAccent}>SORT</Text>
          </View>
          <Text style={styles.tagline}>pour · sort · relax</Text>
          <TitleTubes />
        </Animated.View>

        <View style={styles.menu}>
          <GameButton
            label={currentLevel > 1 ? `CONTINUE · ${currentLevel}` : 'PLAY'}
            onPress={() => router.push({ pathname: '/game', params: { level: String(currentLevel) } })}
            variant="primary"
            size="large"
          />

          <View style={styles.menuRow}>
            <GameButton label="Levels" icon="▦" onPress={() => router.push('/levels')} style={styles.menuRowButton} />
            <GameButton
              label="Settings"
              icon="⚙"
              onPress={() => router.push('/settings')}
              style={styles.menuRowButton}
            />
          </View>

          {levelsCompleted > 0 && (
            <GlassPanel style={styles.statsPanel} radius={18}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{levelsCompleted}</Text>
                <Text style={styles.statLabel}>SOLVED</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: UI.warning }]}>★ {totalStars}</Text>
                <Text style={styles.statLabel}>STARS</Text>
              </View>
            </GlassPanel>
          )}
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
  },
  titleBlock: {
    alignItems: 'center',
  },
  titleWrap: {
    alignItems: 'center',
  },
  titleGlow: {
    position: 'absolute',
    top: '10%',
    width: 250,
    height: 90,
    borderRadius: 120,
    backgroundColor: '#2F8FE0',
    shadowColor: '#4FC3F7',
    shadowOpacity: 1,
    shadowRadius: 50,
    elevation: 20,
  },
  title: {
    color: UI.text,
    fontSize: 47,
    fontWeight: '900',
    letterSpacing: 11,
    // Offset by half the letter-spacing so the glyphs stay optically centred.
    marginRight: -11,
  },
  titleAccent: {
    color: '#7FE0FF',
    fontSize: 47,
    fontWeight: '900',
    letterSpacing: 11,
    marginRight: -11,
    marginTop: -8,
    textShadowColor: 'rgba(79, 195, 247, 0.85)',
    textShadowRadius: 24,
  },
  tagline: {
    color: UI.textFaint,
    fontSize: 11.5,
    letterSpacing: 4,
    fontWeight: '700',
    marginTop: 10,
    textTransform: 'uppercase',
  },
  titleTubes: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 44,
  },
  miniTube: {
    width: MINI_WIDTH,
    height: MINI_HEIGHT,
  },
  miniBody: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: 'rgba(160,190,230,0.09)',
    overflow: 'hidden',
    flexDirection: 'column',
  },
  miniMouth: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: MINI_WIDTH,
    borderWidth: 1.3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  miniWall: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 1.2,
    borderColor: UI.glassBorder,
  },
  menu: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  menuRow: {
    flexDirection: 'row',
    gap: 14,
  },
  menuRowButton: {
    minWidth: 136,
  },
  statsPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: UI.panelBorder,
  },
  statValue: {
    color: UI.text,
    fontSize: 19,
    fontWeight: '900',
  },
  statLabel: {
    color: UI.textFaint,
    fontSize: 9,
    letterSpacing: 1.6,
    fontWeight: '800',
    marginTop: 1,
  },
});
