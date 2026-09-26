

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 64;

/* === PNG encoding === */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour + alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* === Tiny drawing helpers === */

function createImage() {
  return new Uint8Array(SIZE * SIZE * 4);
}

function setPixel(img, x, y, [r, g, b, a = 255]) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  img[i] = r;
  img[i + 1] = g;
  img[i + 2] = b;
  img[i + 3] = a;
}

function fillRect(img, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) setPixel(img, x + dx, y + dy, color);
  }
}

/** Draws an 8x8 face from rows of palette keys. "." means transparent. */
function drawFace(img, x, y, rows, palette) {
  if (rows.length !== 8) throw new Error('face needs 8 rows');
  rows.forEach((row, dy) => {
    if (row.length !== 8) throw new Error(`row "${row}" is not 8 wide`);
    [...row].forEach((key, dx) => {
      if (key === '.') return;
      const color = palette[key];
      if (!color) throw new Error(`missing palette color "${key}"`);
      setPixel(img, x + dx, y + dy, color);
    });
  });
}

const hex = (value) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

/* === Face art === */

// Humanoid head: hair on top, ears on the sides, eyes, nose, mouth, stubble.
const HUMANOID_HEAD = {
  top: [
    'HHHHHHHH',
    'hHhhHhhh',
    'sshhssss',
    'hhhhhhhh',
    'hhhhhhhh',
    'sshhhhss',
    'sshhhhhs',
    'hhhhhhhh',
  ],
  bottom: [
    'bbbbbbbb',
    'sSSSSSSS',
    'LsSSSSsL',
    'LLssssLL',
    'LLssssLL',
    'LLssssLL',
    'sLLLLLLs',
    'ssssssss',
  ],
  side: [
    'HHHHHHHH',
    'hhhhhhhh',
    'hseesssh',
    'hseesssh',
    'hssssssh',
    'hssssssh',
    'hsSSSSsh',
    'hbbbbbhh',
  ],
  front: [
    'HHHHHHHH',
    'hHhhHhhh',
    'hwwsswwh',
    'hwdssdwh',
    'hsSSSSsh',
    'hsmmmmsh',
    'hsSssssh',
    'hsbbbbhs',
  ],
  back: [
    'hhhhhhhh',
    'hhhhhhhh',
    'hhhhhhhh',
    'HhhhhhhH',
    'hhhhhhhh',
    'ssssssss',
    'SSSSSSSS',
    'bbbbbbbb',
  ],
};

// Second layer: the hair silhouette grown by one pixel, everything else clear.
const HUMANOID_HAT = {
  top: [
    'oooooooo',
    'ohhhhhho',
    'ohHhhhho',
    'ohhhhhho',
    'ohhhhhho',
    'ohhhhhho',
    'ohhhhhho',
    'oooooooo',
  ],
  bottom: null,
  side: [
    'oooooooo',
    'ohhhhhho',
    'ohhhhhho',
    'oooooooo',
    '........',
    '........',
    '........',
    '........',
  ],
  front: [
    'oooooooo',
    'ohHhhhho',
    'ohhhhhho',
    'oooooooo',
    '........',
    '........',
    '........',
    '........',
  ],
  back: [
    'oooooooo',
    'ohhhhhho',
    'ohhhhhho',
    'oooooooo',
    '........',
    '........',
    '........',
    '........',
  ],
};

// Creeper: flat green hide, dark mottling, black face.
const CREEPER_HEAD = {
  top: [
    'gggggggg',
    'gGggggGg',
    'ggkggggk',
    'gggggggg',
    'gkgggggk',
    'gggggkgg',
    'gggggggg',
    'kggggggg',
  ],
  bottom: [
    'kkgggggk',
    'kgkggggg',
    'gggggggg',
    'kgggggkk',
    'gggggggg',
    'gggkggkg',
    'gggggggg',
    'kggggggk',
  ],
  side: [
    'gggggggg',
    'gGgggggk',
    'gkgggggg',
    'ggggkggk',
    'kggggggg',
    'gggggggg',
    'gkggggkg',
    'gggkkggg',
  ],
  front: [
    'gggggggg',
    'gGggggGg',
    'gddggddg',
    'gddggddg',
    'gggddggg',
    'gddddddg',
    'gggddggg',
    'gggggggg',
  ],
  back: [
    'gggggggg',
    'gkgggggg',
    'gggggggg',
    'gGgggggk',
    'gggggggg',
    'gggkggkg',
    'gggggggg',
    'kkkkkkkk',
  ],
};

// Standard 64x64 face regions.
const REGIONS = {
  head: { top: [8, 0], bottom: [16, 0], right: [0, 8], front: [8, 8], left: [16, 8], back: [24, 8] },
  hat: { top: [40, 0], bottom: [48, 0], right: [32, 8], front: [40, 8], left: [48, 8], back: [56, 8] },
  body: { top: [20, 16], bottom: [28, 16], right: [16, 16], front: [20, 20], left: [28, 20], back: [32, 20] },
  armR: { top: [44, 16], bottom: [48, 16], right: [40, 16], front: [44, 20], left: [48, 20], back: [52, 20] },
  armL: { top: [36, 48], bottom: [40, 48], right: [32, 48], front: [36, 52], left: [40, 52], back: [44, 52] },
  legR: { top: [4, 16], bottom: [8, 16], right: [0, 16], front: [4, 20], left: [8, 20], back: [12, 20] },
  legL: { top: [20, 48], bottom: [24, 48], right: [16, 48], front: [20, 52], left: [24, 52], back: [28, 52] },
};

