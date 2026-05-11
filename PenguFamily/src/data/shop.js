import { STAT_MAX, assetUrl } from './config.js';

export const SHOP_ITEMS = {
  snack: {
    id: 'snack',
    name: 'Snack',
    desc: 'A tasty fish snack',
    emoji: '🐟',
    icon: 'assets/sprites/ui/snack.png',
    price: 15,
    effect: { hunger: 25 },
    animation: 'eat',
    bubble: 'food',
  },
  treat: {
    id: 'treat',
    name: 'Treat',
    desc: 'A sweet treat that lifts spirits',
    emoji: '🍰',
    icon: 'assets/sprites/ui/treat.png',
    price: 25,
    effect: { hunger: 15, happiness: 10 },
    animation: 'eat',
    bubble: 'happy',
  },
  energy_drink: {
    id: 'energy_drink',
    name: 'Energy Drink',
    desc: 'Restores energy fast',
    emoji: '⚡',
    icon: 'assets/sprites/ui/energy_drink.png',
    price: 20,
    effect: { energy: 30 },
    animation: 'celebrate',
    bubble: 'excited',
  },
  toy: {
    id: 'toy',
    name: 'Toy',
    desc: 'A fun toy to play with',
    emoji: '🎾',
    icon: 'assets/sprites/ui/toy.png',
    price: 30,
    effect: { happiness: 25 },
    animation: 'celebrate',
    bubble: 'happy',
  },
  xp_boost: {
    id: 'xp_boost',
    name: 'XP Boost',
    desc: '2x XP for the next game',
    emoji: '✨',
    icon: 'assets/sprites/ui/xp_boost.png',
    price: 50,
    effect: { xpBoost: true },
    animation: 'ready',
    bubble: 'excited',
  },
  lullaby: {
    id: 'lullaby',
    name: 'Lullaby',
    desc: 'Puts pengu to sleep for 30 min. Fully restores energy!',
    emoji: '🌙',
    icon: 'assets/sprites/ui/lullaby.png',
    price: 35,
    effect: { energy: 100, setEnergy: true, sleep: true, sleepDuration: 30 * 60 * 1000 },
    animation: 'sleep',
    bubble: 'sleepy',
  },
};

export const SHOP_ITEM_IDS = Object.keys(SHOP_ITEMS);

/**
 * Apply a shop item's effect to a pengu.
 * Returns description of what happened.
 */
export function applyItem(pengu, itemId) {
  const item = SHOP_ITEMS[itemId];
  if (!item) return null;

  const changes = [];
  const eff = item.effect;

  if (eff.hunger) {
    const old = pengu.hunger;
    pengu.hunger = Math.min(STAT_MAX, pengu.hunger + eff.hunger);
    changes.push(`Hunger +${Math.round(pengu.hunger - old)}`);
  }
  if (eff.happiness) {
    const old = pengu.happiness;
    pengu.happiness = Math.min(STAT_MAX, pengu.happiness + eff.happiness);
    changes.push(`Happiness +${Math.round(pengu.happiness - old)}`);
  }
  if (eff.energy) {
    const old = pengu.energy;
    if (eff.setEnergy) {
      pengu.energy = eff.energy;
    } else {
      pengu.energy = Math.min(STAT_MAX, pengu.energy + eff.energy);
    }
    changes.push(`Energy +${Math.round(pengu.energy - old)}`);
  }

  pengu.computeMood();

  return {
    item,
    changes,
    animation: item.animation,
    bubble: item.bubble,
  };
}
