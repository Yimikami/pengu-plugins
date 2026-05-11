/**
 * Dialogue lines for pengu chat bubbles.
 * Organized by trigger → archetype-specific + generic lines.
 */

// ── Idle chatter (random, every 30-90s) ──
export const IDLE_LINES = {
  _generic: [
    '*yawn*', '♪ ♪ ♪', '...', '*waddles*', '*looks around*',
    'Nice weather today!', '*stretches*', 'Hmm...', '*blinks*',
  ],
  chaos: [
    'Chaos reigns!', 'Let\'s break something!', '*evil giggle*',
    'I smell destruction...', 'Boom?', 'Rules are boring!',
  ],
  shadow: [
    '...', '*lurks*', 'The shadows whisper...', '*vanishes briefly*',
    'Did you see that?', 'Stay alert.', 'Silence is golden.',
  ],
  starlight: [
    '✨ Sparkle!', 'The stars are beautiful!', '*twinkles*',
    'Believe in yourself!', 'Light the way~', 'So pretty!',
  ],
  windblade: [
    '*whoosh*', 'Gotta go fast!', 'Feel the breeze~',
    '*zips around*', 'Can\'t catch me!', 'Wind at my back!',
  ],
  royal: [
    'Hmph.', 'Bow before me.', '*adjusts crown*',
    'This is acceptable.', 'Peasants...', 'I demand snacks.',
  ],
};

// ── Mood-based status lines ──
export const MOOD_LINES = {
  ecstatic: [
    'I feel AMAZING!', 'Best day ever!', '💖', 'So happy~!',
    'Life is wonderful!', '*dances*',
  ],
  happy: [
    'Feeling good!', 'This is nice~', '😊', '*hums happily*',
    'Everything\'s great!',
  ],
  neutral: [
    'I\'m okay.', 'Just vibing.', '...not bad.', 'Meh.',
  ],
  sad: [
    'I\'m hungry...', 'So tired...', 'I miss you...',
    'Feed me please?', '*sniffles*', 'Play with me...',
  ],
  miserable: [
    'I don\'t feel good...', 'Please help me...', 'So hungry...',
    '*shivers*', 'Is anyone there?', 'I need food...',
  ],
};

// ── Hunger alerts ──
export const HUNGER_LINES = {
  low: ['My tummy is rumbling...', 'Got any snacks?', 'I could eat...', 'Feed time?'],
  critical: ['I\'m STARVING!', 'FOOD PLEASE!', 'So... hungry...', '*stomach growls loudly*'],
};

// ── Energy alerts ──
export const ENERGY_LINES = {
  low: ['Getting sleepy...', '*yawn*', 'Need a nap...', 'My eyes are heavy...'],
  critical: ['Can\'t... stay... awake...', 'zzZ...', 'I need rest...', '*dozing off*'],
};

// ── Game phase reactions ──
export const PHASE_LINES = {
  Lobby: [
    'Ready for action!', 'Let\'s queue up!', 'Who are we playing?',
    'Pick me pick me!', 'Another game? Let\'s go!',
  ],
  Matchmaking: [
    'Searching...', 'Finding friends...', 'Where is everyone?',
    'Match me!', '*taps impatiently*',
  ],
  ReadyCheck: [
    'ACCEPT! ACCEPT!', 'Hit the button!', 'Go go go!',
    'Don\'t miss it!', '🔔',
  ],
  ChampSelect: [
    'Ooh, who to pick?', 'Choose wisely!', '*watches intently*',
    'Good pick!', 'Ban Yuumi.', 'I believe in you!',
  ],
  InProgress: [
    'Good luck!', 'You got this!', 'I\'ll wait here...',
    '*takes a nap*', 'Win it for me!', 'Go team!',
  ],
  EndOfGame: {
    win: ['WE WON!', 'VICTORY!', '🎉🎉🎉', 'Amazing!', 'GG EZ!', 'You\'re the best!'],
    loss: ['We\'ll get them next time...', 'Unlucky...', 'It\'s okay...', 'Don\'t give up!', '*pats you*'],
  },
};

