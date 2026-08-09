/**
 * The playfield.
 *
 * Owns tube positioning and the pour choreography. Tubes are absolutely
 * positioned from computed coordinates rather than laid out with flexbox,
 * because a pouring tube has to travel to an arbitrary neighbour and the stream
 * has to be solved against its lip - both need knowable coordinates.
 *
 * Choreography of one pour (about six tenths of a second end to end):
 *   0    -> 165ms   source rises and tilts over the target
 *   165  -> 400ms   liquid arcs across; the board commits mid-flow
 *   400  -> 575ms   source rights itself and returns home
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Easing, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { isTubeComplete, topColor, topRunLength } from '../game/engine';
import { TUBE_CAPACITY } from '../game/types';
import { hapticComplete, hapticInvalid, hapticPour, hapticSelect } from '../feedback/haptics';
import { playSound } from '../feedback/sounds';
import { useGameStore } from '../state/useGameStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { BoardLayout, chunkIntoRows } from '../theme/layout';
import { computePourPlacement } from '../theme/pourGeometry';
import { CompletionBurst, Splash } from './Particles';
import { PourStream } from './PourStream';
import { PourAnimation, Tube } from './Tube';

const TRAVEL_MS = 165;
const FLOW_MS = 235;
const RETURN_MS = 175;
const TOTAL_MS = TRAVEL_MS + FLOW_MS + RETURN_MS;

/** Normalised keyframes matching the millisecond phases above. */
const OUT_STOP = TRAVEL_MS / TOTAL_MS;
const HOLD_STOP = (TRAVEL_MS + FLOW_MS) / TOTAL_MS;
const KEYFRAMES = [0, OUT_STOP, HOLD_STOP, 1];

/** How far into the flow the board state is applied. */
const COMMIT_DELAY_MS = TRAVEL_MS + 95;
/** When the liquid visually hits the surface, for splash and squash. */
const IMPACT_DELAY_MS = TRAVEL_MS + 75;

/**
 * How far the source tilts when pouring.
 *
 * Shared with the geometry below and with the stream, which solves for the same
 * lip position - the two must never drift apart or the liquid detaches from the
 * tube.
 */
const POUR_ANGLE_DEG = 74;

interface Props {
  layout: BoardLayout;
}

interface Position {
  x: number;
  y: number;
}

/** Everything the stream and splash need to know about the pour in flight. */
interface StreamState {
  sourceX: number;
  sourceY: number;
  landX: number;
  landY: number;
  color: number | null;
}

const NO_STREAM: StreamState = { sourceX: 0, sourceY: 0, landX: 0, landY: 0, color: null };

