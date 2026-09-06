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
// ============================================================

export const MONSTER_DATA = {
  goblin: {
    id: 'goblin', name: 'Goblin', icon: '👺', hp: 30,
    intentPattern: [{ kind: 'attack', value: 8 }],
    rewards: { diceChance: 0.4, diceOptions: ['basic_die'], gold: [5, 15] },
  },
  goblin_warlord: {
    id: 'goblin_warlord', name: 'Goblin Warlord', icon: '👹', hp: 85,
    intentPattern: [
      { kind: 'attack', value: 18, label: 'Heavy Strike' },
      { kind: 'guard', value: 30 },
      { kind: 'attack', value: 12, label: 'Cleave' },
    ],
    rewards: { diceChance: 0.8, diceOptions: ['power_die', 'basic_die'], gold: [30, 60] },
  },
  orc_guard: {
    id: 'orc_guard', name: 'Orc Guard', icon: '🛡️', hp: 55,
    intentPattern: [
      { kind: 'guard', value: 40 },
      { kind: 'attack', value: 14 },
    ],
    rewards: { diceChance: 0.5, diceOptions: ['basic_die', 'power_die'], gold: [15, 30] },
  },
  bog_shaman: {
    id: 'bog_shaman', name: 'Bog Shaman', icon: '🧙', hp: 40,
    intentPattern: [
      { kind: 'curse' },
      { kind: 'attack', value: 10 },
    ],
    rewards: { diceChance: 0.6, diceOptions: ['elemental_die'], gold: [15, 25] },
  },
  cave_spider: {
    id: 'cave_spider', name: 'Cave Spider', icon: '🕷️', hp: 22,
    intentPattern: [
      { kind: 'web' },
      { kind: 'attack', value: 9 },
    ],
    rewards: { diceChance: 0.3, diceOptions: ['basic_die'], gold: [5, 10] },
  },
  mimic: {
    id: 'mimic', name: 'Mimic', icon: '🧰', hp: 35,
    intentPattern: [
      { kind: 'steal' },
      { kind: 'attack', value: 13 },
    ],
    rewards: { diceChance: 0.9, diceOptions: ['lucky_die', 'power_die'], gold: [20, 50] },
  },
  skeleton: {
    id: 'skeleton', name: 'Skeleton', icon: '💀', hp: 26,
    intentPattern: [{ kind: 'attack', value: 7 }],
    rewards: { diceChance: 0.35, diceOptions: ['basic_die'], gold: [5, 15] },
  },
  wraith: {
    id: 'wraith', name: 'Wraith', icon: '👻', hp: 48,
    intentPattern: [
      { kind: 'attack', value: 11 },
      { kind: 'curse' },
    ],
    rewards: { diceChance: 0.5, diceOptions: ['cursed_die', 'critical_die'], gold: [20, 35] },
  },
  stone_golem: {
    id: 'stone_golem', name: 'Stone Golem', icon: '🗿', hp: 100,
    intentPattern: [
      { kind: 'guard', value: 50 },
      { kind: 'guard', value: 50 },
      { kind: 'attack', value: 22, label: 'Slam' },
    ],
    rewards: { diceChance: 0.7, diceOptions: ['power_die'], gold: [40, 70] },
  },
  dragon_whelp: {
    id: 'dragon_whelp', name: 'Dragon Whelp', icon: '🐉', hp: 140,
    boss: true,
    intentPattern: [
      { kind: 'attack', value: 15 },
      { kind: 'inferno', chargeRounds: 2, value: 45, label: 'Inferno Breath' },
      { kind: 'attack', value: 15 },
    ],
    rewards: { diceChance: 1, diceOptions: ['critical_die', 'elemental_die'], gold: [80, 140] },
  },
};

export function getMonsterDef(id) {
  const def = MONSTER_DATA[id];
  if (!def) throw new Error(`Unknown monster id: ${id}`);
  return def;
}
