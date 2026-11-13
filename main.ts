// "Pawfectly Cute" — cutest-picture-01 entry (Node, standard library only).
//
// A fully procedural picture: no image files, no network, no randomness.
// Every pixel is computed from fixed geometry, so two runs of this program
// write byte-identical PNG output.
//
// Subject: one giant round kitten face filling the frame — huge glossy
// eyes, rosy blush cheeks, a tiny heart nose and little paws — on a soft
// pastel background with polka dots and sparkles. The face is deliberately
// large and simple so it still reads as unmistakably cute at thumbnail size.
//
// Run it the way the grader does:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader container.)

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

const WIDTH = 1024;
const HEIGHT = 1024;

// RGB pixel buffer, one byte per channel.
const canvas = new Uint8Array(WIDTH * HEIGHT * 3);

function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function blendPixel(x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const a = clamp01(alpha);
  if (a <= 0) return;
  const idx = (y * WIDTH + x) * 3;
  canvas[idx] = Math.round(canvas[idx] * (1 - a) + color[0] * a);
  canvas[idx + 1] = Math.round(canvas[idx + 1] * (1 - a) + color[1] * a);
  canvas[idx + 2] = Math.round(canvas[idx + 2] * (1 - a) + color[2] * a);
}

function setPixel(x, y, color) {
  blendPixel(x, y, color, 1);
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const COL = {
  bgTop: [255, 214, 232],
  bgBottom: [255, 241, 214],
  glow: [255, 252, 244],
  dot: [255, 255, 255],
  dotPink: [255, 183, 213],
  fur: [255, 226, 178],
  furShadow: [246, 196, 138],
  furLight: [255, 243, 214],
  muzzle: [255, 248, 232],
  stripe: [240, 178, 106],
  earInner: [255, 166, 190],
  eyeDark: [52, 36, 38],
  eyeBrown: [112, 66, 44],
  eyeSpark: [255, 255, 255],
  blush: [255, 138, 168],
  nose: [244, 105, 138],
  noseLight: [255, 176, 196],
  mouth: [146, 82, 82],
  whisker: [196, 156, 128],
  paw: [255, 232, 192],
  pawPad: [255, 158, 182],
  bow: [244, 96, 140],
  bowDark: [219, 66, 116],
  bowCenter: [255, 205, 92],
  sparkle: [255, 255, 255],
  heart: [255, 150, 185],
};

// ---------------------------------------------------------------------------
// Background: vertical pastel gradient, a soft central glow, polka dots.
// ---------------------------------------------------------------------------

function paintBackground() {
  for (let y = 0; y < HEIGHT; y++) {
    const t = y / (HEIGHT - 1);
    for (let x = 0; x < WIDTH; x++) {
      // Vertical gradient from pink (top) to warm cream (bottom).
      let r = COL.bgTop[0] + (COL.bgBottom[0] - COL.bgTop[0]) * t;
      let g = COL.bgTop[1] + (COL.bgBottom[1] - COL.bgTop[1]) * t;
      let b = COL.bgTop[2] + (COL.bgBottom[2] - COL.bgTop[2]) * t;
      // Radial glow behind the kitten's head.
      const dx = (x - 512) / 560;
      const dy = (y - 500) / 560;
      const d2 = dx * dx + dy * dy;
      const glowAmt = Math.max(0, 1 - d2) * 0.55;
      r = r + (COL.glow[0] - r) * glowAmt;
      g = g + (COL.glow[1] - g) * glowAmt;
      b = b + (COL.glow[2] - b) * glowAmt;
      const idx = (y * WIDTH + x) * 3;
      canvas[idx] = Math.round(r);
      canvas[idx + 1] = Math.round(g);
      canvas[idx + 2] = Math.round(b);
    }
  }
}

function paintPolkaDots() {
  // Two offset grids of soft dots, kept away from the centre of the face.
  const grids = [
    { step: 170, offsetX: 60, offsetY: 55, radius: 17, color: COL.dot, alpha: 0.5 },
    { step: 170, offsetX: 145, offsetY: 140, radius: 10, color: COL.dotPink, alpha: 0.55 },
  ];
  for (const grid of grids) {
    for (let gy = grid.offsetY; gy < HEIGHT + grid.step; gy += grid.step) {
      for (let gx = grid.offsetX; gx < WIDTH + grid.step; gx += grid.step) {
        fillCircle(gx, gy, grid.radius, grid.color, grid.alpha);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Shape helpers. Each shape is drawn through its bounding box with a
// one-to-two pixel anti-aliased edge, so curves stay smooth at full size.
// ---------------------------------------------------------------------------

function fillCircle(cx, cy, radius, color, alpha) {
  fillEllipse(cx, cy, radius, radius, color, alpha);
}

function fillEllipse(cx, cy, rx, ry, color, alpha) {
  const x0 = Math.max(0, Math.floor(cx - rx - 2));
  const x1 = Math.min(WIDTH - 1, Math.ceil(cx + rx + 2));
  const y0 = Math.max(0, Math.floor(cy - ry - 2));
  const y1 = Math.min(HEIGHT - 1, Math.ceil(cy + ry + 2));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      // Coverage falls from 1 to 0 across about two pixels at the rim.
      const coverage = clamp01((1 - d) * ry * 0.7 + 0.5);
      if (coverage > 0) blendPixel(x, y, color, coverage * alpha);
    }
  }
}

function fillTriangle(x1, y1, x2, y2, x3, y3, color, alpha) {
  // Filled triangle via barycentric coordinates, with a soft edge.
  const minX = Math.max(0, Math.floor(Math.min(x1, x2, x3) - 2));
  const maxX = Math.min(WIDTH - 1, Math.ceil(Math.max(x1, x2, x3) + 2));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2, y3) - 2));
  const maxY = Math.min(HEIGHT - 1, Math.ceil(Math.max(y1, y2, y3) + 2));
  const denom = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  if (denom === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w1 = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / denom;
      const w2 = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / denom;
      const w3 = 1 - w1 - w2;
      const smallest = Math.min(w1, w2, w3);
      // smallest is 0 on an edge and grows inward; scale it to pixels-ish.
      const coverage = clamp01(smallest * 90 + 0.5);
      if (smallest >= -0.02) blendPixel(x, y, color, coverage * alpha);
    }
  }
}

