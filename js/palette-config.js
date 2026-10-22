// ===================================================================
// PALETTE / CONFIG  (fix colors here, never invent new ones in assets)
// Level-agnostic only: grid size, path, waves, etc. live per-level in
// js/level*.js (see js/levels.js for the registry).
//
// Knights & Knaves: a sunny storybook kingdom in royal blue, heraldic red
// and gold, limestone castles and thatched villages. The "hollow*" keys are
// the engine's danger-zone colors; here they are the ravaged land around
// the Black Baron's war camps: ash, char and smoking embers.
// ===================================================================
const PALETTE = {
  backdrop:     0x34452e,
  meadow:       0x7fae4e,
  meadowDark:   0x67963f,
  meadowLight:  0x96c466,
  earth:        0x6b4a2b,
  path:         0xc2a174,
  pathEdge:     0xa6875a,
  cobble:       0x9a968c,
  cobbleDark:   0x7a766e,
  stone:        0xa8a397,     // pale limestone, the kingdom's building stone
  stoneDark:    0x7c786e,
  moss:         0x7aa652,
  wood:         0x7d5230,
  woodLight:    0xa8763f,
  water:        0x4fa3c9,
  waterDeep:    0x3b86ad,
  waterFoam:    0xd8f3fb,
  streamBed:    0x4a6f7a,
  gold:         0xe8b84a,
  cream:        0xf3e8d0,
  skin:         0xf2c8a0,
  tunic:        0x2f5d9e,     // royal blue: the King's livery
  capRed:       0xc23b32,     // heraldic red
  capBrown:     0x9c4a34,
  acorn:        0x9c6b3c,     // light leather
  acornCap:     0x6b4423,     // dark leather
  flowerPink:   0xe58ab8,
  flowerYellow: 0xf7d35e,
  magic:        0x8a5cd6,     // royal purple: the Court Magus and every specialization burst
  magicGlow:    0x9f7ff0,
  // the ravaged land around the Baron's camps
  hollowGround: 0x5e564d,
  hollowEarth:  0x3e3833,
  hollowPath:   0x6e6458,
  hollowWood:   0x3b3330,
  hollowRock:   0x85807a,
  spore:        0xd9632a,     // embers
  // the knaves
  goblin:       0x8a6a4a,     // brigand rags and leather
  goblinDark:   0x5a4430,
  bat:          0x7d7f86,     // gargoyle stone
  batDark:      0x55575e,
  batWing:      0x6a6c74,     // gargoyle wing membrane
  trickster:    0x7a3f5e,     // cutpurse plum
  tricksterDark: 0x522a3f,
  troll:        0x3f434c,     // black-knight plate
  trollDark:    0x2a2d33,
  cloak:        0x4e6b3a,     // yeoman green
  cloakDark:    0x34492a,
  frost:        0x9fdcf0,
  frostRobe:    0xdfeef5,
  outline:      0x1b1410,
  windowWarm:   0xffd36b,
  shadow:       0x000000,
  straw:        0xd8b04e,
  autumn:       0xd9822b,
  autumnDark:   0xa8561f,
  canvas:       0xe9dcc0,
  pine:         0x2f5548,
  snow:         0xeef4f2,
  // medieval additions
  steel:        0xb7bcc4,
  steelDark:    0x7e848e,
  plaster:      0xeee2c4,
  timber:       0x4a3426,
  roofTile:     0xb5543a,
  thatch:       0xc79c4a,
  slate:        0x5b6170,
  pitch:        0x24201e,
  ember:        0xff8a3d,
  baron:        0x221d24,     // the Black Baron's colors: black...
  baronRed:     0x9e2a2a,     // ...and blood red
  habit:        0x7a5a3a,     // friar brown
  heraldWhite:  0xf1ece0,
  dragon:       0x7a2f2f,
  dragonBelly:  0xd9a25a,
  dragonWing:   0x4e1f24,
};

const CONFIG = {
  border: 2,                 // decorative ring of tiles outside the grid
  tileHeight: 0.3,
  outlinePx: 2.2,            // outline thickness in CSS pixels
  maxPixelRatio: 2,
  cameraElevation: 50,       // degrees above the ground plane
  cameraYaw: 12,             // degrees, small so the grid stays readable
};
