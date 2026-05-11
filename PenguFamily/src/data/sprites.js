// Sprite frame names for each category
export const PENGU_FRAMES = ['idle', 'blink', 'walk', 'alert', 'ready', 'celebrate', 'attack', 'sleep'];
export const EGG_FRAMES = ['idle', 'blink', 'wobble1', 'wobble2', 'wobble3', 'happy', 'crack', 'sleep'];

// Animation state → which frames to cycle through + timing
export const ANIMATIONS = {
  idle:       { frames: ['idle', 'idle', 'blink', 'idle'], duration: 3000, loop: true },
  walk:       { frames: ['walk'], duration: 800, loop: true },
  celebrate:  { frames: ['celebrate'], duration: 2000, loop: false },
  attack:     { frames: ['attack'], duration: 1500, loop: false },
  sleep:      { frames: ['sleep'], duration: 3000, loop: true },
  alert:      { frames: ['alert'], duration: 1200, loop: false },
  ready:      { frames: ['ready'], duration: 1000, loop: false },
  pet:        { frames: ['celebrate', 'blink', 'celebrate'], duration: 1500, loop: false },
  sad:        { frames: ['sleep'], duration: 2000, loop: false },
  eat:        { frames: ['blink', 'celebrate'], duration: 1500, loop: false },
};

export const EGG_ANIMATIONS = {
  idle:    { frames: ['idle', 'idle', 'blink', 'idle'], duration: 3000, loop: true },
  wobble1: { frames: ['wobble1', 'idle', 'wobble2'], duration: 1000, loop: false },
  wobble2: { frames: ['wobble1', 'wobble2', 'wobble1', 'wobble2'], duration: 800, loop: false },
  wobble3: { frames: ['wobble1', 'wobble2', 'wobble3', 'happy'], duration: 600, loop: false },
  crack:   { frames: ['wobble3', 'crack'], duration: 1200, loop: false },
  sleep:   { frames: ['sleep'], duration: 3000, loop: true },
};

export function penguSpritePath(archetype, stage, frame) {
  return `assets/sprites/pengus/${archetype}/${stage}/${frame}.png`;
}

export function eggSpritePath(archetype, frame) {
  return `assets/sprites/eggs/${archetype}/${frame}.png`;
}

export function chatBubblePath(archetype, bubbleName) {
  return `assets/sprites/ui/${archetype}/${bubbleName}.png`;
}

// Map mood/state → chat bubble name
export const BUBBLE_MAP = {
  happy: 'bubble_happy',
  normal: 'bubble_normal',
  thought: 'bubble_thought',
  excited: 'bubble_excited',
  sleepy: 'bubble_sleepy',
  sad: 'bubble_sad',
  food: 'icon_food',
  quest: 'icon_quest',
  levelup: 'icon_levelup',
  alert: 'icon_alert',
};
