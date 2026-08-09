/**
 * Settings. Reset is two-step on purpose - wiping progress by mistap would be
 * unrecoverable.
 */

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameButton } from '../src/components/GameButton';
import { GlassPanel } from '../src/components/GlassPanel';
import { GradientBackground } from '../src/components/GradientBackground';
import { hapticTap } from '../src/feedback/haptics';
import { useProgressStore } from '../src/state/useProgressStore';
import { useSettingsStore } from '../src/state/useSettingsStore';
import { UI } from '../src/theme/colors';

interface RowProps {
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
}

function SettingRow({ title, subtitle, value, onToggle }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={() => {
          hapticTap();
          onToggle();
        }}
        trackColor={{ false: 'rgba(255,255,255,0.14)', true: UI.accentDeep }}
        thumbColor={value ? UI.accent : '#8E9AAF'}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const colorblindMode = useSettingsStore((s) => s.colorblindMode);
  const toggleSound = useSettingsStore((s) => s.toggleSound);
  const toggleHaptics = useSettingsStore((s) => s.toggleHaptics);
  const toggleColorblind = useSettingsStore((s) => s.toggleColorblind);

  const levelsCompleted = useProgressStore((s) => s.levelsCompleted);
  const totalMoves = useProgressStore((s) => s.totalMoves);
  const resetProgress = useProgressStore((s) => s.resetProgress);

  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <GradientBackground>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
        <GlassPanel style={styles.header} radius={20}>
          <GameButton label="" icon="‹" onPress={() => router.back()} variant="ghost" size="small" style={styles.back} />
          <Text style={styles.title}>Settings</Text>
          <View style={styles.back} />
        </GlassPanel>

        <GlassPanel style={styles.panel} radius={24}>
          <SettingRow
            title="Sound"
            subtitle="Pours, chimes, and taps"
            value={soundEnabled}
            onToggle={toggleSound}
          />
          <View style={styles.divider} />
          <SettingRow
            title="Vibration"
            subtitle="Haptic feedback on every action"
            value={hapticsEnabled}
            onToggle={toggleHaptics}
          />
          <View style={styles.divider} />
          <SettingRow
            title="Colorblind mode"
            subtitle="Marks each liquid with its own symbol"
            value={colorblindMode}
            onToggle={toggleColorblind}
          />
        </GlassPanel>

        <GlassPanel style={styles.statsPanel} radius={22}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{levelsCompleted}</Text>
            <Text style={styles.statLabel}>levels solved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalMoves}</Text>
            <Text style={styles.statLabel}>total moves</Text>
          </View>
        </GlassPanel>

        <View style={styles.footer}>
          {confirmingReset ? (
            <View style={styles.confirmRow}>
              <Text style={styles.confirmText}>Erase all progress?</Text>
              <View style={styles.confirmButtons}>
                <GameButton
                  label="Erase"
                  onPress={() => {
                    resetProgress();
                    setConfirmingReset(false);
                  }}
                  size="small"
                  textStyle={{ color: UI.danger }}
                />
                <GameButton label="Cancel" onPress={() => setConfirmingReset(false)} size="small" />
              </View>
            </View>
          ) : (
            <GameButton label="Reset progress" onPress={() => setConfirmingReset(true)} variant="ghost" size="small" />
          )}
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  back: {
    width: 46,
  },
  title: {
    color: UI.text,
    fontSize: 22,
    fontWeight: '800',
  },
  panel: {
    paddingHorizontal: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  rowText: {
    flex: 1,
    paddingRight: 14,
  },
  rowTitle: {
    color: UI.text,
    fontSize: 16,
    fontWeight: '700',
  },
  rowSubtitle: {
    color: UI.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: UI.panelBorder,
  },
  statsPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 18,
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: UI.panelBorder,
  },
  statValue: {
    color: UI.text,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: UI.textFaint,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.6,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  confirmRow: {
    alignItems: 'center',
    gap: 10,
  },
  confirmText: {
    color: UI.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 10,
  },
});
