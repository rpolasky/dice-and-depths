// ============================================================
// COMBAT.JS — the core push-your-luck combat loop.
// Owns a single "fight" object; all mutation happens through the
// exported functions below so game.js/ui can stay thin.
// ============================================================

import { getMonsterDef } from '../data/monster-data.js';
import { getCharacterDef } from '../data/character-data.js';
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

/** Builds a lookup of active abilities for the current party, by hook name. */
function abilitiesByHook(partyIds) {
  const map = {};
  for (const id of partyIds) {
    const def = getCharacterDef(id);
    const hook = def.ability.hook;
    (map[hook] = map[hook] || []).push({ characterId: id, ...def.ability });
  }
  return map;
}

export function startCombat({ monsterId, partyIds, bag }) {
  const monsterDef = getMonsterDef(monsterId);
  return {
    monster: createMonsterState(monsterDef),
    partyIds,
    abilities: abilitiesByHook(partyIds),
    bag, // reference to the shared dice bag (array), combat returns a new one each mutation
    overcharge: 0,
    consecutivePushes: 0,
    bustCountThisFight: 0,
    webActive: false,
    pendingChoice: null, // { candidates: [dieInstance, dieInstance] } for Paladin ability
    log: [],
    outcome: null, // null | 'victory' | 'defeat' | 'fled'
    lastRoll: null,
  };
}

export function getIntentInfo(fight) {
  const intent = currentIntent(fight.monster);
  return describeIntent(intent);
}

export function bagPeek(fight, count = 1) {
  if (!fight.abilities.onRevealNextDie) return [];
  return DiceEngine.peek(fight.bag, count).map((d) => getDieDef(d.dieId));
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
  let consecutivePushes = fight.consecutivePushes;
  let outcome = null;
  let healAmount = 0;
  let bustTriggered = false;
  let clericCredit = null;
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
    overcharge += face.value;
    consecutivePushes += 1;
    log.push(`${face.dieName} rolled ${face.value}${face.type === 'crit' ? ' — CRITICAL!' : ''}${face.type === 'element' ? ` (${face.element})` : ''}. Overcharge: ${overcharge}.`);
    if (isBustValue(overcharge)) bustTriggered = true;
  }

  let nextFight = {
    ...fight,
    bag,
    overcharge,
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

  nextFight.lastEvent = stampEvent(face.type === 'crit' ? 'crit-roll' : 'roll', { face });
  return { fight: nextFight, result: { type: 'roll', face } };
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

  const monster = { ...fight.monster, currentHp: Math.max(0, fight.monster.currentHp - damage), pendingGuardPercent: 0 };
  const log = fight.log.slice();
  log.push(`⚡ RELEASE for ${damage} damage! (${fight.overcharge} Overcharge)`);

  let nextFight = {
    ...fight,
    monster,
    overcharge: 0,
    consecutivePushes: 0,
    log,
  };

  if (monster.currentHp <= 0) {
    nextFight.outcome = 'victory';
    nextFight.lastEvent = stampEvent('victory', { damage, abilityCredit: berserkerCredit });
    return { fight: nextFight, result: { type: 'victory', damage } };
  }

  nextFight.lastEvent = stampEvent('release', { damage, abilityCredit: berserkerCredit });
  return { fight: nextFight, result: { type: 'release', damage } };
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
  };

  return { fight: nextFight, effects };
}

export function fleeCombat(fight) {
  return { ...fight, outcome: 'fled' };
}
