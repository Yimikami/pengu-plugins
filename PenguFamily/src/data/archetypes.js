export const ARCHETYPES = {
  windblade: {
    id: 'windblade',
    name: 'Windblade',
    title: 'The Swift Blade',
    personality: 'brave',
    color: '#4A90D9',
    glow: 'rgba(74, 144, 217, 0.4)',
    // AI personality traits
    mouseReaction: 'chase',    // chases cursor playfully
    mouseFleeChance: 0.1,     // rarely flees
    wanderSpeed: 1.4,         // fast wanderer
    hungryBehavior: 'nudge',  // nudges UI elements when hungry
    dragReaction: 'enjoy',    // loves being carried around
    greetings: [
      "Let's fight together!",
      "The wind guides us!",
      "Ready for battle!",
    ],
    winReaction: "That was a clean victory!",
    lossReaction: "We'll get them next time.",
    petReaction: "Heh... not bad.",
  },
  shadow: {
    id: 'shadow',
    name: 'Shadow',
    title: 'The Silent Blade',
    personality: 'mysterious',
    color: '#7B2D8E',
    glow: 'rgba(123, 45, 142, 0.4)',
    mouseReaction: 'flee',     // always flees from cursor
    mouseFleeChance: 0.9,     // almost always flees
    wanderSpeed: 1.0,         // normal speed
    hungryBehavior: 'sulk',   // goes to corner and sulks
    dragReaction: 'hate',     // hates being touched
    greetings: [
      "...you'll do.",
      "From the shadows, we strike.",
      "Silence is our weapon.",
    ],
    winReaction: "...as expected.",
    lossReaction: "Darkness will have its revenge.",
    petReaction: "...don't tell anyone about this.",
  },
  starlight: {
    id: 'starlight',
    name: 'Starlight',
    title: 'The Cosmic Mage',
    personality: 'cheerful',
    color: '#E891C0',
    glow: 'rgba(232, 145, 192, 0.4)',
    mouseReaction: 'follow',   // gently follows cursor
    mouseFleeChance: 0.05,    // almost never flees
    wanderSpeed: 0.9,         // gentle wanderer
    hungryBehavior: 'beg',    // follows cursor and begs
    dragReaction: 'love',     // loves cuddling and being held
    greetings: [
      "I'm so happy to meet you!",
      "The stars brought us together!",
      "Let's make magic!",
    ],
    winReaction: "I'm SO proud of you!",
    lossReaction: "It's okay, the stars still shine for us!",
    petReaction: "Heehee~ that tickles!",
  },
  chaos: {
    id: 'chaos',
    name: 'Chaos',
    title: 'The Mad Inventor',
    personality: 'chaotic',
    color: '#FF6B8A',
    glow: 'rgba(255, 107, 138, 0.4)',
    mouseReaction: 'random',   // unpredictable — sometimes chases, sometimes flees
    mouseFleeChance: 0.5,     // 50/50
    wanderSpeed: 1.6,         // hyperactive
    hungryBehavior: 'tantrum', // zips around frantically
    dragReaction: 'chaotic',  // wiggles and acts unpredictable
    greetings: [
      "BOOM! Let's go!",
      "Time for some EXPERIMENTS!",
      "Don't touch that button! ...okay touch it.",
    ],
    winReaction: "KABOOM! We did it!",
    lossReaction: "Back to the drawing board... MORE EXPLOSIONS!",
    petReaction: "Careful! I might explode! ...in a good way!",
  },
  royal: {
    id: 'royal',
    name: 'Royal',
    title: 'The Sovereign',
    personality: 'regal',
    color: '#9B59B6',
    glow: 'rgba(155, 89, 182, 0.4)',
    mouseReaction: 'ignore',   // too dignified to react
    mouseFleeChance: 0.2,     // occasionally moves away with dignity
    wanderSpeed: 0.7,         // slow, regal pace
    hungryBehavior: 'demand',  // stops and demands food
    dragReaction: 'offended', // finds being dragged undignified
    greetings: [
      "You are worthy of our presence.",
      "A noble partnership begins.",
      "The crown chooses wisely.",
    ],
    winReaction: "A victory befitting royalty.",
    lossReaction: "Even kings face setbacks. We shall persevere.",
    petReaction: "You may... continue.",
  },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES);

export function randomArchetype() {
  return ARCHETYPE_IDS[Math.floor(Math.random() * ARCHETYPE_IDS.length)];
}
