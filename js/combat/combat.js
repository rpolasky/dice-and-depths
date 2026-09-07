// ============================================================
// COMBAT.JS — the core push-your-luck combat loop.
// Owns a single "fight" object; all mutation happens through the
// exported functions below so game.js/ui can stay thin.
// ============================================================

import { getMonsterDef } from '../data/monster-data.js';
import { getCharacterDef, getEffectiveAbility } from '../data/character-data.js';
import { getDieDef } from '../data/dice-data.js';
import * as DiceEngine from '../engine/dice-engine.js';
import { getThreshold, isBustValue, computeReleaseDamage, bustCeiling } from '../engine/overcharge.js';
import { createMonsterState, currentIntent, resolveIntent, describeIntent } from './monster-intent.js';
import { BALANCE } from '../data/balance.js';

// Monotonic counter so the UI can tell "a new event just happened" apart
// from "the screen re-rendered for an unrelated reason" — fight objects
// are rebuilt on every action, so a plain type string isn't enough to
// detect a fresh occurrence (e.g. two rolls in a row could both be 'roll').
let eventSeq = 0;
function stampEvent(type, extra = {}) {
  return { type, seq: ++eventSeq, ...extra };
}

/**
 * Builds a lookup of active abilities for the current party, by hook name.
 * Uses each character's LEVEL-EFFECTIVE ability (see character-data.js's
 * getEffectiveAbility) so a level-5 Rogue's Dual Wield actually applies
 * instead of their base first-bust-mitigation hook.
 */
function abilitiesByHook(partyIds, characterLevels = {}) {
  const map = {};
  for (const id of partyIds) {
    const level = characterLevels[id] || 1;
    const ability = getEffectiveAbility(id, level);
    (map[ability.hook] = map[ability.hook] || []).push({ characterId: id, ...ability });
  }
  return map;
}

export function startCombat({ monsterId, partyIds, bag, characterLevels = {} }) {
  const monsterDef = getMonsterDef(monsterId);
  return {
    monster: createMonsterState(monsterDef),
    partyIds,
    abilities: abilitiesByHook(partyIds, characterLevels),
    bag, // reference to the shared dice bag (array), combat returns a new one each mutation
    overcharge: 0,
    consecutivePushes: 0,
    bustCountThisFight: 0,
    webActive: false,
    pendingChoice: null, // { candidates: [dieInstance, ...] } for Paladin/Dual-Wield-style abilities
    log: [],
    outcome: null, // null | 'victory' | 'defeat' | 'fled'
    lastRoll: null,
    lastEvent: null,
    partyDamageEvent: null,
    faceCounts: {}, // per-value hit counts for the current push-streak (combo system)
    streakRolls: [], // ordered {value, multiplier} for the current push-streak, for the UI's combo strip
  };
}

export function getIntentInfo(fight) {
  const intent = currentIntent(fight.monster);
  return describeIntent(intent);
}

export function bagPeek(fight) {
  const revealAbility = fight.abilities.onRevealNextDie?.[0];
  if (!revealAbility) return [];
  return DiceEngine.peek(fight.bag, revealAbility.revealCount || 1).map((d) => getDieDef(d.dieId));
}

/**
 * PUSH: draw (and possibly choose) a die, roll it, apply its effect.
 * Returns a new fight object (immutable-style update) plus a `result`
 * describing what just happened for the UI to animate/narrate.
 */
export function push(fight) {
  if (fight.bag.length === 0) {
    return { fight, result: { type: 'no-dice' } };
  }

  const dualWieldAbility = fight.abilities.onDualWield?.[0];
  if (dualWieldAbility) {
    return resolveDualWieldPush(fight);
  }

  const paladinAbility = fight.abilities.onPushDrawExtra?.[0];

  if (paladinAbility && !fight.pendingChoice) {
    const drawCount = Math.min(paladinAbility.drawCount, fight.bag.length);
    if (drawCount > 1) {
      const candidates = fight.bag.slice(0, drawCount);
      const nextFight = { ...fight, pendingChoice: { candidates } };
      return { fight: nextFight, result: { type: 'choose', candidates: candidates.map((c) => getDieDef(c.dieId)) } };
    }
  }

  return resolvePush(fight, null);
}

/** Called after the player picks which die to roll (Paladin ability), or directly for normal pushes. */
// Combo: rolling the same face VALUE again later in the same push-streak
// (order doesn't matter, only count) multiplies THAT roll's contribution
// to Overcharge. Capped at x3 so a high-value die (e.g. the critical die's
// 14) can't spike to absurd single-roll totals.
const COMBO_MAX_MULTIPLIER = 3;

/** Registers a numeric-face hit against the streak's running per-value
 *  counts and returns how much Overcharge it actually contributes. */