function strokeSegment(x1, y1, x2, y2, thickness, color, alpha) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - thickness - 2));
  const maxX = Math.min(WIDTH - 1, Math.ceil(Math.max(x1, x2) + thickness + 2));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - thickness - 2));
  const maxY = Math.min(HEIGHT - 1, Math.ceil(Math.max(y1, y2) + thickness + 2));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let t = len2 === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const dist = Math.hypot(x - px, y - py);
      const coverage = clamp01(thickness - dist + 0.5);
      if (coverage > 0) blendPixel(x, y, color, coverage * alpha);
    }
  }
}

function fillHeart(cx, cy, size, color, alpha) {
  // A heart from two circles and a downward triangle.
  fillCircle(cx - size * 0.42, cy - size * 0.28, size * 0.52, color, alpha);
  fillCircle(cx + size * 0.42, cy - size * 0.28, size * 0.52, color, alpha);
  fillTriangle(
    cx - size * 0.88, cy - size * 0.12,
    cx + size * 0.88, cy - size * 0.12,
    cx, cy + size * 1.05,
    color, alpha,
  );
}

function paintSparkle(cx, cy, size, color, alpha) {
  // Four-point sparkle: a thin vertical and horizontal diamond cross.
  fillTriangle(cx, cy - size, cx + size * 0.22, cy, cx - size * 0.22, cy, color, alpha);
  fillTriangle(cx, cy + size, cx + size * 0.22, cy, cx - size * 0.22, cy, color, alpha);
  fillTriangle(cx - size, cy, cx, cy - size * 0.22, cx, cy + size * 0.22, color, alpha);
  fillTriangle(cx + size, cy, cx, cy - size * 0.22, cx, cy + size * 0.22, color, alpha);
}

// ---------------------------------------------------------------------------
// The kitten
// ---------------------------------------------------------------------------