// ── Mouse interaction ──
export const MOUSE_LINES = {
  notice: ['Oh, hi!', 'Hello~', '*looks up*', 'Hey there!', '👋'],
  follow: ['Wait for me!', 'Where are we going?', '*chases cursor*', 'Slow down!'],
  flee: ['Eek!', 'Don\'t catch me!', '*runs away*', 'Too close!', 'Ahh!'],
  pet: ['That feels nice~', '💖', '*purrs*', 'More please!', 'Hehe~'],
};

// ── Hungry behavior reactions ──
export const HUNGRY_ACT_LINES = {
  nudge:   ['Feed me or I\'ll push everything!', '*bumps into things*', 'I\'m so hungry I could move mountains!'],
  sulk:    ['*sits in corner*', '...I\'ll just be here...', 'Nobody feeds me...', 'Fine. I\'ll starve.'],
  beg:     ['Please? Pretty please?', '*puppy eyes*', 'I\'ll be good! Just feed me!', 'Look at me! I\'m starving!'],
  tantrum: ['FEED ME NOW!', '*runs around wildly*', 'AAAARGH! SO HUNGRY!', '*crashes into everything*'],
  demand:  ['I DEMAND sustenance!', 'This is unacceptable!', 'A royal decree: FEED ME.', 'Peasant! Where is my food?!'],
};

// ── Fast drag reactions (personality-based) ──
export const FAST_DRAG_LINES = {
  _generic: ['WOAH!', 'Too fast!', 'Slow down!', 'AHHH!'],
  windblade: ['YEAHHH! FASTER!', 'I love speed!', 'WOOHOO!', 'This is GREAT!'],
  shadow: ['S-STOP THIS!', 'I\'m getting dizzy!', '*clings on*', 'This is NOT okay!'],
  starlight: ['EEEK! Too fast!', 'Slow down please~!', 'I\'m getting dizzy!', '*holds on tight*'],
  chaos: ['HAHAHA YESSS!', 'WARP SPEED!', 'AGAIN AGAIN!', 'NYOOOM!', 'MORE MORE MORE!'],
  royal: ['UNACCEPTABLE VELOCITY!', 'SLOW DOWN, PEASANT!', 'A king does NOT fly!', 'I demand you stop!'],
};

// ── Drag reactions ──
export const DRAG_LINES = {
  enjoy:    ['Wheee!', 'Faster!', 'This is fun!', 'Again again!', '*giggles*'],
  love:     ['So cozy~', 'Hold me forever!', '💖', 'I feel safe!', 'Warm~'],
  hate:     ['UNHAND ME!', 'Let go!', '*hisses*', 'Don\'t touch me!', 'Stop!'],
  chaotic:  ['WOOOOO!', 'I\'m FLYING!', '*spins*', 'DO A BARREL ROLL!', 'CHAOS!'],
  offended: ['How DARE you!', 'This is undignified!', 'Unhand me, peasant!', '*furious*', 'I\'ll remember this!'],
};