export function TubeBoard({ layout }: Props) {
  const board = useGameStore((s) => s.board);
  const selected = useGameStore((s) => s.selected);
  const pending = useGameStore((s) => s.pending);
  const hint = useGameStore((s) => s.hint);
  const justCompleted = useGameStore((s) => s.justCompleted);
  const tapTube = useGameStore((s) => s.tapTube);
  const commitPour = useGameStore((s) => s.commitPour);
  const clearJustCompleted = useGameStore((s) => s.clearJustCompleted);
  const colorblind = useSettingsStore((s) => s.colorblindMode);

  // One set of shared values for the whole board: only the tube whose index
  // matches `from` reacts, so this scales to any tube count for free.
  const pourFrom = useSharedValue(-1);
  const pourProgress = useSharedValue(0);
  const pourDx = useSharedValue(0);
  const pourDy = useSharedValue(0);
  const pourAngle = useSharedValue(0);
  const pourStops = useSharedValue(KEYFRAMES);

  // Stable identity, or every render would hand the memoized tubes a new object
  // and defeat their memoization.
  const pour = useMemo<PourAnimation>(
    () => ({
      from: pourFrom,
      progress: pourProgress,
      dx: pourDx,
      dy: pourDy,
      angle: pourAngle,
      stops: pourStops,
    }),
    [pourFrom, pourProgress, pourDx, pourDy, pourAngle, pourStops]
  );

  /**
   * Which tube is mid-pour, for stacking order.
   *
   * Tracked separately from the store's `pending` because that clears when the
   * board commits, roughly halfway through the animation - reading it for
   * zIndex would drop the tube behind its neighbours while it is still
   * travelling home.
   */
  const [pouringIndex, setPouringIndex] = useState(-1);
  const [stream, setStream] = useState<StreamState>(NO_STREAM);

  /** Which tube just received liquid, so only its new segments grow in. */
  const [arriving, setArriving] = useState<{ index: number; count: number }>({ index: -1, count: 0 });

  /** One-shot effect triggers, incremented per tube. */
  const [shakeSignals, setShakeSignals] = useState<Record<number, number>>({});
  const [completeSignals, setCompleteSignals] = useState<Record<number, number>>({});
  const [impactSignals, setImpactSignals] = useState<Record<number, number>>({});

  /** Splash and burst placement, driven by their own counters. */
  const [splash, setSplash] = useState({ x: 0, y: 0, color: null as number | null, signal: 0 });
  const [burst, setBurst] = useState({ x: 0, y: 0, color: null as number | null, signal: 0 });

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  /** Grid coordinates for every tube, rows centred individually. */
  const positions = useMemo<Position[]>(() => {
    const rows = chunkIntoRows(
      board.map((_, i) => i),
      layout.columns
    );
    const containerWidth = layout.columns * layout.tubeWidth + (layout.columns - 1) * layout.gapX;

    const result: Position[] = [];
    rows.forEach((row, rowIndex) => {
      const rowWidth = row.length * layout.tubeWidth + (row.length - 1) * layout.gapX;
      // Centre short rows (a 7-tube board ends 4 + 3) so the board stays composed.
      const startX = (containerWidth - rowWidth) / 2;
      row.forEach((tubeIndex, columnIndex) => {
        result[tubeIndex] = {
          x: startX + columnIndex * (layout.tubeWidth + layout.gapX),
          y: rowIndex * (layout.tubeHeight + layout.gapY),
        };
      });
    });
    return result;
  }, [board, layout]);

  const containerSize = useMemo(
    () => ({
      width: layout.columns * layout.tubeWidth + (layout.columns - 1) * layout.gapX,
      height: layout.rows * layout.tubeHeight + (layout.rows - 1) * layout.gapY,
    }),
    [layout]
  );

  /** Run the pour animation whenever the store queues one. */
  useEffect(() => {
    if (!pending) return;

    const from = positions[pending.from];
    const to = positions[pending.to];
    if (!from || !to) {
      commitPour();
      return;
    }

    const sourceTube = board[pending.from];
    const destTube = board[pending.to];
    const pouredColor = topColor(sourceTube);
    const amount = Math.min(topRunLength(sourceTube), TUBE_CAPACITY - destTube.length);

    // Approach from whichever side the source already sits on, so the tube
    // never crosses over the target on its way.
    const side = from.x <= to.x ? 1 : -1;

    // Solved rather than eyeballed - see pourGeometry, and the test that locks
    // the mouth onto the destination's centre line.
    const placement = computePourPlacement(
      to,
      { width: layout.tubeWidth, height: layout.tubeHeight },
      POUR_ANGLE_DEG,
      side
    );

    pourDx.value = placement.targetX - from.x;
    pourDy.value = placement.targetY - from.y;
    // Positive rotation is clockwise, which tips the mouth to the right - the
    // correct way when approaching from the left.
    pourAngle.value = placement.angle;
    pourFrom.value = pending.from;
    pourProgress.value = 0;
    setPouringIndex(pending.from);

    // The liquid lands on whatever surface is currently in the destination.
    const surfaceY = to.y + (TUBE_CAPACITY - destTube.length) * layout.segmentHeight;
    const landX = to.x + layout.tubeWidth / 2;

    setStream({
      sourceX: from.x,
      sourceY: from.y,
      landX,
      landY: surfaceY,
      color: pouredColor,
    });

    pourProgress.value = withSequence(
      withTiming(OUT_STOP, { duration: TRAVEL_MS, easing: Easing.out(Easing.cubic) }),
      withTiming(HOLD_STOP, { duration: FLOW_MS, easing: Easing.linear }),
      withTiming(1, { duration: RETURN_MS, easing: Easing.inOut(Easing.quad) })
    );

    playSound('pour');
    hapticPour();

    clearTimers();

    // Splash and squash fire when the liquid visually connects, slightly before
    // the board commits - impact should lead the state change, not trail it.
    timers.current.push(
      setTimeout(() => {
        setSplash((s) => ({ x: landX, y: surfaceY, color: pouredColor, signal: s.signal + 1 }));
        setImpactSignals((previous) => ({
          ...previous,
          [pending.to]: (previous[pending.to] ?? 0) + 1,
        }));
        // Layered on top of the pour, so the landing has its own transient
        // rather than the stream just stopping.
        playSound('drop');
      }, IMPACT_DELAY_MS)
    );

    timers.current.push(
      setTimeout(() => {
        setArriving({ index: pending.to, count: amount });
        commitPour();
      }, COMMIT_DELAY_MS)
    );

    timers.current.push(
      setTimeout(() => {
        // Release the tube only once it is home, or it would snap back.
        pourFrom.value = -1;
        setPouringIndex(-1);
        setStream(NO_STREAM);
        setArriving({ index: -1, count: 0 });
      }, TOTAL_MS)
    );

    // Effect intentionally keyed on the queued move only; positions and layout
    // are stable for the duration of a single pour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  /** Celebrate any tube that just filled. */
  useEffect(() => {
    if (justCompleted.length === 0) return;

    setCompleteSignals((previous) => {
      const next = { ...previous };
      for (const index of justCompleted) next[index] = (next[index] ?? 0) + 1;
      return next;
    });

    // Burst from the middle of the first finished tube.
    const index = justCompleted[0];
    const at = positions[index];
    const tube = board[index];
    if (at && tube && tube.length > 0) {
      setBurst((b) => ({
        x: at.x + layout.tubeWidth / 2,
        y: at.y + layout.tubeHeight / 2,
        color: tube[0],
        signal: b.signal + 1,
      }));
    }

    // Let the pour land first, so the chime does not collide with the splash.
    timers.current.push(
      setTimeout(() => {
        playSound('complete');
        hapticComplete();
      }, 110)
    );

    clearJustCompleted();
  }, [justCompleted, clearJustCompleted, positions, board, layout.tubeWidth, layout.tubeHeight]);

  const handlePress = useCallback(
    (index: number) => {
      const outcome = tapTube(index);

      if (outcome === 'select') {
        playSound('select');
        hapticSelect();
      } else if (outcome === 'deselect') {
        playSound('tap');
        hapticSelect();
      } else if (outcome === 'invalid') {
        playSound('invalid');
        hapticInvalid();
        setShakeSignals((previous) => ({ ...previous, [index]: (previous[index] ?? 0) + 1 }));
      }
      // 'pour' is handled by the pending effect; 'ignored' is silent by design.
    },
    [tapTube]
  );

  return (
    <View style={[styles.container, containerSize]}>
      {board.map((tube, index) => (
        <Tube
          key={index}
          index={index}
          tube={tube}
          layout={layout}
          x={positions[index]?.x ?? 0}
          y={positions[index]?.y ?? 0}
          isSelected={selected === index}
          isPouring={pouringIndex === index}
          arrivingCount={arriving.index === index ? arriving.count : 0}
          shakeSignal={shakeSignals[index] ?? 0}
          impactSignal={impactSignals[index] ?? 0}
          completeSignal={completeSignals[index] ?? 0}
          hintRole={hint?.from === index ? 'from' : hint?.to === index ? 'to' : null}
          colorblind={colorblind}
          pour={pour}
          onPress={handlePress}
        />
      ))}

      {stream.color !== null && (
        <PourStream
          progress={pourProgress}
          dx={pourDx}
          dy={pourDy}
          angle={pourAngle}
          stops={pourStops}
          sourceX={stream.sourceX}
          sourceY={stream.sourceY}
          tubeWidth={layout.tubeWidth}
          tubeHeight={layout.tubeHeight}
          landX={stream.landX}
          landY={stream.landY}
          boardWidth={containerSize.width}
          boardHeight={containerSize.height}
          color={stream.color}
        />
      )}

      <Splash
        x={splash.x}
        y={splash.y}
        color={splash.color}
        signal={splash.signal}
        scale={layout.tubeWidth}
      />

      <CompletionBurst
        x={burst.x}
        y={burst.y}
        color={burst.color}
        signal={burst.signal}
        scale={layout.tubeWidth}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    position: 'relative',
  },
});