function applyComboToFace(faceCounts, value) {
  const counts = { ...faceCounts };
  counts[value] = (counts[value] || 0) + 1;
  const comboCount = counts[value];
  const multiplier = Math.min(comboCount, COMBO_MAX_MULTIPLIER);
  const totalValue = value * multiplier;
  return { counts, comboCount, multiplier, totalValue };
}

export function resolvePush(fight, chosenInstanceId) {
  let bag = fight.bag;
  let dieInstance;

  if (fight.pendingChoice) {
    const { candidates } = fight.pendingChoice;
    const chosen = chosenInstanceId
      ? candidates.find((c) => c.instanceId === chosenInstanceId)
      : candidates[0];
    const rest = candidates.filter((c) => c.instanceId !== chosen.instanceId);
    // Candidates were drawn from the front of the bag; remove them, then
    // return the unchosen ones to a random position in the bag.
    bag = fight.bag.slice(candidates.length);
    for (const r of rest) bag = DiceEngine.addDie(bag, r.dieId);
    dieInstance = chosen;
  } else {
    const draw = DiceEngine.drawNext(bag);
    bag = draw.bag;
    dieInstance = draw.die;
  }

  const face = DiceEngine.rollDie(dieInstance);
  const log = fight.log.slice();
  let overcharge = fight.overcharge;
  let faceCounts = fight.faceCounts;
  let consecutivePushes = fight.consecutivePushes;
  let streakRolls = fight.streakRolls;
  let outcome = null;
  let healAmount = 0;
  let bustTriggered = false;
  let clericCredit = null;
  let comboInfo = null;
  let webWasActive = fight.webActive;

  // Web debuff: adds a flat chance of an automatic bust on this push.
  const webBustRoll = webWasActive ? Math.random() < 0.2 : false;

  if (face.type === 'danger' && BALANCE.overcharge.dangerFaceAlwaysBusts) {
    bustTriggered = true;
  } else if (webBustRoll) {
    bustTriggered = true;
  } else if (face.type === 'heal') {
    const clericBoost = fight.abilities.onHealingDieBoost?.[0];
    const mult = clericBoost ? 1 + clericBoost.boostPercent / 100 : 1;
    healAmount = Math.round(face.value * mult);
    if (clericBoost) clericCredit = { characterId: clericBoost.characterId, hook: 'onHealingDieBoost' };
    log.push(`${face.dieName} heals the party for ${healAmount}.`);
  } else {
    const combo = applyComboToFace(faceCounts, face.value);
    faceCounts = combo.counts;
    overcharge += combo.totalValue;
    consecutivePushes += 1;
    streakRolls = streakRolls.concat({ value: face.value, multiplier: combo.multiplier });
    if (combo.multiplier > 1) {
      comboInfo = { value: face.value, comboCount: combo.comboCount, multiplier: combo.multiplier, total: combo.totalValue };
      log.push(`${face.dieName} rolled ${face.value} — ×${combo.multiplier} COMBO! (+${combo.totalValue}). Overcharge: ${overcharge}.`);
    } else {
      log.push(`${face.dieName} rolled ${face.value}${face.type === 'crit' ? ' — CRITICAL!' : ''}${face.type === 'element' ? ` (${face.element})` : ''}. Overcharge: ${overcharge}.`);
    }
    if (isBustValue(overcharge)) bustTriggered = true;
  }

  let nextFight = {
    ...fight,
    bag,
    overcharge,
    faceCounts,
    streakRolls,
    consecutivePushes,
    pendingChoice: null,
    webActive: webWasActive && !bustTriggered ? false : fight.webActive, // web consumed after one push attempt
    log,
    lastRoll: face,
  };
  nextFight.webActive = false; // web only ever affects the very next push

  if (bustTriggered) {
    nextFight = applyBust(nextFight);
    nextFight.lastEvent = stampEvent('bust', { face, abilityCredit: nextFight.abilityCredit });
    return { fight: nextFight, result: { type: 'bust', face, healAmount } };
  }

  if (healAmount > 0) {
    nextFight.lastEvent = stampEvent('heal', { face, healAmount, abilityCredit: clericCredit });
    return { fight: nextFight, result: { type: 'heal', face, healAmount } };
  }

  nextFight.lastEvent = stampEvent(face.type === 'crit' ? 'crit-roll' : 'roll', { face, comboInfo });
  return { fight: nextFight, result: { type: 'roll', face, comboInfo } };
}

/**
 * Rogue's level-5 capstone: draw and roll TWO dice in a single push,
 * summing their effects into one combined result. Implemented as its
 * own self-contained path (rather than threading through resolvePush)
 * to avoid destabilizing the single-die logic every other ability relies on.
 */
