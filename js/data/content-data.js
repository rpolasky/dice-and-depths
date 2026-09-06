// ============================================================
// CONTENT-DATA.JS — puzzles, treasure tables, and random events.
// ============================================================

export const PUZZLES = [
  {
    id: 'symbol_sequence',
    name: 'Symbol Sequence',
    prompt: 'Tap the four glowing runes in the order they lit up.',
    type: 'sequence',
    symbols: ['🔥', '❄️', '⚡', '☠️'],
    reward: { dice: 2 },
    failPenalty: { loseDice: 1 },
  },
  {
    id: 'lever_order',
    name: 'Lever Order',
    prompt: 'Three levers must be pulled heaviest to lightest.',
    type: 'sequence',
    symbols: ['🪨', '⚙️', '🪶'],
    reward: { dice: 1, rareDieChance: 0.3 },
    failPenalty: { damage: 8 },
  },
  {
    id: 'statue_selection',
    name: 'Statue Selection',
    prompt: 'Choose the statue whose eyes are not glowing.',
    type: 'choice',
    options: ['Left Statue', 'Center Statue', 'Right Statue'],
    correctOption: 1,
    reward: { dice: 2, relic: true },
    failPenalty: { cursedDie: true },
  },
  {
    id: 'number_sequence',
    name: 'Number Sequence',
    prompt: 'The wall reads: 2, 4, 8, ?. What comes next?',
    type: 'choice',
    options: ['10', '16', '12'],
    correctOption: 1,
    reward: { dice: 3 },
    failPenalty: { loseDice: 1 },
  },
  {
    id: 'element_matching',
    name: 'Element Matching',
    prompt: 'Match the brazier to the element carved beside it: Fire.',
    type: 'choice',
    options: ['Red Brazier', 'Blue Brazier', 'Green Brazier'],
    correctOption: 0,
    reward: { dice: 1, dieType: 'elemental_die' },
    failPenalty: { damage: 10 },
  },
];

export const TREASURE_TABLES = {
  common: ['basic_die', 'power_die', 'healing_die'],
  rare: ['critical_die', 'elemental_die', 'lucky_die'],
};

export const EVENTS = [
  {
    id: 'mysterious_merchant',
    name: 'Mysterious Merchant',
    description: 'A hooded figure offers a powerful die in exchange for two of your basic dice.',
    choices: [
      { label: 'Trade 2 Basic Dice', cost: { dieType: 'basic_die', count: 2 }, reward: { dieType: 'critical_die', count: 1 } },
      { label: 'Walk away', cost: null, reward: null },
    ],
  },
  {
    id: 'ancient_shrine',
    name: 'Ancient Shrine',
    description: 'A shrine hums with quiet power. Praying could help... or provoke something.',
    choices: [
      { label: 'Pray', successChance: 0.6, success: { heal: 20 }, failure: { damage: 12 } },
      { label: 'Leave it be', cost: null, reward: null },
    ],
  },
  {
    id: 'starving_prisoner',
    name: 'Starving Prisoner',
    description: 'A prisoner begs to join your expedition if freed.',
    choices: [
      { label: 'Free them', reward: { storyFragment: 'prisoner_freed' } },
      { label: 'Leave them', reward: null },
    ],
  },
  {
    id: 'cracked_altar',
    name: 'Cracked Altar',
    description: 'Blood magic residue lingers. Offering dice here might curse or empower them.',
    choices: [
      { label: 'Offer a die', cost: { dieType: 'basic_die', count: 1 }, successChance: 0.5,
        success: { dieType: 'power_die', count: 2 }, failure: { dieType: 'cursed_die', count: 1 } },
      { label: 'Ignore it', reward: null },
    ],
  },
  {
    id: 'echoing_chasm',
    name: 'Echoing Chasm',
    description: 'A chasm splits the corridor. A narrow ledge might let you cross to a glint of gold.',
    choices: [
      { label: 'Cross the ledge', successChance: 0.65, success: { gold: 40 }, failure: { damage: 15 } },
      { label: 'Go around', reward: null },
    ],
  },
];

export function getPuzzle(id) {
  return PUZZLES.find((p) => p.id === id);
}
export function randomPuzzle(rng = Math.random) {
  return PUZZLES[Math.floor(rng() * PUZZLES.length)];
}
export function randomEvent(rng = Math.random) {
  return EVENTS[Math.floor(rng() * EVENTS.length)];
}
