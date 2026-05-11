import { XP_PER_QUEST, COINS_PER_QUEST } from './config.js';

export const QUEST_TEMPLATES = {
  daily: [
    { id: 'play_1',     name: 'Play 1 Game',          target: 1, track: 'gamesPlayed', xp: XP_PER_QUEST, coins: COINS_PER_QUEST },
    { id: 'win_1',      name: 'Win 1 Game',            target: 1, track: 'wins',        xp: XP_PER_QUEST, coins: COINS_PER_QUEST },
    { id: 'feed_1',     name: 'Feed Your Pengu',       target: 1, track: 'feeds',       xp: 20, coins: 15 },
    { id: 'pet_1',      name: 'Pet Your Pengu',         target: 1, track: 'pets',        xp: 15, coins: 10 },
    { id: 'play_2',     name: 'Play 2 Games',          target: 2, track: 'gamesPlayed', xp: XP_PER_QUEST + 15, coins: COINS_PER_QUEST + 10 },
    { id: 'shop_1',     name: 'Use a Shop Item',       target: 1, track: 'shopUses',    xp: 20, coins: 15 },
    { id: 'pet_3',      name: 'Pet Pengu 3 Times',     target: 3, track: 'pets',        xp: 25, coins: 20 },
    { id: 'feed_2',     name: 'Feed Pengu Twice',      target: 2, track: 'feeds',       xp: 25, coins: 20 },
    { id: 'shop_2',     name: 'Buy 2 Shop Items',      target: 2, track: 'shopUses',    xp: 30, coins: 25 },
    { id: 'interact_3', name: 'Interact 3 Times',      target: 3, track: 'interactions', xp: 20, coins: 15 },
    { id: 'hub_1',      name: 'Open the Hub',          target: 1, track: 'hubOpens',    xp: 10, coins: 10 },
    { id: 'mood_happy',  name: 'Keep Pengu Happy',     target: 1, track: 'moodHappy',   xp: 25, coins: 20 },
  ],
  weekly: [
    { id: 'play_5',     name: 'Play 5 Games',          target: 5,  track: 'gamesPlayed', xp: XP_PER_QUEST * 3, coins: COINS_PER_QUEST * 3 },
    { id: 'win_3',      name: 'Win 3 Games',            target: 3,  track: 'wins',        xp: XP_PER_QUEST * 3, coins: COINS_PER_QUEST * 3 },
    { id: 'feed_5',     name: 'Feed Pengu 5 Times',    target: 5,  track: 'feeds',       xp: XP_PER_QUEST * 2, coins: COINS_PER_QUEST * 2 },
    { id: 'play_10',    name: 'Play 10 Games',          target: 10, track: 'gamesPlayed', xp: XP_PER_QUEST * 5, coins: COINS_PER_QUEST * 5 },
    { id: 'win_5',      name: 'Win 5 Games',            target: 5,  track: 'wins',        xp: XP_PER_QUEST * 4, coins: COINS_PER_QUEST * 4 },
    { id: 'pet_10',     name: 'Pet Pengu 10 Times',    target: 10, track: 'pets',        xp: XP_PER_QUEST * 2, coins: COINS_PER_QUEST * 2 },
    { id: 'shop_5',     name: 'Use 5 Shop Items',      target: 5,  track: 'shopUses',    xp: XP_PER_QUEST * 3, coins: COINS_PER_QUEST * 3 },
    { id: 'interact_15', name: 'Interact 15 Times',    target: 15, track: 'interactions', xp: XP_PER_QUEST * 3, coins: COINS_PER_QUEST * 3 },
    { id: 'coins_100',  name: 'Earn 100 Coins',         target: 100, track: 'coinsEarned', xp: XP_PER_QUEST * 4, coins: COINS_PER_QUEST * 4 },
    { id: 'streak_3',   name: 'Win 3 in a Row',         target: 3,  track: 'winStreak',   xp: XP_PER_QUEST * 5, coins: COINS_PER_QUEST * 5 },
  ],
  // Repeatable quests — reset when claimed, always available
  repeatable: [
    { id: 'rep_win2',    name: 'Win 2 Games',          target: 2, track: 'wins',        xp: 25, coins: 20 },
    { id: 'rep_play3',   name: 'Play 3 Games',          target: 3, track: 'gamesPlayed', xp: 20, coins: 15 },
    { id: 'rep_pet5',    name: 'Pet Pengu 5 Times',    target: 5, track: 'pets',        xp: 15, coins: 10 },
    { id: 'rep_feed3',   name: 'Feed Pengu 3 Times',   target: 3, track: 'feeds',       xp: 15, coins: 10 },
    { id: 'rep_interact5', name: 'Interact 5 Times',   target: 5, track: 'interactions', xp: 20, coins: 15 },
  ],
};

/**
 * Generate new daily/weekly quests.
 * Picks `count` random quests from the template pool.
 */
export function generateQuests(type, count) {
  const pool = QUEST_TEMPLATES[type];
  if (!pool) return [];

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(template => ({
    ...template,
    type,
    progress: 0,
    completed: false,
    claimed: false,
    createdAt: Date.now(),
  }));
}

/**
 * Check if quests are expired.
 * Daily: 24h, Weekly: 7 days.
 */
export function isQuestExpired(quest) {
  const now = Date.now();
  const age = now - quest.createdAt;
  if (quest.type === 'daily') return age > 24 * 60 * 60 * 1000;
  if (quest.type === 'weekly') return age > 7 * 24 * 60 * 60 * 1000;
  return false;
}
