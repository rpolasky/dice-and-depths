// ============================================================
// MONSTER-DATA.JS — data-driven monster definitions.
// Monsters never roll dice. They telegraph an "intent" each
// round, drawn in order (looping) from intentPattern.
// Intent kinds understood by js/combat/monster-intent.js:
//   'attack' -> deals `value` damage to party at end of round
//   'guard'  -> reduces the party's next attack by `value`%
//   'curse'  -> adds a cursed die to the player's dice bag
//   'web'    -> next PUSH this fight has an increased bust chance
//   'steal'  -> removes one die from the bag
//   'inferno'-> charges for `chargeRounds`, then deals huge `value` damage
//
// `tier` gates which floor-positions within a region can roll this
// monster (see js/data/floor-data.js) — tier 1 = safe for the first
// few rooms of a region, tier 3 = late-region/elite only. Boss rooms
// ignore tier and pick the toughest monster in the region's full pool.
//
// `icon` is an emoji fallback (log lines, tight text contexts).
// The real visual is the pixel-art sheet in js/data/sprite-data.js,
// keyed by the same monster id.
// ============================================================

export const MONSTER_DATA = {
  goblin: {
    id: 'goblin', name: 'Goblin', icon: '👺', hp: 55, tier: 1,
    intentPattern: [{ kind: 'attack', value: 7, label: 'Spear Jab' }],
    rewards: { diceChance: 0.65, diceOptions: ['basic_die'], gold: [5, 15] },
  },
  skeleton: {
    id: 'skeleton', name: 'Skeleton', icon: '💀', hp: 48, tier: 1,
    intentPattern: [{ kind: 'attack', value: 6, label: 'Bone Slash' }],
    rewards: { diceChance: 0.6, diceOptions: ['basic_die'], gold: [5, 15] },
  },
  batilisk: {
    id: 'batilisk', name: 'Batilisk', icon: '🦇', hp: 46, tier: 1,
    intentPattern: [
      { kind: 'web', label: 'Disorienting Shriek' },
      { kind: 'attack', value: 7, label: 'Swoop' },
    ],
    rewards: { diceChance: 0.55, diceOptions: ['basic_die'], gold: [5, 10] },
  },
  lizard_monk: {
    id: 'lizard_monk', name: 'Lizard Monk', icon: '🦎', hp: 56, tier: 2,
    intentPattern: [
      { kind: 'guard', value: 25, label: 'Meditate' },
      { kind: 'attack', value: 10, label: 'Palm Strike' },
    ],
    rewards: { diceChance: 0.5, diceOptions: ['basic_die', 'power_die'], gold: [15, 30] },
  },
  goblin_brute: {
    id: 'goblin_brute', name: 'Goblin Brute', icon: '👹', hp: 78, tier: 2,
    intentPattern: [
      { kind: 'attack', value: 12, label: 'Heavy Strike' },
      { kind: 'guard', value: 20, label: 'Hunker Down' },
      { kind: 'attack', value: 9, label: 'Cleave' },
    ],
    rewards: { diceChance: 0.8, diceOptions: ['power_die', 'basic_die'], gold: [30, 60] },
  },
  skeleton_knight: {
    id: 'skeleton_knight', name: 'Skeleton Knight', icon: '🗡️', hp: 88, tier: 2,
    intentPattern: [
      { kind: 'guard', value: 30, label: 'Raise Shield' },
      { kind: 'attack', value: 14, label: 'Blade Slam' },
    ],
    rewards: { diceChance: 0.7, diceOptions: ['power_die'], gold: [40, 70] },
  },
  orc_archer: {
    id: 'orc_archer', name: 'Orc Archer', icon: '🏹', hp: 44, tier: 2,
    intentPattern: [
      { kind: 'steal', label: 'Snipe' },
      { kind: 'attack', value: 9, label: 'Volley' },
    ],
    rewards: { diceChance: 0.9, diceOptions: ['lucky_die', 'power_die'], gold: [20, 50] },
  },
  bogslium: {
    id: 'bogslium', name: 'Bogslium', icon: '🟢', hp: 50, tier: 2,
    intentPattern: [
      { kind: 'curse', label: 'Fester' },
      { kind: 'attack', value: 8, label: 'Muck Slam' },
    ],
    rewards: { diceChance: 0.6, diceOptions: ['elemental_die'], gold: [15, 25] },
  },
  ghost: {
    id: 'ghost', name: 'Ghost', icon: '👻', hp: 52, tier: 2,
    intentPattern: [
      { kind: 'attack', value: 9, label: 'Chilling Touch' },
      { kind: 'curse', label: 'Haunt' },
    ],
    rewards: { diceChance: 0.5, diceOptions: ['cursed_die', 'critical_die'], gold: [20, 35] },
  },
  minotaur: {
    id: 'minotaur', name: 'Minotaur', icon: '🐂', hp: 105, tier: 3,
    intentPattern: [
      { kind: 'attack', value: 11, label: 'Axe Swing' },
      { kind: 'guard', value: 20, label: 'Brace' },
      { kind: 'attack', value: 16, label: 'Charge' },
    ],
    rewards: { diceChance: 0.75, diceOptions: ['power_die', 'critical_die'], gold: [45, 75] },
  },
  dragon: {
    id: 'dragon', name: 'Dragon', icon: '🐉', hp: 175, tier: 3,
    boss: true,
    intentPattern: [
      { kind: 'attack', value: 10, label: 'Claw' },
      { kind: 'inferno', chargeRounds: 2, value: 30, label: 'Inferno Breath' },
      { kind: 'attack', value: 10, label: 'Tail Sweep' },
    ],
    rewards: { diceChance: 1, diceOptions: ['critical_die', 'elemental_die'], gold: [80, 140] },
  },
};

export function getMonsterDef(id) {
  const def = MONSTER_DATA[id];
  if (!def) throw new Error(`Unknown monster id: ${id}`);
  return def;
}
