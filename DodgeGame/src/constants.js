// ---------------------------------------------------------------------------
// Plugin-wide constants
// ---------------------------------------------------------------------------
export const CONFIG = {
  debug: { enabled: false, prefix: "[DodgeGame]" },
  OVERLAY_ID: "dodge-game-overlay",
  DATASTORE_KEY_BEST: "dodge-game.highscore",
  DATASTORE_KEY_CHAMP: "dodge-game.lastChampion",
  DATASTORE_KEY_KEYS: "dodge-game.keybinds",
  ENDPOINTS: {
    summoner: "/lol-summoner/v1/current-summoner",
    profileIcon: (id) => `/lol-game-data/assets/v1/profile-icons/${id}.jpg`,
    championIcon: (id) => `/lol-game-data/assets/v1/champion-icons/${id}.png`,
  },
  CDN: {
    three: "https://esm.sh/three@0.169.0",
    gltfLoader: "https://esm.sh/three@0.169.0/examples/jsm/loaders/GLTFLoader.js",
    modelBase: "https://cdn.modelviewer.lol/lol/models",
  },
};

// ---------------------------------------------------------------------------
// Summoner spells. Cooldowns are shorter than retail LoL because the dodge
// game sessions are ~1–2 minutes, not a whole match.
// Icons are served by the LoL Client's game-data plugin.
// ---------------------------------------------------------------------------
export const SPELLS = {
  flash: {
    id: "flash",
    name: "Flash",
    iconUrl: "/lol-game-data/assets/DATA/Spells/Icons2D/Summoner_Flash.png",
    defaultKey: "d",
    cooldown: 30000,   // ms
    distance: 5.5,     // world units (~425 LoL range)
    color: 0xfff2b0,
  },
  ghost: {
    id: "ghost",
    name: "Ghost",
    // Ghost's internal Riot name is "Haste" — so is its icon file.
    iconUrl: "/lol-game-data/assets/DATA/Spells/Icons2D/Summoner_Haste.png",
    defaultKey: "f",
    cooldown: 22000,   // ms
    duration: 5000,    // ms of speed boost
    speedMult: 1.45,   // +45 %
    color: 0x88ccff,
  },
};

// 3D-world tuning. Units are world units. `playerSpeed` is a fallback used
// only when the champion has no `baseMs` entry.
export const WORLD = {
  arenaSize: 30,
  arenaBound: 14,
  playerHeight: 1.8,
  playerRadius: 0.55,
  playerSpeed: 4.5,         // fallback
  waveDurationMs: 15000,
  hitY: 0.9,
  graceMs: 2000,            // invulnerability at start
  firstSpawnDelayMs: 1500,  // no skills during grace
};

export const debug = (...args) => {
  if (CONFIG.debug.enabled) console.log(CONFIG.debug.prefix, ...args);
};
