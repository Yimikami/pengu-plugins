import { generateQuests, isQuestExpired, QUEST_TEMPLATES } from '../data/quests.js';

export class QuestManager {
  constructor(bus) {
    this.bus = bus;
    this.quests = { daily: [], weekly: [], repeatable: [] };
    this._trackCounts = {};
  }

  /**
   * Load quests from save, refresh expired ones.
   */
  load(savedQuests) {
    this.quests = savedQuests || { daily: [], weekly: [], repeatable: [] };
    if (!this.quests.repeatable) this.quests.repeatable = [];
    this._refreshExpired();
    this._ensureRepeatables();
    this._resetTrackCounts();
  }

  // Absolute-value tracks (set progress to value instead of incrementing)
  static ABSOLUTE_TRACKS = new Set(['winStreak', 'coinsEarned']);

  /**
   * Track a quest action. Most actions increment by `amount`.
   * Some (winStreak, coinsEarned) set an absolute accumulated value.
   * Returns array of newly completed quests.
   */
  track(action, amount = 1) {
    if (QuestManager.ABSOLUTE_TRACKS.has(action)) {
      this._trackCounts[action] = amount;
    } else {
      this._trackCounts[action] = (this._trackCounts[action] || 0) + amount;
    }

    const completed = [];

    for (const type of ['daily', 'weekly', 'repeatable']) {
      for (const quest of this.quests[type]) {
        if (quest.completed || quest.claimed) continue;
        if (quest.track !== action) continue;

        if (QuestManager.ABSOLUTE_TRACKS.has(action)) {
          quest.progress = Math.min(quest.target, this._trackCounts[action]);
        } else {
          quest.progress = Math.min(quest.target, quest.progress + amount);
        }

        if (quest.progress >= quest.target) {
          quest.completed = true;
          completed.push(quest);
          this.bus.emit('quest:completed', { quest });
        }
      }
    }

    return completed;
  }

  /**
   * Claim a completed quest's rewards. Returns { xp, coins } or null.
   * Repeatable quests reset instead of being marked claimed.
   */
  claim(questId) {
    for (const type of ['daily', 'weekly', 'repeatable']) {
      const quest = this.quests[type].find(q => q.id === questId && q.completed && !q.claimed);
      if (quest) {
        if (type === 'repeatable') {
          // Reset repeatable quest instead of claiming
          const reward = { xp: quest.xp, coins: quest.coins, quest };
          quest.progress = 0;
          quest.completed = false;
          return reward;
        } else {
          quest.claimed = true;
          return { xp: quest.xp, coins: quest.coins, quest };
        }
      }
    }
    return null;
  }

  /**
   * Get all active (non-claimed) quests.
   */
  getActive() {
    return {
      daily: this.quests.daily.filter(q => !q.claimed),
      weekly: this.quests.weekly.filter(q => !q.claimed),
      repeatable: this.quests.repeatable,
    };
  }

  serialize() {
    return { ...this.quests };
  }

  _refreshExpired() {
    const dailyExpired = this.quests.daily.length === 0 ||
      this.quests.daily.every(q => q.claimed || isQuestExpired(q));
    if (dailyExpired) {
      this.quests.daily = generateQuests('daily', 3);
    }

    const weeklyExpired = this.quests.weekly.length === 0 ||
      this.quests.weekly.every(q => q.claimed || isQuestExpired(q));
    if (weeklyExpired) {
      this.quests.weekly = generateQuests('weekly', 2);
    }
  }

  /**
   * Ensure 2 repeatable quests are always available.
   */
  _ensureRepeatables() {
    if (this.quests.repeatable.length >= 2) return;
    const pool = QUEST_TEMPLATES.repeatable || [];
    const existing = new Set(this.quests.repeatable.map(q => q.id));
    const available = pool.filter(t => !existing.has(t.id));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const needed = 2 - this.quests.repeatable.length;
    for (let i = 0; i < needed && i < shuffled.length; i++) {
      this.quests.repeatable.push({
        ...shuffled[i],
        type: 'repeatable',
        progress: 0,
        completed: false,
        claimed: false,
        createdAt: Date.now(),
      });
    }
  }

  _resetTrackCounts() {
    this._trackCounts = {};
  }
}
