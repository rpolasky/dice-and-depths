// ============================================================
// CHARACTER-DATA.JS — data-driven character card definitions.
// Abilities are declared as { hook, ...params } and are
// interpreted by js/combat/combat.js and js/dungeon/encounters.js.
// Supported hooks:
//   'onPushDrawExtra'     -> draw N dice, player picks 1 to roll
//   'onFirstBustMitigate' -> first bust each fight loses only pct%
//   'onRevealNextDie'     -> shows the next die in the bag before rolling
//   'onConsecutivePushDamage' -> each consecutive push adds a damage bonus stack
//   'onHealingDieBoost'   -> healing die faces heal for extra %
//   'onSearchBoost'       -> increases search success chance / reward tier
// ============================================================

export const CHARACTER_DATA = {
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    className: 'Paladin',
    icon: '🛡️',
    portrait: 'assets/characters/paladin.svg',
    tagline: 'Divine Guidance',
    description: 'When you PUSH, draw two dice and choose which one to roll.',
    stats: { fortitude: 8, insight: 4 },
    ability: { hook: 'onPushDrawExtra', drawCount: 2 },
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
  },

  mage: {
    id: 'mage',
    name: 'Mage',
    className: 'Mage',
    icon: '🔮',
    portrait: 'assets/characters/mage.svg',
    tagline: 'Arcane Sight',
    description: 'Reveals the next die in your bag before you decide whether to roll it.',
    stats: { fortitude: 4, insight: 9 },
    ability: { hook: 'onRevealNextDie' },
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
  },

  scout: {
    id: 'scout',
    name: 'Scout',
    className: 'Scout',
    icon: '🏹',
    portrait: 'assets/characters/scout.svg',
    tagline: "Keen Eyes",
    description: 'Increases the chance of discovering hidden dice and secret rooms while exploring.',
    stats: { fortitude: 5, insight: 7 },
    ability: { hook: 'onSearchBoost', bonusChance: 0.2 },
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
