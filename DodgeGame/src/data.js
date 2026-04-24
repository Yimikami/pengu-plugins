// ---------------------------------------------------------------------------
// Playable champion list (alias matches cdn.modelviewer.lol URL slug).
// `baseMs` is the in-game base movement speed at level 1 (League Wiki).
// ---------------------------------------------------------------------------
export const CHAMPIONS = [
  { id: 1,   alias: "annie",      name: "Annie",      baseMs: 335 },
  { id: 25,  alias: "morgana",    name: "Morgana",    baseMs: 335 },
  { id: 51,  alias: "caitlyn",    name: "Caitlyn",    baseMs: 325 },
  { id: 53,  alias: "blitzcrank", name: "Blitzcrank", baseMs: 325 },
  { id: 61,  alias: "orianna",    name: "Orianna",    baseMs: 335 },
  { id: 76,  alias: "nidalee",    name: "Nidalee",    baseMs: 335 },
  { id: 81,  alias: "ezreal",     name: "Ezreal",     baseMs: 325 },
  { id: 99,  alias: "lux",        name: "Lux",        baseMs: 330 },
  { id: 101, alias: "xerath",     name: "Xerath",     baseMs: 340 },
  { id: 103, alias: "ahri",       name: "Ahri",       baseMs: 330 },
  { id: 112, alias: "viktor",     name: "Viktor",     baseMs: 335 },
  { id: 134, alias: "syndra",     name: "Syndra",     baseMs: 330 },
  { id: 157, alias: "yasuo",      name: "Yasuo",      baseMs: 345 },
  { id: 222, alias: "jinx",       name: "Jinx",       baseMs: 325 },
  { id: 238, alias: "zed",        name: "Zed",        baseMs: 345 },
];

export const championById = (id) => CHAMPIONS.find((c) => c.id === id);

// Convert LoL "units per second" movement speed to world units.
// 330 LoL MS maps to ~4.5 world u/s, which felt good in testing.
export const MS_TO_WORLD = 4.5 / 330;

// ---------------------------------------------------------------------------
// Iconic abilities with 3D-world mechanics.
//   LINEAR     — straight-line skillshot
//   BOOMERANG  — line skillshot that returns (Ahri Q)
//   AOE_CIRCLE — circular ground AOE (telegraph → detonation)
//   BEAM       — static rectangular beam (Lux R / Viktor E)
//
// `smart: true` AOEs lock onto the player at cast time.
// `slot` = Q/W/E/R, used to pick the caster's Spell1/2/3/4 animation clip.
// Numbers are tuned for player speed ~7 u/s and arena ±14.
// ---------------------------------------------------------------------------
export const SKILLS = [
  { id: "blitz_q", champId: 53,  champ: "Blitzcrank", spell: "Rocket Grab",             slot: "Q", type: "LINEAR",     width: 1.2, speed: 9,  telegraph: 700,  color: 0xffd56b, diff: 1 },
  { id: "ez_q",    champId: 81,  champ: "Ezreal",     spell: "Mystic Shot",             slot: "Q", type: "LINEAR",     width: 0.7, speed: 22, telegraph: 280,  color: 0xf1c40f, diff: 2 },
  { id: "lux_q",   champId: 99,  champ: "Lux",        spell: "Light Binding",           slot: "Q", type: "LINEAR",     width: 1.1, speed: 14, telegraph: 450,  color: 0xffe066, diff: 1 },
  { id: "lux_r",   champId: 99,  champ: "Lux",        spell: "Final Spark",             slot: "R", type: "BEAM",       width: 2.4,            telegraph: 900,  activeTime: 500, color: 0xfff066, diff: 3 },
  { id: "morg_q",  champId: 25,  champ: "Morgana",    spell: "Dark Binding",            slot: "Q", type: "LINEAR",     width: 1.1, speed: 12, telegraph: 500,  color: 0x9b59b6, diff: 1 },
  { id: "nid_q",   champId: 76,  champ: "Nidalee",    spell: "Javelin Toss",            slot: "Q", type: "LINEAR",     width: 0.55, speed: 28, telegraph: 220, color: 0xe67e22, diff: 3 },
  { id: "xer_q",   champId: 101, champ: "Xerath",     spell: "Arcanopulse",             slot: "Q", type: "LINEAR",     width: 1.6, speed: 18, telegraph: 750,  color: 0xa66bff, diff: 2 },
  { id: "ahri_q",  champId: 103, champ: "Ahri",       spell: "Orb of Deception",        slot: "Q", type: "BOOMERANG",  width: 1.0, speed: 13, range: 14, telegraph: 350, color: 0xff6bcb, diff: 2 },
  { id: "syn_q",   champId: 134, champ: "Syndra",     spell: "Dark Sphere",             slot: "Q", type: "AOE_CIRCLE", radius: 1.8,           telegraph: 650,  activeTime: 180, color: 0xb16bff, diff: 1, smart: true },
  { id: "jinx_r",  champId: 222, champ: "Jinx",       spell: "Super Mega Death Rocket", slot: "R", type: "AOE_CIRCLE", radius: 3.6,           telegraph: 1200, activeTime: 250, color: 0xff4d4d, diff: 2, smart: true },
  { id: "ori_r",   champId: 61,  champ: "Orianna",    spell: "Command: Shockwave",      slot: "R", type: "AOE_CIRCLE", radius: 2.8,           telegraph: 950,  activeTime: 200, color: 0x6bd5ff, diff: 2, smart: true },
  { id: "annie_r", champId: 1,   champ: "Annie",      spell: "Summon: Tibbers",         slot: "R", type: "AOE_CIRCLE", radius: 2.4,           telegraph: 700,  activeTime: 220, color: 0xff7a3d, diff: 2, smart: true },
  { id: "vik_e",   champId: 112, champ: "Viktor",     spell: "Death Ray",               slot: "E", type: "BEAM",       width: 1.5,            telegraph: 550,  activeTime: 400, color: 0xb87bff, diff: 2 },
  { id: "zed_q",   champId: 238, champ: "Zed",        spell: "Razor Shuriken",          slot: "Q", type: "LINEAR",     width: 0.8, speed: 22, telegraph: 260,  color: 0xef4444, diff: 2 },
  { id: "yas_q",   champId: 157, champ: "Yasuo",      spell: "Steel Tempest",           slot: "Q", type: "LINEAR",     width: 0.75, speed: 28, telegraph: 220, color: 0x7ad7ff, diff: 3 },
  { id: "cait_r",  champId: 51,  champ: "Caitlyn",    spell: "Ace in the Hole",         slot: "R", type: "LINEAR",     width: 0.6, speed: 36, telegraph: 1400, color: 0xf0e6d2, diff: 3 },
];

// Helper: map spell slot letter → Spell1..Spell4 clip index (1-based).
export const SLOT_TO_SPELL_NUM = { Q: 1, W: 2, E: 3, R: 4 };
