// ============================================================
// PROGRESSION.JS — the boundary between EXPEDITION progression
// (temporary; lost on death) and PERMANENT progression (kept).
// ============================================================

import { BALANCE } from '../data/balance.js';

export function createExpedition(partyIds, floorNumber = 1) {
  return {
    partyIds,
    floorNumber,
    partyHp: 150,
    partyMaxHp: 150,
    bag: [], // filled by game.js using dice-engine.createBag
    unbanked: {
      gold: 0,
      dice: [], // dieIds collected this run beyond starting bag, for the summary screen
      relics: [],
      storyFragments: [],
    },
    diceCapacity: BALANCE.expedition.startingDiceCapacity,
    startedAt: Date.now(),
  };
}

/** Called on successful EXTRACT — folds expedition gains into permanent state. */
export function bankExpedition(permanent, expedition) {
  return {
    ...permanent,
    bankedGold: permanent.bankedGold + expedition.unbanked.gold,
    relics: permanent.relics.concat(expedition.unbanked.relics),
    storyFlags: Array.from(new Set(permanent.storyFlags.concat(expedition.unbanked.storyFragments))),
    highestFloorReached: Math.max(permanent.highestFloorReached, expedition.floorNumber),
  };
}

/** Called on death/party wipe — only floor-reached progress and story are kept. */
export function loseExpedition(permanent, expedition) {
  return {
    ...permanent,
    highestFloorReached: Math.max(permanent.highestFloorReached, expedition.floorNumber),
    storyFlags: Array.from(new Set(permanent.storyFlags.concat(expedition.unbanked.storyFragments))),
  };
}

export function nextCapacityUpgrade(currentCapacity) {
  return BALANCE.dice.maxBagCapacityUpgradeSteps.find((c) => c > currentCapacity) || null;
}
