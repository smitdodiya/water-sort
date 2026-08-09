/**
 * Draws the app icon, splash mark, and adaptive-icon layers as PNGs.
 *
 * Written by hand against Node's zlib rather than pulling in an image library,
 * so the icon is reproducible from source and restyling it means editing
 * numbers here instead of round-tripping a binary through an editor.
 *
 * Run with:  node scripts/generate-icon.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'assets');

/** CRC32, needed for every PNG chunk. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** Encode straight RGBA pixels as a PNG. */
function encodePng(pixels, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // color type: RGBA
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  // Each scanline is prefixed with its filter byte; 0 means "none".
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Simple RGBA canvas with the few primitives this icon needs. */
function createCanvas(size) {
  const pixels = Buffer.alloc(size * size * 4);

  const blend = (x, y, [r, g, b], alpha) => {
    if (alpha <= 0 || x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const a = Math.min(1, alpha);
    // Source-over onto whatever is already there.
    pixels[i] = Math.round(pixels[i] * (1 - a) + r * a);
    pixels[i + 1] = Math.round(pixels[i + 1] * (1 - a) + g * a);
    pixels[i + 2] = Math.round(pixels[i + 2] * (1 - a) + b * a);
    pixels[i + 3] = Math.round(Math.min(255, pixels[i + 3] * (1 - a) + 255 * a));
  };

  return {
    pixels,

    /** Vertical gradient across the whole canvas. */
    fillGradient(top, bottom) {
      for (let y = 0; y < size; y++) {
        const t = y / (size - 1);
        const color = [
          Math.round(top[0] + (bottom[0] - top[0]) * t),
          Math.round(top[1] + (bottom[1] - top[1]) * t),
          Math.round(top[2] + (bottom[2] - top[2]) * t),
        ];
        for (let x = 0; x < size; x++) blend(x, y, color, 1);
      }
    },

    /**
     * Rounded rectangle with an antialiased edge.
     *
     * Uses a proper signed distance field: negative inside, zero on the edge,
     * positive outside. Clamping the distance to zero instead (the obvious
     * shortcut) reports every interior pixel as sitting exactly on the edge,
     * which renders the whole shape at half coverage.
     */
    roundedRect(x0, y0, width, height, radiusTop, radiusBottom, color, alpha = 1) {
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      const centerX = x0 + halfWidth;
      const centerY = y0 + halfHeight;

      for (let y = Math.floor(y0) - 2; y <= Math.ceil(y0 + height) + 2; y++) {
        for (let x = Math.floor(x0) - 2; x <= Math.ceil(x0 + width) + 2; x++) {
          const px = x + 0.5;
          const py = y + 0.5;

          // Corner radius belonging to whichever half this pixel sits in.
          const radius = Math.min(py < centerY ? radiusTop : radiusBottom, halfWidth, halfHeight);

          const dx = Math.abs(px - centerX) - (halfWidth - radius);
          const dy = Math.abs(py - centerY) - (halfHeight - radius);

          const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
          const inside = Math.min(Math.max(dx, dy), 0);
          const distance = outside + inside - radius;

          // One-pixel feather across the boundary.
          const coverage = Math.min(1, Math.max(0, 0.5 - distance));
          if (coverage > 0) blend(x, y, color, coverage * alpha);
        }
      }
    },
  };
}

const BACKDROP_TOP = [16, 24, 60];
const BACKDROP_BOTTOM = [8, 12, 32];

/**
 * The mark: three glass tubes holding the game's signature colors, with the
 * middle one completed so the icon shows the goal at a glance.
 */
function drawMark(canvas, size, scale) {
  const tubeWidth = size * 0.16 * scale;
  const tubeHeight = size * 0.5 * scale;
  const gap = size * 0.075 * scale;
  const totalWidth = tubeWidth * 3 + gap * 2;
  const startX = (size - totalWidth) / 2;
  const top = (size - tubeHeight) / 2;

  const tubes = [
    [
      [244, 48, 102],
      [41, 163, 224],
      [244, 48, 102],
      [41, 163, 224],
    ],
    // The middle tube is sorted - the state the player is working toward.
    [
      [143, 214, 43],
      [143, 214, 43],
      [143, 214, 43],
      [143, 214, 43],
    ],
    [
      [255, 165, 31],
      [157, 92, 255],
      [255, 165, 31],
      [157, 92, 255],
    ],
  ];

  const radiusTop = tubeWidth * 0.16;
  const radiusBottom = tubeWidth * 0.44;

  tubes.forEach((segments, tubeIndex) => {
    const x = startX + tubeIndex * (tubeWidth + gap);
    // Lift the finished tube so the icon has a focal point.
    const y = top + (tubeIndex === 1 ? -size * 0.035 * scale : 0);

    // Glass body behind the liquid.
    canvas.roundedRect(x, y, tubeWidth, tubeHeight, radiusTop, radiusBottom, [255, 255, 255], 0.1);

    const segmentHeight = tubeHeight / 4;
    segments.forEach((color, segmentIndex) => {
      // Array index 0 is the bottom of the tube.
      const segmentY = y + tubeHeight - (segmentIndex + 1) * segmentHeight;
      const isBottom = segmentIndex === 0;
      canvas.roundedRect(
        x + tubeWidth * 0.06,
        segmentY,
        tubeWidth * 0.88,
        segmentHeight,
        isBottom ? 0 : 0,
        isBottom ? radiusBottom * 0.8 : 0,
        color,
        0.97
      );
    });

    // Specular strip, which is what makes flat bands read as glass.
    canvas.roundedRect(
      x + tubeWidth * 0.14,
      y + tubeHeight * 0.06,
      tubeWidth * 0.16,
      tubeHeight * 0.82,
      tubeWidth * 0.08,
      tubeWidth * 0.08,
      [255, 255, 255],
      0.3
    );
  });
}

function buildIcon(size, { transparent = false, scale = 1 } = {}) {
  const canvas = createCanvas(size);
  if (!transparent) canvas.fillGradient(BACKDROP_TOP, BACKDROP_BOTTOM);
  drawMark(canvas, size, scale);
  return encodePng(canvas.pixels, size);
}

function buildSolidBackground(size) {
  const canvas = createCanvas(size);
  canvas.fillGradient(BACKDROP_TOP, BACKDROP_BOTTOM);
  return encodePng(canvas.pixels, size);
}

const outputs = [
  ['icon.png', buildIcon(1024)],
  ['splash-icon.png', buildIcon(1024, { transparent: true, scale: 1.05 })],
  ['favicon.png', buildIcon(96)],
  // Adaptive icons: Android masks these, so the mark is scaled down to stay
  // inside the safe zone and the background ships as its own layer.
  ['android-icon-foreground.png', buildIcon(1024, { transparent: true, scale: 0.62 })],
  ['android-icon-background.png', buildSolidBackground(1024)],
  ['android-icon-monochrome.png', buildIcon(1024, { transparent: true, scale: 0.62 })],
];

for (const [name, data] of outputs) {
  fs.writeFileSync(path.join(OUT_DIR, name), data);
  console.log(`wrote assets/${name} (${(data.length / 1024).toFixed(1)}KB)`);
}
