// ============================================================
// OVERCHARGE.JS — the shared party Overcharge meter.
// Pure functions only; combat.js owns the actual fight state.
// ============================================================

import { BALANCE } from '../data/balance.js';

export function getThreshold(overcharge) {
  return BALANCE.overcharge.thresholds.find(
    (t) => overcharge >= t.min && overcharge <= t.max
  ) || BALANCE.overcharge.thresholds[0];
}

export function isBustValue(overcharge) {
  return overcharge >= BALANCE.overcharge.bustAt;
}

/** Computes the damage that would be dealt if RELEASE happened right now. */
export function computeReleaseDamage(overcharge, damageBonusMultiplier = 1) {
  const threshold = getThreshold(overcharge);
  if (threshold.id === 'bust') return 0;
  return Math.round(overcharge * threshold.damageMult * damageBonusMultiplier);
}

export function thresholdList() {
  return BALANCE.overcharge.thresholds.filter((t) => t.id !== 'bust');
}

export function bustCeiling() {
  return BALANCE.overcharge.bustAt;
}
