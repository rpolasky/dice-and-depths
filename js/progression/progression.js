// ============================================================
// PROGRESSION.JS — the boundary between EXPEDITION progression
// (temporary; lost on death) and PERMANENT progression (kept),
// plus character leveling and the shared-bag assembly that makes
// per-character loadouts matter without needing separate bags.
// ============================================================

import { BALANCE } from '../data/balance.js';
import { getPersonalDice } from '../data/character-data.js';

export function createExpedition(partyIds, floorNumber = 1) {
  return {
    partyIds,
    floorNumber,
    partyHp: 150,
    partyMaxHp: 150,
    bag: [], // filled by game.js using dice-engine.createBag
    unbanked: {
      gold: 0,
      // { dieId, targetCharacterId } — which character's permanent
      // loadout each found die will join if this expedition is banked.
      dice: [],
      relics: [],
      storyFragments: [],
    },
    diceCapacity: BALANCE.expedition.startingDiceCapacity,
    startedAt: Date.now(),
  };
}

/** Called on successful EXTRACT — folds expedition gains into permanent state. */
export function bankExpedition(permanent, expedition) {
  const characterProgress = { ...permanent.characterProgress };
  for (const entry of expedition.unbanked.dice) {
    const charId = entry.targetCharacterId;
    if (!characterProgress[charId]) continue;
    characterProgress[charId] = {
      ...characterProgress[charId],
      bonusDice: characterProgress[charId].bonusDice.concat(entry.dieId),
    };
  }
  return {
    ...permanent,
    bankedGold: permanent.bankedGold + expedition.unbanked.gold,
    relics: permanent.relics.concat(expedition.unbanked.relics),
    storyFlags: Array.from(new Set(permanent.storyFlags.concat(expedition.unbanked.storyFragments))),
    highestFloorReached: Math.max(permanent.highestFloorReached, expedition.floorNumber),
    characterProgress,
  };
}

/** Called on death/party wipe — only floor-reached progress and story are kept; found dice are lost, same as unbanked gold. */
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

// ---------------------------------------------------------------
// CHARACTER LEVELING
// ---------------------------------------------------------------

/** What level a total XP amount corresponds to, capped at maxLevel. */
export function levelForXp(xp) {
  const { xpThresholds, maxLevel } = BALANCE.leveling;
  let level = 1;
  for (let i = 1; i < xpThresholds.length && i < maxLevel; i++) {
    if (xp >= xpThresholds[i]) level = i + 1;
  }
  return level;
}

export function xpForNextLevel(level) {
  const { xpThresholds, maxLevel } = BALANCE.leveling;
  if (level >= maxLevel) return null;
  return xpThresholds[level]; // xpThresholds[level] is the cumulative XP needed to REACH level+1
}

/**
 * Grants `xpAmount` to every character in `partyIds`, returning the
 * updated permanent state plus a list of { characterId, newLevel } for
 * anyone who leveled up, so the caller can show a celebration.
 */
export function grantPartyXp(permanent, partyIds, xpAmount) {
  const characterProgress = { ...permanent.characterProgress };
  const levelUps = [];
  for (const charId of partyIds) {
    const prog = characterProgress[charId] || { level: 1, xp: 0, bonusDice: [] };
    const newXp = prog.xp + xpAmount;
    const newLevel = levelForXp(newXp);
    characterProgress[charId] = { ...prog, xp: newXp, level: newLevel };
    if (newLevel > prog.level) levelUps.push({ characterId: charId, newLevel });
  }
  return { permanent: { ...permanent, characterProgress }, levelUps };
}

/**
 * Builds the flat list of die IDs the active party contributes to the
 * shared expedition bag: each character's base + level-unlocked dice,
 * plus any bonus dice they've earned from banked loot. This is what
 * makes a level-5 Rogue meaningfully different from a level-1 one
 * without needing separate per-character bags.
 */
export function assembleStartingBag(partyIds, characterProgress) {
  let dice = [];
  for (const charId of partyIds) {
    const prog = characterProgress[charId] || { level: 1, bonusDice: [] };
    dice = dice.concat(getPersonalDice(charId, prog.level));
    dice = dice.concat(prog.bonusDice);
  }
  return dice;
}
