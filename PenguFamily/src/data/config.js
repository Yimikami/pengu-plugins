export const VERSION = 1;
export const SAVE_PREFIX = 'pengu-family.save';
export const SETTINGS_KEY = 'pengu-family.settings';

// Compute plugin root from wherever this module is loaded
const _meta = import.meta.url;
const _base = _meta.substring(0, _meta.lastIndexOf('/src/'));
export const PLUGIN_BASE = _base + '/';

export function assetUrl(path) {
  return PLUGIN_BASE + path;
}

// Fallback: if running outside Pengu Loader, use relative paths
export function assetUrlSafe(path) {
  try {
    return PLUGIN_BASE + path;
  } catch {
    return './' + path;
  }
}

// Display
export const PENGU_SIZE = 120; // px display size
export const OVERLAY_Z = 9000;

// Movement
export const WANDER_MIN_INTERVAL = 8000;  // ms
export const WANDER_MAX_INTERVAL = 15000;
export const MOVE_SPEED = 1.5;            // px per frame (~60fps)
export const EDGE_MARGIN = 60;            // px from screen edges

// Stats
export const STAT_MIN = 0;
export const STAT_MAX = 100;
export const HUNGER_DECAY_PER_HOUR = 12;
export const HAPPINESS_DECAY_PER_HOUR = 8;
export const ENERGY_DECAY_PER_HOUR = 6;
export const ENERGY_RESTORE_PER_HOUR_OFFLINE = 5;

// Rewards
export const XP_PER_WIN = 30;
export const XP_PER_LOSS = 15;
export const COINS_PER_WIN = 15;
export const COINS_PER_LOSS = 8;
export const XP_PER_QUEST = 45;
export const COINS_PER_QUEST = 30;

// Feeding
export const FEED_HUNGER_RESTORE = 25;
export const PET_HAPPINESS_RESTORE = 15;
export const PET_COOLDOWN = 300000; // 5 min

// Leveling
export const BASE_XP_TO_LEVEL = 100;
export const XP_SCALE_FACTOR = 1.15;

export function xpForLevel(level) {
  return Math.floor(BASE_XP_TO_LEVEL * Math.pow(XP_SCALE_FACTOR, level - 1));
}

// Evolution stages
export const STAGES = ['baby', 'adult', 'elder'];
export const STAGE_THRESHOLDS = {
  baby: 0,    // start
  adult: 10,  // level 10
  elder: 25,  // level 25
};

export function stageForLevel(level) {
  if (level >= STAGE_THRESHOLDS.elder) return 'elder';
  if (level >= STAGE_THRESHOLDS.adult) return 'adult';
  return 'baby';
}
