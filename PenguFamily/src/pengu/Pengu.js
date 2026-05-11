import { STAT_MAX, xpForLevel, FEED_HUNGER_RESTORE, PET_HAPPINESS_RESTORE, PET_COOLDOWN, stageForLevel } from '../data/config.js';

export class Pengu {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.archetype = data.archetype;
    this.stage = data.stage || 'baby';
    this.level = data.level || 1;
    this.xp = data.xp || 0;
    this.xpToNext = data.xpToNext || xpForLevel(1);
    this.hunger = data.hunger ?? 80;
    this.happiness = data.happiness ?? 90;
    this.energy = data.energy ?? 100;
    this.mood = data.mood || 'happy';
    this.bornAt = data.bornAt || Date.now();
    this.lastFedAt = data.lastFedAt || Date.now();
    this.lastPetAt = data.lastPetAt || 0;
    this.lastRestedAt = data.lastRestedAt || Date.now();
    this.equippedCosmetics = data.equippedCosmetics || {};
    this.stats = data.stats || { gamesPlayed: 0, wins: 0, losses: 0 };
  }

  computeMood() {
    const avg = (this.hunger + this.happiness + this.energy) / 3;
    if (avg >= 80) this.mood = 'ecstatic';
    else if (avg >= 60) this.mood = 'happy';
    else if (avg >= 40) this.mood = 'neutral';
    else if (avg >= 20) this.mood = 'sad';
    else this.mood = 'miserable';
    return this.mood;
  }

  addXP(amount) {
    this.xp += amount;
    let leveled = false;
    let evolved = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpForLevel(this.level);
      leveled = true;

      // Check evolution
      const newStage = stageForLevel(this.level);
      if (newStage !== this.stage) {
        this.stage = newStage;
        evolved = true;
      }
    }
    return { leveled, evolved };
  }

  feed() {
    this.hunger = Math.min(STAT_MAX, this.hunger + FEED_HUNGER_RESTORE);
    this.lastFedAt = Date.now();
    this.computeMood();
  }

  pet() {
    const now = Date.now();
    if (now - this.lastPetAt < PET_COOLDOWN) return false;
    this.happiness = Math.min(STAT_MAX, this.happiness + PET_HAPPINESS_RESTORE);
    this.lastPetAt = now;
    this.computeMood();
    return true;
  }

  applyWin() {
    this.happiness = Math.min(STAT_MAX, this.happiness + 20);
    this.hunger = Math.min(STAT_MAX, this.hunger + 10);
    this.stats.gamesPlayed++;
    this.stats.wins++;
    this.computeMood();
  }

  applyLoss() {
    this.happiness = Math.max(0, this.happiness - 5);
    this.energy = Math.max(0, this.energy - 5);
    this.stats.gamesPlayed++;
    this.stats.losses++;
    this.computeMood();
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      archetype: this.archetype,
      stage: this.stage,
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext,
      hunger: this.hunger,
      happiness: this.happiness,
      energy: this.energy,
      mood: this.mood,
      bornAt: this.bornAt,
      lastFedAt: this.lastFedAt,
      lastPetAt: this.lastPetAt,
      lastRestedAt: this.lastRestedAt,
      equippedCosmetics: this.equippedCosmetics,
      stats: this.stats,
    };
  }
}
