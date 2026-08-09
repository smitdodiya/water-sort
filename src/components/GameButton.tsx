/**
 * Shared pressable used for every button in the game.
 *
 * Buttons are drawn with a bevel rather than a flat fill: a gradient face, a
 * bright hairline on the top edge, and a darker plinth underneath. Pressing
 * sinks the face into the plinth and shortens the shadow, so a tap has physical
 * travel instead of just a colour change - on a dark UI that difference is most
 * of what makes a button feel real.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { hapticTap } from '../feedback/haptics';
import { playSound } from '../feedback/sounds';
import { UI } from '../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  /** Glyph shown above the label on small buttons, before it on larger ones. */
  icon?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'large' | 'medium' | 'small';
  disabled?: boolean;
  /** Small count shown in the corner, used by the power-up bar. */
  badge?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

/** Face gradients per variant, light at the top as if lit from above. */
const FACE: Record<string, readonly [string, string, ...string[]]> = {
  primary: ['#7FE0FF', '#33B4F0', '#0E7BC4'],
  secondary: ['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)'],
  ghost: ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)'],
  danger: ['#FF8DA5', '#F4485F', '#C41F3C'],
};

/** The plinth each face sits on, always darker than the face above it. */
const PLINTH: Record<string, string> = {
  primary: '#0A5A94',
  secondary: 'rgba(0,0,0,0.42)',
  ghost: 'transparent',
  danger: '#8E1229',
};

export function GameButton({
  label,
  onPress,
  icon,
  variant = 'secondary',
  size = 'medium',
  disabled = false,
  badge,
  style,
  textStyle,
}: Props) {
  const press = useSharedValue(0);

  const faceStyle = useAnimatedStyle(() => ({
    // The face travels down into the plinth on press.
    transform: [{ translateY: press.value * 3 }, { scale: 1 - press.value * 0.02 }],
  }));

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.025 }],
  }));

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    press.value = withTiming(1, { duration: 70 });
  }, [disabled, press]);

  const handlePressOut = useCallback(() => {
    press.value = withSpring(0, { damping: 13, stiffness: 380 });
  }, [press]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    playSound('tap');
    hapticTap();
    onPress();
  }, [disabled, onPress]);

  const isCompact = size === 'small';
  const plinthDepth = size === 'large' ? 5 : 3;

  return (
    <Animated.View style={[wrapperStyle, style]}>
      {/* Plinth: the darker body the face sinks into. */}
      <View
        style={[
          styles.plinth,
          size === 'large' && styles.plinthLarge,
          isCompact && styles.plinthSmall,
          {
            backgroundColor: disabled ? 'rgba(0,0,0,0.25)' : PLINTH[variant],
            paddingBottom: variant === 'ghost' ? 0 : plinthDepth,
          },
        ]}
      >
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          hitSlop={8}
        >
          <Animated.View
            style={[
              styles.face,
              size === 'large' && styles.faceLarge,
              size === 'medium' && styles.faceMedium,
              isCompact && styles.faceSmall,
              faceStyle,
            ]}
          >
            <LinearGradient
              colors={disabled ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] : FACE[variant]}
              locations={disabled ? [0, 1] : [0, 0.55, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Hairline along the top, where light would catch the bevel. */}
            {variant !== 'ghost' && !disabled && (
              <View pointerEvents="none" style={styles.bevel} />
            )}

            {icon ? (
              <Text
                style={[
                  styles.icon,
                  size === 'large' && styles.iconLarge,
                  isCompact && styles.iconSmall,
                  variant === 'primary' && styles.onLight,
                  disabled && styles.textDisabled,
                ]}
              >
                {icon}
              </Text>
            ) : null}

            {label.length > 0 && (
              <Text
                style={[
                  styles.label,
                  size === 'large' && styles.labelLarge,
                  isCompact && styles.labelSmall,
                  variant === 'primary' && styles.onLight,
                  disabled && styles.textDisabled,
                  textStyle,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            )}
          </Animated.View>
        </Pressable>

        {badge ? (
          <View style={styles.badge} pointerEvents="none">
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  plinth: {
    borderRadius: 20,
  },
  plinthLarge: {
    borderRadius: 26,
    shadowColor: '#26A8E8',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  plinthSmall: {
    borderRadius: 17,
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    overflow: 'hidden',
  },
  faceLarge: {
    borderRadius: 26,
    paddingVertical: 18,
    paddingHorizontal: 36,
    minWidth: 230,
  },
  faceMedium: {
    paddingVertical: 13,
    paddingHorizontal: 24,
  },
  faceSmall: {
    borderRadius: 17,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minWidth: 66,
  },
  bevel: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    height: 1.4,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  icon: {
    fontSize: 20,
    color: UI.text,
  },
  iconLarge: {
    fontSize: 24,
    marginBottom: 1,
  },
  iconSmall: {
    fontSize: 19,
    marginBottom: 3,
  },
  label: {
    color: UI.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  labelLarge: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  labelSmall: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: UI.textDim,
    textTransform: 'uppercase',
  },
  onLight: {
    color: '#05202F',
  },
  textDisabled: {
    color: UI.textFaint,
  },
  badge: {
    position: 'absolute',
    top: -7,
    right: -7,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: UI.warning,
    borderWidth: 1.5,
    borderColor: 'rgba(10,14,32,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#2A1B00',
  },
});
