// ============================================================
// DICE-ENGINE.JS — manages the player's dice bag and rolls.
//
// The bag is modeled as a shuffled QUEUE, not a pure random draw
// each time. This is what lets abilities like the Mage's
// "reveal the next die" work: there genuinely IS a next die.
// Whenever a die is added, it's spliced into a random position
// in the remaining queue so the order still feels unpredictable.
// ============================================================

import { getDieDef } from '../data/dice-data.js';

let uid = 1;
function nextInstanceId() {
  return `d${uid++}`;
}

/** Creates a fresh bag (array of {instanceId, dieId}) from a list of die ids. */
export function createBag(dieIds) {
  const bag = dieIds.map((dieId) => ({ instanceId: nextInstanceId(), dieId }));
  return shuffle(bag);
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Adds a die to the bag at a random position. Returns the new bag array. */
export function addDie(bag, dieId, count = 1) {
  let next = bag.slice();
  for (let i = 0; i < count; i++) {
    const instance = { instanceId: nextInstanceId(), dieId };
    const pos = Math.floor(Math.random() * (next.length + 1));
    next.splice(pos, 0, instance);
  }
  return next;
}

/** Removes N dice from the bag (front of queue = "oldest"). Returns { bag, removed }. */
export function removeDice(bag, count = 1) {
  const removed = bag.slice(0, count);
  const remaining = bag.slice(count);
  return { bag: remaining, removed };
}

/** Removes one specific die instance (used for Paladin's "choose which to roll"). */
export function removeInstance(bag, instanceId) {
  const idx = bag.findIndex((d) => d.instanceId === instanceId);
  if (idx === -1) return { bag, removed: null };
  const removed = bag[idx];
  const remaining = bag.slice(0, idx).concat(bag.slice(idx + 1));
  return { bag: remaining, removed };
}

/** Draws (removes) the next die from the front of the bag. */
export function drawNext(bag) {
  if (bag.length === 0) return { bag, die: null };
  const [die, ...rest] = bag;
  return { bag: rest, die };
}

/** Peeks at the next N dice without removing them (Mage ability). */
export function peek(bag, count = 1) {
  return bag.slice(0, count);
}

/** Rolls a die instance, returning the face that came up. */
export function rollDie(dieInstance) {
  const def = getDieDef(dieInstance.dieId);
  const face = def.faces[Math.floor(Math.random() * def.faces.length)];
  return { ...face, dieId: dieInstance.dieId, dieName: def.name };
}

export function bagCount(bag) {
  return bag.length;
}