function paintEars() {
  // Outer ears: big soft triangles peeking from behind the head.
  fillTriangle(232, 330, 322, 96, 486, 252, COL.fur, 1);
  fillTriangle(792, 330, 702, 96, 538, 252, COL.fur, 1);
  // Inner ears in pink, smaller copies of the same triangles.
  fillTriangle(286, 292, 336, 168, 428, 246, COL.earInner, 1);
  fillTriangle(738, 292, 688, 168, 596, 246, COL.earInner, 1);
}

function paintHead() {
  // A gentle shadow under the chin grounds the face.
  fillEllipse(512, 872, 330, 300, COL.furShadow, 0.55);
  // The head itself: one giant round ellipse.
  fillEllipse(512, 528, 362, 336, COL.fur, 1);
  // A small lighter tuft patch at the very top of the head, kept narrow so
  // it reads as fur, not as a headband across the forehead.
  fillEllipse(512, 218, 74, 32, COL.furLight, 0.7);
  // Three short forehead stripes, a classic tabby mark, tucked under the
  // tuft and shortened so they sit on the forehead, not on the ears.
  fillEllipse(452, 292, 17, 34, COL.stripe, 0.85);
  fillEllipse(512, 282, 19, 40, COL.stripe, 0.85);
  fillEllipse(572, 292, 17, 34, COL.stripe, 0.85);
  // The muzzle: a wide, pale oval around the nose and mouth.
  fillEllipse(512, 664, 190, 118, COL.muzzle, 1);
}

function paintEyes() {
  // Huge eyes are the heart of the picture: tall dark ovals, a warm brown
  // iris glow at the bottom, and two bright highlights in each eye.
  const eyes = [
    { cx: 374, cy: 512, dir: -1 },
    { cx: 650, cy: 512, dir: 1 },
  ];
  for (const eye of eyes) {
    fillEllipse(eye.cx, eye.cy, 66, 88, COL.eyeDark, 1);
    fillEllipse(eye.cx, eye.cy + 30, 52, 52, COL.eyeBrown, 0.75);
    fillEllipse(eye.cx, eye.cy + 12, 40, 58, COL.eyeDark, 0.85);
    // Main highlight, upper left, and a smaller one lower right.
    fillCircle(eye.cx - 22, eye.cy - 30, 21, COL.eyeSpark, 1);
    fillCircle(eye.cx + 20, eye.cy + 30, 11, COL.eyeSpark, 0.95);
    fillCircle(eye.cx + 2, eye.cy - 58, 7, COL.eyeSpark, 0.9);
    // Three little eyelashes fanning up and outward from the top rim.
    const topY = eye.cy - 82;
    strokeSegment(eye.cx - 18 * eye.dir, topY + 6, eye.cx - 44 * eye.dir, topY - 16, 4, COL.eyeDark, 0.95);
    strokeSegment(eye.cx + 2 * eye.dir, topY, eye.cx - 6 * eye.dir, topY - 24, 4, COL.eyeDark, 0.95);
    strokeSegment(eye.cx + 22 * eye.dir, topY + 6, eye.cx + 40 * eye.dir, topY - 14, 4, COL.eyeDark, 0.95);
  }
}

function paintBow() {
  // A pink bow perched on the right ear: two wings, a gold knot, and a
  // darker pink crease line on each wing so it reads as folded ribbon.
  const cx = 696;
  const cy = 168;
  fillEllipse(cx - 56, cy, 52, 30, COL.bow, 1);
  fillEllipse(cx + 56, cy, 52, 30, COL.bow, 1);
  fillEllipse(cx - 56, cy, 34, 16, COL.bowDark, 0.45);
  fillEllipse(cx + 56, cy, 34, 16, COL.bowDark, 0.45);
  fillCircle(cx, cy, 22, COL.bowCenter, 1);
  fillCircle(cx, cy, 22, COL.bowDark, 0.25);
}