function paintBlock(img, region, color, shade, topRows = 8) {
  Object.values(region).forEach(([x, y]) => {
    fillRect(img, x, y, 8, topRows, color);
    fillRect(img, x, y + topRows - 1, 8, 1, shade);
    fillRect(img, x + 7, y, 1, topRows, shade);
  });
}

function paintHead(img, art, hatArt, palette) {
  const { head, hat } = REGIONS;

  drawFace(img, ...head.top, art.top, palette);
  drawFace(img, ...head.bottom, art.bottom, palette);
  drawFace(img, ...head.right, art.side, palette);
  drawFace(img, ...head.left, art.side, palette);
  drawFace(img, ...head.front, art.front, palette);
  drawFace(img, ...head.back, art.back, palette);

  if (!hatArt) return;
  drawFace(img, ...hat.top, hatArt.top, palette);
  if (hatArt.bottom) drawFace(img, ...hat.bottom, hatArt.bottom, palette);
  drawFace(img, ...hat.right, hatArt.side, palette);
  drawFace(img, ...hat.left, hatArt.side, palette);
  drawFace(img, ...hat.front, hatArt.front, palette);
  drawFace(img, ...hat.back, hatArt.back, palette);
}

/* === Skins === */

const SKINS = [
  {
    name: 'steve',
    palette: {
      h: hex('#3b2a1a'),
      H: hex('#513a22'),
      s: hex('#c6906b'),
      S: hex('#ab7452'),
      L: hex('#dcae8c'),
      e: hex('#b5764f'),
      w: hex('#f2f2f2'),
      d: hex('#5a5a8c'),
      m: hex('#6d4128'),
      b: hex('#5c4327'),
      o: hex('#241a10'),
    },
    body: { color: hex('#2f9c9c'), shade: hex('#247878') },
    arms: { color: hex('#c6906b'), shade: hex('#ab7452') },
    legs: { color: hex('#3b4a9c'), shade: hex('#2d3a7d') },
    feet: { color: hex('#4f4f57'), shade: hex('#3b3b42') },
  },
  {
    name: 'alex',
    palette: {
      h: hex('#7a4a22'),
      H: hex('#9c6430'),
      s: hex('#f0c8a0'),
      S: hex('#dba97e'),
      L: hex('#fadfc4'),
      e: hex('#e0b489'),
      w: hex('#f7f7f7'),
      d: hex('#6b8fd6'),
      m: hex('#b57551'),
      b: hex('#a97246'),
      o: hex('#3f2714'),
    },
    body: { color: hex('#3aa3a3'), shade: hex('#2d8484') },
    arms: { color: hex('#f0c8a0'), shade: hex('#dba97e') },
    legs: { color: hex('#4455ad'), shade: hex('#35438a') },
    feet: { color: hex('#5a5a63'), shade: hex('#44444b') },
  },
  {
    name: 'zombie',
    palette: {
      h: hex('#2f4a2a'),
      H: hex('#3f6038'),
      s: hex('#6a9a4a'),
      S: hex('#55793a'),
      L: hex('#86b862'),
      e: hex('#5b8540'),
      w: hex('#1f1f1f'),
      d: hex('#111111'),
      m: hex('#2b3a24'),
      b: hex('#3d5730'),
      o: hex('#1d2e1a'),
    },
    body: { color: hex('#3a5a86'), shade: hex('#2c4569') },
    arms: { color: hex('#6a9a4a'), shade: hex('#55793a') },
    legs: { color: hex('#3a4a7a'), shade: hex('#2b3860') },
    feet: { color: hex('#4a4a57'), shade: hex('#38383f') },
  },
  {
    name: 'creeper',
    palette: {
      g: hex('#5b9b3c'),
      G: hex('#74b954'),
      k: hex('#4a7f31'),
      d: hex('#1d2b17'),
    },
    art: CREEPER_HEAD,
    hat: null,
    body: { color: hex('#5b9b3c'), shade: hex('#4a7f31') },
    arms: { color: hex('#5b9b3c'), shade: hex('#4a7f31') },
    legs: { color: hex('#4f8a34'), shade: hex('#40742a') },
    feet: { color: hex('#43762c'), shade: hex('#356222') },
  },
];

const outDir = path.join(__dirname, '..', 'skins');
fs.mkdirSync(outDir, { recursive: true });

SKINS.forEach((skin) => {
  const img = createImage();
  const art = skin.art || HUMANOID_HEAD;
  const hatArt = skin.art ? skin.hat : HUMANOID_HAT;

  paintHead(img, art, hatArt, skin.palette);
  paintBlock(img, REGIONS.body, skin.body.color, skin.body.shade);
  paintBlock(img, REGIONS.armR, skin.arms.color, skin.arms.shade);
  paintBlock(img, REGIONS.armL, skin.arms.color, skin.arms.shade);
  paintBlock(img, REGIONS.legR, skin.legs.color, skin.legs.shade, 4);
  paintBlock(img, REGIONS.legL, skin.legs.color, skin.legs.shade, 4);

  // Boots occupy the lower half of the leg faces.
  [REGIONS.legR, REGIONS.legL].forEach((region) => {
    Object.values(region).forEach(([x, y]) => {
      fillRect(img, x, y + 4, 8, 4, skin.feet.color);
      fillRect(img, x, y + 7, 8, 1, skin.feet.shade);
      fillRect(img, x + 7, y + 4, 1, 4, skin.feet.shade);
    });
  });

  const file = path.join(outDir, `${skin.name}.png`);
  fs.writeFileSync(file, encodePNG(SIZE, SIZE, img));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
});