function resolveDualWieldPush(fight) {
  const draw1 = DiceEngine.drawNext(fight.bag);
  let bag = draw1.bag;
  const dice = [draw1.die];
  if (bag.length > 0) {
    const draw2 = DiceEngine.drawNext(bag);
    bag = draw2.bag;
    dice.push(draw2.die);
  }

  const faces = dice.map((d) => DiceEngine.rollDie(d));
  const log = fight.log.slice();
  let overcharge = fight.overcharge;
  let faceCounts = fight.faceCounts;
  let streakRolls = fight.streakRolls;
  let consecutivePushes = fight.consecutivePushes;
  let healAmount = 0;
  let bustTriggered = fight.webActive ? Math.random() < 0.2 : false;
  let clericCredit = null;
  let comboInfo = null;
  const overchargeBefore = fight.overcharge;

  for (const face of faces) {
    if (face.type === 'danger' && BALANCE.overcharge.dangerFaceAlwaysBusts) {
      bustTriggered = true;
    } else if (face.type === 'heal') {
      const clericBoost = fight.abilities.onHealingDieBoost?.[0];
      const mult = clericBoost ? 1 + clericBoost.boostPercent / 100 : 1;
      const amt = Math.round(face.value * mult);
      healAmount += amt;
      if (clericBoost) clericCredit = { characterId: clericBoost.characterId, hook: 'onHealingDieBoost' };
      log.push(`${face.dieName} heals the party for ${amt}.`);
    } else {
      const combo = applyComboToFace(faceCounts, face.value);
      faceCounts = combo.counts;
      overcharge += combo.totalValue;
      consecutivePushes += 1;
      streakRolls = streakRolls.concat({ value: face.value, multiplier: combo.multiplier });
      if (combo.multiplier > 1) {
        comboInfo = { value: face.value, comboCount: combo.comboCount, multiplier: combo.multiplier, total: combo.totalValue };
        log.push(`${face.dieName} rolled ${face.value} — ×${combo.multiplier} COMBO! (+${combo.totalValue}).`);
      } else {
        log.push(`${face.dieName} rolled ${face.value}${face.type === 'crit' ? ' — CRITICAL!' : ''}${face.type === 'element' ? ` (${face.element})` : ''}.`);
      }
    }
  }
  if (dice.length === 2) log.push(`🗡️ Dual Wield: both blades strike! Overcharge: ${overcharge}.`);
  if (isBustValue(overcharge)) bustTriggered = true;

  const combinedFace = {
    value: faces.reduce((sum, f) => sum + (f.type === 'heal' ? 0 : (f.value || 0)), 0),
    dieName: dice.length === 2 ? 'Dual Wield' : faces[0].dieName,
    type: faces.some((f) => f.type === 'crit') ? 'crit' : 'value',
  };

  let nextFight = {
    ...fight, bag, overcharge, faceCounts, streakRolls, consecutivePushes,
    pendingChoice: null, webActive: false, log, lastRoll: combinedFace,
  };

  if (bustTriggered) {
    nextFight = applyBust(nextFight);
    nextFight.lastEvent = stampEvent('bust', { face: combinedFace, abilityCredit: nextFight.abilityCredit });
    return { fight: nextFight, result: { type: 'bust', face: combinedFace, healAmount } };
  }
  if (healAmount > 0 && overcharge === overchargeBefore) {
    // Every rolled face this push was a heal face — treat it as a pure heal event.
    nextFight.lastEvent = stampEvent('heal', { face: combinedFace, healAmount, abilityCredit: clericCredit });
    return { fight: nextFight, result: { type: 'heal', face: combinedFace, healAmount } };
  }
  nextFight.lastEvent = stampEvent(combinedFace.type === 'crit' ? 'crit-roll' : 'roll', { face: combinedFace, comboInfo });
  return { fight: nextFight, result: { type: 'roll', face: combinedFace, healAmount, comboInfo } };
}

function applyBust(fight) {
  const bustCountThisFight = fight.bustCountThisFight + 1;
  const rogueAbility = fight.abilities.onFirstBustMitigate?.[0];
  const berserkerAbility = fight.abilities.onConsecutivePushDamage?.[0];

  let lossPercent = BALANCE.bust.overchargeLossPercent;
  let mitigatedByRogue = false;
  if (rogueAbility && bustCountThisFight === 1) {
    lossPercent = 100 - rogueAbility.mitigatePercent;
    mitigatedByRogue = true;
  }
  if (berserkerAbility) {
    lossPercent = Math.min(100, lossPercent * berserkerAbility.bustPenaltyMult);
  }

  const overchargeAfter = Math.round(fight.overcharge * (1 - lossPercent / 100));
  const log = fight.log.slice();
  log.push(`💥 BUST! Lost ${lossPercent}% of Overcharge (now ${overchargeAfter}).`);

  return {
    ...fight,
    overcharge: overchargeAfter,
    bustCountThisFight,
    consecutivePushes: 0,
    faceCounts: {}, // combo progress always fully resets on bust, even though Overcharge only partially drains
    streakRolls: [],
    log,
    abilityCredit: mitigatedByRogue ? { characterId: rogueAbility.characterId, hook: 'onFirstBustMitigate' } : null,
  };
}