// ── Champ Select reactions (personality-based) ──
export const CHAMPSELECT_LINES = {
  suggest: {
    _generic: ['Ooh pick that one!', 'How about this one?', 'This champ looks fun!'],
    windblade: ['Go with someone aggressive!', 'Pick a fighter! Let\'s GO!', 'That one looks strong!'],
    shadow: ['...pick something sneaky.', 'An assassin would be wise.', '*points at a dark champion*'],
    starlight: ['Pick someone cute!', 'That one sparkles!', 'Let\'s pick someone magical~'],
    chaos: ['PICK THE WEIRD ONE!', 'Random pick! DO IT!', 'This one goes BOOM!', 'Eeny meeny...'],
    royal: ['A worthy champion, perhaps.', 'Choose wisely.', 'That one has... potential.'],
  },
  our_pick: {
    _generic: ['Good choice!', 'Interesting...', 'Let\'s see how this goes!', 'Nice pick!'],
    windblade: ['A fine warrior! Let\'s win!', 'Strong choice!', 'Now let\'s fight!'],
    shadow: ['Hmm... acceptable.', '*nods silently*', 'The shadows approve.'],
    starlight: ['Yay! I love this champ!', 'Great pick! We got this~', 'So exciting!'],
    chaos: ['HAHA YES!', 'Oh this is gonna be FUN!', 'CHAOS UNLEASHED!', 'Interesting choice... I approve!'],
    royal: ['A royal selection.', 'Adequate.', 'You may proceed.'],
  },
  ally_pick: {
    _generic: ['Oh, nice!', 'Good teammate!', 'Let\'s go team!'],
    windblade: ['Strong ally!', 'We have a fighter!', 'This team looks powerful!'],
    shadow: ['...let\'s see what they can do.', 'An interesting choice.', 'Hmm.'],
    starlight: ['Yay new friend!', 'Our team is so cool!', 'Welcome aboard~'],
    chaos: ['More chaos! MORE!', 'This team is gonna be WILD!', 'Hehehe!'],
    royal: ['They serve the team well.', 'A reasonable addition.', 'We observe.'],
  },
  ban: {
    _generic: ['Bye bye!', 'Good riddance!', 'Banned!', 'See ya!'],
    windblade: ['No cowards allowed!', 'BEGONE!', 'Hah! Banned!'],
    shadow: ['Eliminated.', 'Gone from the shadows.', '...one less threat.'],
    starlight: ['Aww, sorry little champ!', 'Had to go!', 'Byeee~'],
    chaos: ['BANNED! HAHAHA!', 'DELETED!', 'NO FUN FOR YOU!', 'Get rekt!'],
    royal: ['Banished from court.', 'Not worthy.', 'The crown decrees: no.'],
  },
};

// ── Lobby reactions (personality-based) ──
export const LOBBY_LINES = {
  member_join: {
    _generic: ['Someone joined!', 'Oh, hi there!', 'New friend!', 'Welcome!'],
    windblade: ['Another warrior joins!', 'Let\'s go team!', 'Welcome aboard, soldier!'],
    shadow: ['...someone arrived.', '*watches silently*', 'A new presence.'],
    starlight: ['Hiiii!', 'Welcome welcome!', 'Yay, more friends!', 'Hello~!'],
    chaos: ['PARTY GROWS!', 'MORE PEOPLE MORE FUN!', 'Let\'s goooo!', 'FRESH MEAT! jk jk'],
    royal: ['An audience gathers.', 'You may enter.', 'The court welcomes you.'],
  },
};

// ── Shop / Feed reactions ──
export const ACTION_LINES = {
  feed: ['Yummy!', 'Delicious!', 'Nom nom~', 'Thank you!', '*munch munch*', 'More?'],
  treat: ['Ooh a treat!', 'So sweet!', 'Best day!', 'I love treats!'],
  toy: ['WHEEE!', 'So fun!', '*plays excitedly*', 'Again again!', 'Best toy ever!'],
  energy_drink: ['ZOOM!', 'I\'M AWAKE!', '⚡⚡⚡', 'So much energy!', '*bounces*'],
  lullaby: ['So sleepy~', 'Goodnight...', '*yawn*', 'zzZ~', 'Sweet dreams...'],
  xp_boost: ['POWER UP!', 'I feel stronger!', '✨✨', 'Let\'s go!', 'Boosted!'],
  quest_complete: ['Quest done!', 'Rewards!', 'I did it!', 'Yay!', '🏆'],
  level_up: ['LEVEL UP!', 'I grew stronger!', 'New power!', '🎉', 'Watch me now!'],
  evolve: ['I\'m EVOLVING!', 'What\'s happening?!', '✨✨✨', 'I feel different!', 'WOAH!'],
};

/**
 * Pick a random line from a category.
 */
export function pickLine(lines, archetype) {
  let pool;
  if (Array.isArray(lines)) {
    pool = lines;
  } else {
    // Merge generic + archetype-specific
    const generic = lines._generic || [];
    const specific = (archetype && lines[archetype]) || [];
    pool = [...generic, ...specific];
  }
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
