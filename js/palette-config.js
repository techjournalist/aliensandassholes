// ===================================================================
// PALETTE / CONFIG  (fix colors here, never invent new ones in assets)
// Level-agnostic only: grid size, path, waves, etc. now live per-level
// in js/level*.js (see js/levels.js for the registry).
// ===================================================================
const PALETTE = {
  backdrop:     0x2f4a33,
  meadow:       0x6fae4a,
  meadowDark:   0x5c9a3d,
  meadowLight:  0x86c25c,
  earth:        0x6b4a2b,
  path:         0xc9a46a,
  pathEdge:     0xb08a52,
  cobble:       0x9d9a90,
  cobbleDark:   0x7e7b72,
  stone:        0x8e8f86,
  stoneDark:    0x6d6e66,
  moss:         0x7fb35a,
  wood:         0x8b5a2b,
  woodLight:    0xb07a3e,
  water:        0x4fa3c9,
  waterDeep:    0x3b86ad,
  waterFoam:    0xd8f3fb,
  streamBed:    0x4a6f7a,
  gold:         0xf2c14e,
  cream:        0xf6ecd4,
  skin:         0xf5cfa8,
  tunic:        0x4f8a3a,
  capRed:       0xd9503f,
  capBrown:     0xb8473a,
  acorn:        0x9c6b3c,
  acornCap:     0x6b4423,
  flowerPink:   0xf07ac2,
  flowerYellow: 0xffd66b,
  magic:        0xc861e0,
  magicGlow:    0xa66ef0,
  hollowGround: 0x5a5062,
  hollowEarth:  0x3f3848,
  hollowPath:   0x6d6260,
  hollowWood:   0x4a3f44,
  hollowRock:   0x8c8894,
  spore:        0x8a5fc4,
  goblin:       0x9ac04b,
  goblinDark:   0x5f7d2a,
  bat:          0x5b3d7a,
  batDark:      0x3a2650,
  trickster:    0x5fb8a0,
  tricksterDark: 0x3d8a74,
  troll:        0x7a8f5a,
  trollDark:    0x55653c,
  cloak:        0x3e6f2f,
  cloakDark:    0x2c4f22,
  frost:        0x9fdcf0,
  frostRobe:    0xdfeef5,
  outline:      0x1b1410,
  windowWarm:   0xffd36b,
  shadow:       0x000000,
  straw:        0xd4a94a,
  autumn:       0xd9822b,
  autumnDark:   0xa8561f,
  canvas:       0xe9dcc0,
};

const CONFIG = {
  border: 2,                 // decorative ring of tiles outside the grid
  tileHeight: 0.3,
  outlinePx: 2.2,            // outline thickness in CSS pixels
  maxPixelRatio: 2,
  cameraElevation: 50,       // degrees above the ground plane
  cameraYaw: 12,             // degrees, small so the grid stays readable
};
