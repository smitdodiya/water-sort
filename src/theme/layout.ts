/**
 * Board layout.
 *
 * Tube size is derived from the screen and the number of tubes rather than
 * hardcoded, so a 12-color board on a small phone shrinks to fit instead of
 * overflowing, and a tablet does not end up with postage-stamp tubes.
 */

import { TUBE_CAPACITY } from '../game/types';

export interface BoardLayout {
  /** Tubes per row. */
  columns: number;
  /** Number of rows the board wraps onto. */
  rows: number;
  tubeWidth: number;
  /** Interior height of the glass (capacity x segmentHeight). */
  tubeHeight: number;
  segmentHeight: number;
  /** Horizontal gap between tubes. */
  gapX: number;
  /** Vertical gap between rows - larger, because a selected tube lifts. */
  gapY: number;
  /** How far the top run rises when a tube is selected. */
  liftDistance: number;
  /** Corner radius of the glass body. */
  radius: number;
}

const MIN_TUBE_WIDTH = 34;
const MAX_TUBE_WIDTH = 68;
/** Tubes are noticeably taller than wide; this is height / width. */
const ASPECT = 3.5;

/**
 * Choose a column count that balances the rows.
 *
 * Six across is the comfortable ceiling on a phone. We prefer splits that leave
 * rows even (7 tubes reads better as 4+3 than 6+1), which keeps the board
 * looking composed rather than ragged.
 */
function chooseColumns(tubeCount: number): number {
  if (tubeCount <= 5) return tubeCount;
  if (tubeCount <= 8) return Math.ceil(tubeCount / 2);
  if (tubeCount <= 12) return Math.ceil(tubeCount / 2);
  return Math.ceil(tubeCount / 3);
}

export function computeLayout(
  screenWidth: number,
  availableHeight: number,
  tubeCount: number
): BoardLayout {
  const columns = Math.min(6, Math.max(2, chooseColumns(tubeCount)));
  const rows = Math.ceil(tubeCount / columns);

  const horizontalPadding = 20;
  const gapX = screenWidth < 360 ? 8 : 14;
  const gapY = 26;

  // Width the board may occupy, shared between columns and the gaps.
  const widthBudget = screenWidth - horizontalPadding * 2 - gapX * (columns - 1);
  let tubeWidth = widthBudget / columns;

  // Height must also fit; a tall board on a short screen is the binding
  // constraint, so derive a width from the height allowance and take the
  // smaller of the two.
  const heightBudget = availableHeight - gapY * (rows - 1);
  const heightPerTube = heightBudget / rows;
  const widthFromHeight = heightPerTube / ASPECT;

  tubeWidth = Math.min(tubeWidth, widthFromHeight);
  tubeWidth = Math.max(MIN_TUBE_WIDTH, Math.min(MAX_TUBE_WIDTH, tubeWidth));

  const tubeHeight = tubeWidth * ASPECT;

  return {
    columns,
    rows,
    tubeWidth,
    tubeHeight,
    segmentHeight: tubeHeight / TUBE_CAPACITY,
    gapX,
    gapY,
    liftDistance: Math.round(tubeWidth * 0.34),
    radius: tubeWidth * 0.32,
  };
}

/**
 * Split tubes into rows for rendering, filling earlier rows first.
 */
export function chunkIntoRows<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}
