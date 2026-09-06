// ============================================================
// BALANCE.JS — every tunable number in the game lives here.
// Nothing outside this file should hard-code a game constant.
// ============================================================

export const BALANCE = {
  expedition: {
    startingDiceCapacity: 12,
    startingPartySize: 3,
    startingGold: 0,
  },

  overcharge: {
    // Thresholds are inclusive lower bounds. Rescaled so a realistic
    // handful of dice (3-8 pushes) reaches a meaningful damage tier —
    // the old 50/75/100 scale required more dice than a starting bag
    // even contains.
    thresholds: [
      { min: 0, max: 14, id: 'normal', label: 'STEADY', damageMult: 1.0 },
      { min: 15, max: 24, id: 'hot', label: 'OVERCHARGED', damageMult: 1.25 },
      { min: 25, max: 39, id: 'critical', label: 'CRITICAL', damageMult: 1.6 },
      { min: 40, max: Infinity, id: 'bust', label: 'OVERLOAD', damageMult: 0 },
    ],
    bustAt: 40,
    // Chance a "danger" face on a die instantly triggers bust, before threshold math.
    dangerFaceAlwaysBusts: true,
  },

  bust: {
    // Default consequence, individual dice/monsters can override.
    // Losing everything on every bust (the old default) was too punishing
    // given how few dice a run has to work with — losing most of it still
    // stings without ending the fight's momentum entirely.
    overchargeLossPercent: 60, // lose this % of accumulated overcharge
    monsterActsImmediately: true,
    partyDamage: 0, // additional flat damage, 0 = none by default
  },

  dice: {
    maxBagCapacityUpgradeSteps: [12, 15, 18, 22, 26],
  },

  search: {
    baseSuccessChance: 0.7,
    trapChance: 0.15,
  },

  extraction: {
    // floors (from the start of a region) that guarantee an extraction point
    guaranteedEveryNFloors: 3,
  },
};
