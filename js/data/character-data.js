// ============================================================
// CHARACTER-DATA.JS — data-driven character card definitions.
//
// Each character has a base ability, a small personal dice loadout
// they contribute to the shared party bag, and a `levelUnlocks` list
// of milestones. A milestone can grant additional personal dice
// and/or an `abilityOverride` (shallow-merged onto the base ability)
// — this is how "Rogue at level 5 gets Dual Wield" or "Mage at level
// 4 reveals two dice instead of one" work, without needing separate
// per-character dice bags or a different combat-turn structure: the
// character's level changes what they add to the ONE shared bag and
// how their existing ability hook behaves, so the core push/release
// loop never changes shape.
//
// Abilities are declared as { hook, ...params } and are interpreted
// by js/combat/combat.js and js/dungeon/encounters.js. Supported hooks:
//   'onPushDrawExtra'     -> draw N dice, player picks 1 to roll
//   'onFirstBustMitigate' -> first bust each fight loses only pct%
//   'onRevealNextDie'     -> shows the next N dice in the bag before rolling
//   'onConsecutivePushDamage' -> each consecutive push adds a damage bonus stack
//   'onHealingDieBoost'   -> healing die faces heal for extra %
//   'onSearchBoost'       -> increases search success chance / reward tier
//   'onDualWield'         -> draw 2 dice and roll BOTH, summing their effects
// ============================================================

export const CHARACTER_DATA = {
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    className: 'Paladin',
    icon: '🛡️',
    portrait: 'assets/characters/paladin.png',
    tagline: 'Divine Guidance',
    description: 'When you PUSH, draw two dice and choose which one to roll.',
    stats: { fortitude: 8, insight: 4 },
    ability: { hook: 'onPushDrawExtra', drawCount: 2 },
    baseDice: ['basic_die', 'basic_die', 'basic_die', 'basic_die'],
    levelUnlocks: [
      { level: 2, grantDice: ['basic_die'] },
      { level: 3, grantDice: ['power_die'] },
      { level: 4, grantDice: ['power_die'] },
      { level: 5, grantDice: ['critical_die'], abilityOverride: { drawCount: 3 },
        unlockName: 'Aegis Ward', unlockDesc: 'Divine Guidance now draws THREE dice — choose the best of the three.' },
    ],
  },

  rogue: {
    id: 'rogue',
    name: 'Rogue',
    className: 'Rogue',
    icon: '🗡️',
    portrait: 'assets/characters/rogue.svg',
    tagline: 'Second Chance',
    description: 'The first BUST each battle only loses 50% of accumulated Overcharge.',
    stats: { fortitude: 5, insight: 6 },
    ability: { hook: 'onFirstBustMitigate', mitigatePercent: 50 },
    baseDice: ['basic_die', 'basic_die', 'basic_die', 'basic_die'],
    levelUnlocks: [
      { level: 2, grantDice: ['basic_die'] },
      { level: 3, grantDice: ['basic_die'] },
      { level: 4, abilityOverride: { mitigatePercent: 65 } },
      { level: 5, grantDice: ['lucky_die'], abilityOverride: { hook: 'onDualWield' },
        unlockName: 'Dual Wield', unlockDesc: 'PUSH now draws and rolls TWO dice at once, both added to Overcharge.' },
    ],
  },

  mage: {
    id: 'mage',
    name: 'Mage',
    className: 'Mage',
    icon: '🔮',
    portrait: 'assets/characters/mage.png',
    tagline: 'Arcane Sight',
    description: 'Reveals the next die in your bag before you decide whether to roll it.',
    stats: { fortitude: 4, insight: 9 },
    ability: { hook: 'onRevealNextDie', revealCount: 1 },
    baseDice: ['basic_die', 'basic_die', 'basic_die', 'elemental_die'],
    levelUnlocks: [
      { level: 2, grantDice: ['elemental_die'] },
      { level: 3, grantDice: ['basic_die'] },
      { level: 4, abilityOverride: { revealCount: 2 },
        unlockName: 'Farsight', unlockDesc: 'Arcane Sight now reveals the next TWO dice in the bag.' },
      { level: 5, grantDice: ['critical_die'] },
    ],
  },

  berserker: {
    id: 'berserker',
    name: 'Berserker',
    className: 'Berserker',
    icon: '🪓',
    portrait: 'assets/characters/berserker.svg',
    tagline: 'Blood Rage',
    description: 'Each consecutive successful PUSH increases eventual damage — but BUST penalties are more severe.',
    stats: { fortitude: 9, insight: 2 },
    ability: { hook: 'onConsecutivePushDamage', bonusPerPush: 0.08, maxBonus: 0.6, bustPenaltyMult: 1.5 },
    baseDice: ['basic_die', 'basic_die', 'basic_die', 'power_die'],
    levelUnlocks: [
      { level: 2, grantDice: ['power_die'] },
      { level: 3, grantDice: ['basic_die'] },
      { level: 4, abilityOverride: { bonusPerPush: 0.10, maxBonus: 0.8 },
        unlockName: 'Frenzy', unlockDesc: 'Blood Rage stacks faster and caps higher.' },
      { level: 5, grantDice: ['power_die'] },
    ],
  },

  cleric: {
    id: 'cleric',
    name: 'Cleric',
    className: 'Cleric',
    icon: '✨',
    portrait: 'assets/characters/cleric.svg',
    tagline: 'Blessed Hands',
    description: 'Healing die faces restore 50% more party HP.',
    stats: { fortitude: 6, insight: 6 },
    ability: { hook: 'onHealingDieBoost', boostPercent: 50 },
    baseDice: ['basic_die', 'basic_die', 'healing_die', 'healing_die'],
    levelUnlocks: [
      { level: 2, grantDice: ['basic_die'] },
      { level: 3, grantDice: ['healing_die'] },
      { level: 4, abilityOverride: { boostPercent: 75 },
        unlockName: 'Sacred Grace', unlockDesc: 'Blessed Hands now boosts healing by 75%.' },
      { level: 5, grantDice: ['basic_die'] },
    ],
  },

  scout: {
    id: 'scout',
    name: 'Scout',
    className: 'Scout',
    icon: '🏹',
    portrait: 'assets/characters/scout.svg',
    tagline: 'Keen Eyes',
    description: 'Increases the chance of discovering hidden dice and secret rooms while exploring.',
    stats: { fortitude: 5, insight: 7 },
    ability: { hook: 'onSearchBoost', bonusChance: 0.2 },
    baseDice: ['basic_die', 'basic_die', 'basic_die', 'lucky_die'],
    levelUnlocks: [
      { level: 2, grantDice: ['basic_die'] },
      { level: 3, grantDice: ['lucky_die'] },
      { level: 4, abilityOverride: { bonusChance: 0.35 },
        unlockName: 'Sharp Eyes', unlockDesc: 'Search success chance boosted even further.' },
      { level: 5, grantDice: ['power_die'] },
    ],
  },
};