/** Player chooses to RELEASE, converting Overcharge into an attack. */
export function release(fight) {
  const berserkerAbility = fight.abilities.onConsecutivePushDamage?.[0];
  let mult = 1;
  let berserkerCredit = null;
  if (berserkerAbility) {
    const bonus = Math.min(berserkerAbility.maxBonus, fight.consecutivePushes * berserkerAbility.bonusPerPush);
    mult += bonus;
    if (bonus > 0) berserkerCredit = { characterId: berserkerAbility.characterId, hook: 'onConsecutivePushDamage', bonusPercent: Math.round(bonus * 100) };
  }

  let damage = computeReleaseDamage(fight.overcharge, mult);
  if (fight.monster.pendingGuardPercent) {
    damage = Math.round(damage * (1 - fight.monster.pendingGuardPercent / 100));
  }
  const overkill = Math.max(0, damage - fight.monster.currentHp);
  // Overkill is genuinely wasted, not just "fine" — this is what makes
  // releasing at the RIGHT moment a real decision instead of "always
  // build to the biggest number you safely can."
  damage = Math.min(damage, fight.monster.currentHp);

  const monster = { ...fight.monster, currentHp: Math.max(0, fight.monster.currentHp - damage), pendingGuardPercent: 0 };
  const log = fight.log.slice();
  log.push(`⚡ RELEASE for ${damage} damage!${overkill > 0 ? ` (${overkill} wasted on overkill)` : ''} (${fight.overcharge} Overcharge)`);

  let nextFight = {
    ...fight,
    monster,
    overcharge: 0,
    consecutivePushes: 0,
    faceCounts: {}, // a new push-streak starts fresh after every release, win or not
    streakRolls: [],
    log,
  };

  if (monster.currentHp <= 0) {
    nextFight.outcome = 'victory';
    nextFight.lastEvent = stampEvent('victory', { damage, overkill, abilityCredit: berserkerCredit });
    return { fight: nextFight, result: { type: 'victory', damage, overkill } };
  }

  // A non-lethal hit sometimes knocks loose a die — this is what keeps a
  // fight that runs past one release from starving the player of dice,
  // on top of the guaranteed drop on the eventual kill.
  let droppedDie = null;
  const monsterDef = getMonsterDef(fight.monster.id);
  if (Math.random() < (monsterDef.rewards.diceChance || 0)) {
    droppedDie = monsterDef.rewards.diceOptions[Math.floor(Math.random() * monsterDef.rewards.diceOptions.length)];
    nextFight.bag = DiceEngine.addDie(nextFight.bag, droppedDie);
    nextFight.log = nextFight.log.concat(`A stray blow knocks loose a ${getDieDef(droppedDie).name}!`);
  }

  nextFight.lastEvent = stampEvent('release', { damage, overkill, abilityCredit: berserkerCredit });
  return { fight: nextFight, result: { type: 'release', damage, overkill, droppedDie } };
}

/**
 * Advances the monster: resolves its telegraphed intent. Called after
 * the player RELEASEs or BUSTs (both end the player's phase).
 * Returns { fight, effects } where effects.partyDamage should be applied
 * to the shared party HP pool by the caller (game.js).
 */
export function advanceMonster(fight) {
  if (fight.outcome) return { fight, effects: { partyDamage: 0, log: [] } };

  const monster = { ...fight.monster };
  const effects = resolveIntent(monster);
  let bag = fight.bag;
  const log = fight.log.concat(effects.log);

  if (effects.addCursedDie) bag = DiceEngine.addDie(bag, 'cursed_die');
  if (effects.removeDie && bag.length > 0) {
    const idx = Math.floor(Math.random() * bag.length);
    bag = bag.slice(0, idx).concat(bag.slice(idx + 1));
  }

  const nextFight = {
    ...fight,
    monster: { ...monster, pendingGuardPercent: effects.guardPercent || fight.monster.pendingGuardPercent || 0 },
    bag,
    webActive: fight.webActive || effects.webActive,
    log,
    // Separate from `lastEvent` (roll/release/bust/victory) so a release
    // that immediately triggers a monster counter-attack doesn't have one
    // event silently clobber the other before the UI ever sees it — both
    // need their own FX to fire.
    partyDamageEvent: effects.partyDamage > 0 ? stampEvent('party-damage', { damage: effects.partyDamage }) : fight.partyDamageEvent,
  };

  return { fight: nextFight, effects };
}

export function fleeCombat(fight) {
  return { ...fight, outcome: 'fled' };
}