function paintFaceDetails() {
  // Rosy blush cheeks, wide and soft.
  fillEllipse(268, 646, 74, 40, COL.blush, 0.55);
  fillEllipse(756, 646, 74, 40, COL.blush, 0.55);
  // A tiny heart-shaped nose.
  fillHeart(512, 614, 34, COL.nose, 1);
  fillCircle(500, 602, 8, COL.noseLight, 0.9);
  // Mouth: two small arcs under the nose, drawn as short curved strokes
  // approximated by tiny segments along an arc.
  paintArc(478, 656, 34, 0.15, 2.7, 5, COL.mouth, 0.9);
  paintArc(546, 656, 34, 0.45, 3.0, 5, COL.mouth, 0.9);
  // A tiny pink tongue peeking out just below the centre of the mouth.
  fillEllipse(512, 692, 19, 15, COL.heart, 0.95);
  strokeSegment(512, 682, 512, 700, 2.5, COL.nose, 0.7);
  // Whiskers: three fine lines sweeping out from each cheek.
  const whiskers = [
    [330, 640, 168, 612],
    [330, 668, 164, 668],
    [330, 696, 176, 726],
    [694, 640, 856, 612],
    [694, 668, 860, 668],
    [694, 696, 848, 726],
  ];
  for (const w of whiskers) {
    strokeSegment(w[0], w[1], w[2], w[3], 3.2, COL.whisker, 0.8);
  }
}

function paintArc(cx, cy, radius, startAngle, endAngle, thickness, color, alpha) {
  const steps = 26;
  let prevX = cx + Math.cos(startAngle) * radius;
  let prevY = cy + Math.sin(startAngle) * radius;
  for (let i = 1; i <= steps; i++) {
    const angle = startAngle + ((endAngle - startAngle) * i) / steps;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    strokeSegment(prevX, prevY, x, y, thickness, color, alpha);
    prevX = x;
    prevY = y;
  }
}

function paintPaws() {
  // Two little paws resting at the bottom edge, under the chin.
  const paws = [
    { cx: 356 },
    { cx: 668 },
  ];
  for (const paw of paws) {
    fillEllipse(paw.cx, 934, 104, 78, COL.paw, 1);
    // The main pad and three toe beans.
    fillEllipse(paw.cx, 950, 30, 24, COL.pawPad, 0.95);
    fillCircle(paw.cx - 52, 916, 15, COL.pawPad, 0.95);
    fillCircle(paw.cx, 902, 16, COL.pawPad, 0.95);
    fillCircle(paw.cx + 52, 916, 15, COL.pawPad, 0.95);
  }
}

function paintDecorations() {
  // Background hearts and sparkles in the corners, away from the face.
  fillHeart(108, 130, 30, COL.heart, 0.8);
  fillHeart(918, 150, 24, COL.heart, 0.75);
  fillHeart(120, 838, 22, COL.heart, 0.7);
  fillHeart(906, 842, 28, COL.heart, 0.7);
  paintSparkle(168, 300, 26, COL.sparkle, 0.9);
  paintSparkle(864, 316, 30, COL.sparkle, 0.9);
  paintSparkle(210, 560, 18, COL.sparkle, 0.8);
  paintSparkle(822, 552, 18, COL.sparkle, 0.8);
}

// ---------------------------------------------------------------------------
// Compose the picture
// ---------------------------------------------------------------------------

paintBackground();
paintPolkaDots();
paintDecorations();
paintEars();
paintBow();
paintHead();
paintPaws();
paintEyes();
paintFaceDetails();

// ---------------------------------------------------------------------------
// PNG encoding (manual, zlib from the standard library)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const lengthField = Buffer.alloc(4);
  lengthField.writeUInt32BE(data.length, 0);
  const typeField = Buffer.from(type, 'ascii');
  const crcField = Buffer.alloc(4);
  crcField.writeUInt32BE(crc32(Buffer.concat([typeField, data])), 0);
  return Buffer.concat([lengthField, typeField, data, crcField]);
}

function encodePng() {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour RGB
  header[10] = 0; // compression
  header[11] = 0; // filter
  header[12] = 0; // interlace
  // Raw image data: filter byte 0 at the start of every scanline.
  const raw = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    const rowStart = y * (WIDTH * 3 + 1);
    raw[rowStart] = 0;
    Buffer.from(canvas.buffer, y * WIDTH * 3, WIDTH * 3).copy(raw, rowStart + 1);
  }
  const compressed = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Write the entry image
// ---------------------------------------------------------------------------

const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'entry.png'), encodePng());
