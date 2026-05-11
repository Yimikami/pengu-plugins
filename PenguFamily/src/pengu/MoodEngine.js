import { HUNGER_DECAY_PER_HOUR, HAPPINESS_DECAY_PER_HOUR, ENERGY_DECAY_PER_HOUR, ENERGY_RESTORE_PER_HOUR_OFFLINE, STAT_MAX } from '../data/config.js';

export class MoodEngine {
  constructor(bus) {
    this.bus = bus;
    this._interval = null;
  }

  start(pengu) {
    this.pengu = pengu;
    // Decay stats every 60 seconds
    this._interval = setInterval(() => this._tick(), 60000);
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  processOfflineTime(pengu, lastLoginAt) {
    const hours = (Date.now() - lastLoginAt) / 3600000;
    if (hours < 0.05) return; // < 3 min, skip

    pengu.hunger = Math.max(10, pengu.hunger - (HUNGER_DECAY_PER_HOUR * hours));
    pengu.happiness = Math.max(15, pengu.happiness - (HAPPINESS_DECAY_PER_HOUR * hours));
    pengu.energy = Math.min(STAT_MAX, pengu.energy + (ENERGY_RESTORE_PER_HOUR_OFFLINE * hours));
    pengu.computeMood();

    console.log(`[MoodEngine] Offline ${hours.toFixed(1)}h → H:${pengu.hunger.toFixed(0)} Ha:${pengu.happiness.toFixed(0)} E:${pengu.energy.toFixed(0)}`);
  }

  _tick() {
    if (!this.pengu) return;
    const decayPerTick = 1 / 60; // 1 minute = 1/60 hour

    this.pengu.hunger = Math.max(0, this.pengu.hunger - (HUNGER_DECAY_PER_HOUR * decayPerTick));
    this.pengu.happiness = Math.max(0, this.pengu.happiness - (HAPPINESS_DECAY_PER_HOUR * decayPerTick));
    this.pengu.energy = Math.max(0, this.pengu.energy - (ENERGY_DECAY_PER_HOUR * decayPerTick));

    const oldMood = this.pengu.mood;
    this.pengu.computeMood();

    if (this.pengu.mood !== oldMood) {
      this.bus.emit('pengu:mood', { mood: this.pengu.mood, prev: oldMood });
    }

    this.bus.emit('pengu:stats', {
      hunger: this.pengu.hunger,
      happiness: this.pengu.happiness,
      energy: this.pengu.energy,
      mood: this.pengu.mood,
    });
  }
}
