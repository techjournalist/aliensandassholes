// ===================================================================
// PALETTE / CONFIG  (fix colors here, never invent new ones in assets)
// Level-agnostic only: grid size, path, waves, etc. live per-level in
// js/level*.js (see js/levels.js for the registry).
//
// Aliens & Assholes: a little farming colony on a far moon. Teal moonmoss,
// lilac dust roads, violet rock and neon crystal outcrops under an indigo
// sky; the colony itself is white hull plating with teal trim and warm
// windows. The engine's "hollow*" keys are its danger-zone colors; here
// they are the crust of alien goo that spreads out of every landing pod,
// dark violet with an acid-lime glow.
// The key names are the engine's (meadow, wood, acorn and so on); the
// comments say what each one paints in this game.
// ===================================================================
const PALETTE = {
  backdrop:     0x1d1838,     // the indigo sky at the edge of the world
  meadow:       0x3aa89a,     // teal moonmoss
  meadowDark:   0x2a8a84,
  meadowLight:  0x5fd0b8,
  earth:        0x47386a,     // violet regolith under the moss
  path:         0xcab8e6,     // lilac dust roads
  pathEdge:     0xa492c6,
  cobble:       0x9ea8bf,     // colony deck plating near the domes
  cobbleDark:   0x78829c,
  stone:        0x9a92ba,     // moon rock
  stoneDark:    0x6c6690,
  moss:         0x56c79e,
  wood:         0x5c5080,     // composite struts, posts and frames
  woodLight:    0x8a7cb4,
  water:        0x3ce4d2,     // glowing irrigation water
  waterDeep:    0x1fa2b2,
  waterFoam:    0xdcfff7,
  streamBed:    0x24546c,
  gold:         0xffc84a,     // credits, highlights and trim
  cream:        0xf4f0fc,
  skin:         0xf2c8a0,     // the colonists
  tunic:        0x2bb3a8,     // colony teal: the uniform and the flags
  capRed:       0xff5d73,     // neon coral accents
  capBrown:     0xc0567a,
  acorn:        0x9a6ac0,     // soft violet gear (straps, pads, satchels)
  acornCap:     0x5e4482,
  flowerPink:   0xff6fd8,
  flowerYellow: 0xffe36e,
  magic:        0xb45cff,     // neon purple: the cryo coils, every specialization burst
  magicGlow:    0xd58cff,
  // the alien goo crust around the landing pods
  hollowGround: 0x3a2350,
  hollowEarth:  0x26163c,
  hollowPath:   0x5c3d7a,
  hollowWood:   0x2e1e46,
  hollowRock:   0x6c5a8e,
  spore:        0x9dff4a,     // acid-lime alien glow
  // the invaders
  goblin:       0x8fe04c,     // blob drone lime
  goblinDark:   0x55a02c,
  bat:          0xbfc7dc,     // saucer scout hull
  batDark:      0x7c84a0,
  batWing:      0x9aa2be,
  trickster:    0xd64ad6,     // skitter crawler magenta
  tricksterDark: 0x8a2a96,
  troll:        0x5e4c8e,     // armored brute shell
  trollDark:    0x3a2e5e,
  cloak:        0x2f6f9a,     // missile crew blue
  cloakDark:    0x1f4a6a,
  frost:        0x9ff0ff,
  frostRobe:    0xe2f6ff,
  outline:      0x150f24,
  windowWarm:   0xffd36b,
  shadow:       0x000000,
  straw:        0xe8c25a,     // ripe crops and hay bales
  autumn:       0xff9a4a,
  autumnDark:   0xc8602a,
  canvas:       0xeae4f6,
  pine:         0x245a6a,
  snow:         0xeef6ff,
  // colony hardware
  steel:        0xc4ccdc,
  steelDark:    0x7e88a2,
  plaster:      0xeef1f8,     // white hull panels
  timber:       0x3e3a5e,     // dark panel seams
  roofTile:     0xff8a4c,     // hazard orange roofs and stripes
  thatch:       0x48c0b0,     // teal solar roofs
  slate:        0x4c5280,
  pitch:        0x2a1c3e,     // goo-cannon goo, dark
  ember:        0xff8a3d,
  baron:        0x2a1c40,     // the invaders' colors: deep violet...
  baronRed:     0x9dff4a,     // ...and acid lime
  habit:        0x6a7aa0,     // mech and cannon gunmetal
  heraldWhite:  0xf2f4fa,
  dragon:       0x3a6ad8,     // sky manta
  dragonBelly:  0x9ff0ff,
  dragonWing:   0x6a3ad0,
  // new for this game
  glass:        0xbff4ff,     // dome glass
  neon:         0x39f0ff,     // cyan running lights
  crystal:      0xc77dff,     // violet crystal outcrops
  crystalTeal:  0x45f0d8,
  hull:         0xe6eaf4,
  hullDark:     0xa4aec8,
  hazard:       0xffa53d,
  solar:        0x3a4c9a,
  goo:          0x9dff4a,
  gooDark:      0x4c9a24,
  visor:        0xff9a3d,     // colonists' orange visors
  sand:         0xe4c08a,
  sandDark:     0xb88c5a,
  ice:          0xcdf4ff,
  lava:         0xff4fd0,     // the plasma rift's hot pink
};

const CONFIG = {
  border: 2,                 // decorative ring of tiles outside the grid
  tileHeight: 0.3,
  outlinePx: 2.2,            // outline thickness in CSS pixels
  maxPixelRatio: 2,
  cameraElevation: 50,       // degrees above the ground plane
  cameraYaw: 12,             // degrees, small so the grid stays readable
};
