/**
 * Frosted panel used for every surface that sits above the background.
 *
 * Real blur is expensive and looks different on each platform, so this fakes
 * the frosted look the cheap way: a translucent fill, a bright hairline along
 * the top edge where light would catch, a darker one along the bottom, and a
 * soft drop shadow. At the sizes this UI uses, that is indistinguishable from a
 * blur and costs a fraction of the frames.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { UI } from '../theme/colors';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  /** Raised panels get a stronger shadow and a brighter top edge. */
  elevated?: boolean;
  /** Tint the fill toward an accent colour, for panels that need emphasis. */
  tint?: string;
}

export function GlassPanel({ children, style, radius = 24, elevated = false, tint }: Props) {
  return (
    <View
      style={[
        styles.container,
        { borderRadius: radius },
        elevated ? styles.elevated : styles.flat,
        style,
      ]}
    >
      <LinearGradient
        colors={
          tint
            ? [`${tint}2E`, 'rgba(255,255,255,0.05)', 'rgba(8,12,30,0.30)']
            : ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.045)', 'rgba(8,12,30,0.24)']
        }
        locations={[0, 0.5, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        pointerEvents="none"
      />

      {/* Light catches the top edge of a raised glass surface. */}
      <View
        pointerEvents="none"
        style={[
          styles.topEdge,
          { borderTopLeftRadius: radius, borderTopRightRadius: radius },
        ]}
      />

      <View
        pointerEvents="none"
        style={[styles.border, { borderRadius: radius }]}
      />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'rgba(16, 22, 52, 0.55)',
  },
  flat: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  elevated: {
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: '6%',
    right: '6%',
    height: 1.2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  border: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: UI.panelBorder,
  },
});