export function getCharacterDef(id) {
  const def = CHARACTER_DATA[id];
  if (!def) throw new Error(`Unknown character id: ${id}`);
  return def;
}

export function allCharacterIds() {
  return Object.keys(CHARACTER_DATA);
}

/** All level-unlock milestones at or below `level`, in level order. */
function unlocksUpTo(charId, level) {
  return getCharacterDef(charId).levelUnlocks.filter((u) => u.level <= level);
}

/**
 * The character's ability object as it actually behaves at `level` —
 * the base ability with every unlocked abilityOverride shallow-merged
 * on top, in level order (so a level-5 override wins over a level-4 one).
 */
export function getEffectiveAbility(charId, level) {
  const def = getCharacterDef(charId);
  let ability = { ...def.ability };
  for (const unlock of unlocksUpTo(charId, level)) {
    if (unlock.abilityOverride) ability = { ...ability, ...unlock.abilityOverride };
  }
  return ability;
}

/**
 * The full list of personal dice this character contributes to the
 * shared expedition bag at `level` — their base loadout plus every
 * grantDice from unlocked milestones.
 */
export function getPersonalDice(charId, level) {
  const def = getCharacterDef(charId);
  let dice = [...def.baseDice];
  for (const unlock of unlocksUpTo(charId, level)) {
    if (unlock.grantDice) dice = dice.concat(unlock.grantDice);
  }
  return dice;
}

/** The next unlock milestone that hasn't been reached yet, or null if maxed. */
export function nextUnlock(charId, level) {
  const def = getCharacterDef(charId);
  return def.levelUnlocks.find((u) => u.level > level) || null;
}
