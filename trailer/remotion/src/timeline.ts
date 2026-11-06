// The edit, in seconds. Shots play back to back; `use` is how much of each
// captured clip makes the cut (captures run a little long for safety).
export const FPS = 30;

export type Shot = { id: string; use: number };
export const SHOTS: Shot[] = [
  { id: "s01_title", use: 3.4 },
  { id: "s02_landing", use: 3.0 },
  { id: "s03_crawl", use: 7.0 },
  { id: "s04_build", use: 5.8 },
  { id: "s05_laser", use: 2.9 },
  { id: "s06_goo", use: 2.9 },
  { id: "s07_cryo", use: 4.0 },
  { id: "s08_mech", use: 3.2 },
  { id: "s09_missile", use: 3.6 },
  { id: "s10_upgrade", use: 8.0 },
  { id: "s11_specialists", use: 4.6 },
  { id: "s12_waves", use: 10.0 },
  { id: "s13_jumppads", use: 3.0 },
  { id: "s14_warp", use: 3.0 },
  { id: "s15_drill", use: 3.6 },
  { id: "s16_worm", use: 1.1 },
  { id: "s17_manta", use: 1.2 },
  { id: "s18_mothership", use: 3.0 },
  { id: "s19_map", use: 4.0 },
  { id: "s20_victory", use: 3.0 },
  { id: "s21_endbg", use: 5.7 },
];

// start time of every shot
export const SHOT_START: Record<string, number> = {};
{
  let t = 0;
  for (const s of SHOTS) {
    SHOT_START[s.id] = t;
    t += s.use;
  }
}
export const TOTAL = SHOTS.reduce((a, s) => a + s.use, 0);

// voiceover lines: file, start (s), length (s)
export const VO: { file: string; at: number; len: number }[] = [
  { file: "01_intro", at: 0.4, len: 5.06 },
  { file: "02_aliens", at: 6.6, len: 6.64 },
  { file: "03_build", at: 13.6, len: 5.36 },
  { file: "04_laser", at: 19.35, len: 2.48 },
  { file: "05_goo", at: 22.25, len: 2.48 },
  { file: "06_cryo", at: 25.1, len: 3.8 },
  { file: "07_mech", at: 29.1, len: 2.92 },
  { file: "08_missile", at: 32.3, len: 3.29 },
  { file: "09_upgrade", at: 36.0, len: 12.1 },
  { file: "10_waves", at: 48.6, len: 9.64 },
  { file: "11_terrain", at: 58.6, len: 5.46 },
  { file: "12_bosses", at: 64.6, len: 7.34 },
  { file: "13_map", at: 73.5, len: 6.38 },
  { file: "14_end", at: 80.8, len: 4.61 },
];

// on-screen captions: text, start, end (s), style
export type Cap = { text: string; sub?: string; from: number; to: number; kind: "tag" | "big" | "pair"; pos?: "top" };
export const CAPTIONS: Cap[] = [
  { text: "Tumble", sub: "a tiny farming moon", from: 3.6, to: 6.3, kind: "tag" },
  { text: "The aliens have landed", sub: "and they are total assholes", from: 8.4, to: 13.2, kind: "big" },
  { text: "Build towers", sub: "tap a pad beside the road", from: 16.0, to: 19.0, kind: "tag", pos: "top" },
  { text: "Laser Turret", sub: "fast and cheap", from: 19.4, to: 22.0, kind: "tag" },
  { text: "Goo Cannon", sub: "glues crowds in place", from: 22.3, to: 24.9, kind: "tag" },
  { text: "Cryo Beam", sub: "slows everything, hits flyers", from: 25.2, to: 28.9, kind: "tag" },
  { text: "Mech Walker", sub: "one giant rocket fist", from: 29.2, to: 32.1, kind: "tag" },
  { text: "Missile Pod", sub: "long-range splash damage", from: 32.4, to: 35.7, kind: "tag" },
  { text: "Upgrade", sub: "every alien popped pays credits", from: 36.2, to: 41.0, kind: "tag", pos: "top" },
  { text: "Railgun", sub: "Twin Blaster", from: 41.5, to: 43.7, kind: "pair" },
  { text: "Glue Bomber", sub: "Acid Mortar", from: 43.8, to: 45.7, kind: "pair" },
  { text: "Choose wisely", sub: "specialists are permanent", from: 45.9, to: 48.3, kind: "big" },
  { text: "Blob Drones", from: 48.6, to: 49.7, kind: "tag" },
  { text: "Skitter Crawlers", from: 49.85, to: 51.0, kind: "tag" },
  { text: "Armored Brutes", from: 51.2, to: 52.3, kind: "tag" },
  { text: "Saucer Scouts", from: 52.35, to: 53.6, kind: "tag" },
  { text: "Up to 8x speed", sub: "every wave gets meaner", from: 54.4, to: 58.3, kind: "big" },
  { text: "Jump pads", from: 59.6, to: 61.4, kind: "tag" },
  { text: "Warp gates", sub: "and high ground", from: 61.5, to: 64.2, kind: "tag" },
  { text: "Every battle ends with a boss", from: 64.7, to: 66.9, kind: "big" },
  { text: "The Drill Tank", from: 67.0, to: 68.0, kind: "tag" },
  { text: "The Sand Worm", from: 68.05, to: 69.1, kind: "tag" },
  { text: "The Sky Manta", from: 69.15, to: 70.3, kind: "tag" },
  { text: "The Mothership", from: 70.4, to: 73.2, kind: "tag" },
  { text: "10 battles", sub: "2 difficulty tiers", from: 73.6, to: 77.2, kind: "tag" },
  { text: "Earn your stars", sub: "then go Endless", from: 77.4, to: 80.2, kind: "tag" },
];

// moments that get a flash cut
export const FLASHES = [48.4, 64.4, 80.3];

// magnified views of the game's own panels: crop of the shot's frame, shown
// at the right side while the panel is open (frames are shot-relative)
export const INSETS = [
  { shot: "s04_build", from: 22, to: 68, crop: { x: 0, y: 695, w: 460, h: 385 }, scale: 1.55 },
  { shot: "s10_upgrade", from: 26, to: 236, crop: { x: 0, y: 800, w: 460, h: 275 }, scale: 1.75 },
];
