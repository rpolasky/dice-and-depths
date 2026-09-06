// ============================================================
// BALANCE.JS — every tunable number in the game lives here.
// Nothing outside this file should hard-code a game constant.
// ============================================================

export const BALANCE = {
  expedition: {
    startingDiceCapacity: 10,
    startingPartySize: 3,
    startingGold: 0,
  },

  overcharge: {
    // Thresholds are inclusive lower bounds.
    thresholds: [
      { min: 0, max: 49, id: 'normal', label: 'STEADY', damageMult: 1.0 },
      { min: 50, max: 74, id: 'hot', label: 'OVERCHARGED', damageMult: 1.15 },
      { min: 75, max: 99, id: 'critical', label: 'CRITICAL', damageMult: 1.35 },
      { min: 100, max: Infinity, id: 'bust', label: 'OVERLOAD', damageMult: 0 },
    ],
    bustAt: 100,
    // Chance a "danger" face on a die instantly triggers bust, before threshold math.
    dangerFaceAlwaysBusts: true,
  },

  bust: {
    // Default consequence, individual dice/monsters can override.
    overchargeLossPercent: 100, // lose this % of accumulated overcharge
    monsterActsImmediately: true,
    partyDamage: 0, // additional flat damage, 0 = none by default
  },

  dice: {
    maxBagCapacityUpgradeSteps: [10, 12, 15, 18, 22],
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
