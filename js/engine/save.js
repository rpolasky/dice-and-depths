// ============================================================
// SAVE.JS — versioned save/load via localStorage.
// Bump CURRENT_VERSION and add a migration whenever the shape
// of saved state changes, so old saves keep loading.
// ============================================================

import { store, freshState } from './state.js';
import { allCharacterIds } from '../data/character-data.js';

const SAVE_KEY = 'dicecrawl_save_v1';
export const CURRENT_VERSION = 4;

const migrations = {
  // v1 saves predate the tavern hub (activeParty/monsterCodex/stats) and
  // the map overlay toggle — fill in sane defaults rather than losing them.
  1: (data) => ({
    ...data,
    saveVersion: 2,
    permanent: {
      activeParty: [],
      monsterCodex: [],
      stats: { bestAttackDamage: 0, monstersDefeated: 0, expeditionsRun: 0 },
      ...data.permanent,
    },
  }),
  // v2 saves predate the branching-maze rework: `dungeon.floor.rooms` was
  // a flat array indexed by `dungeon.roomIndex`, not an object keyed by
  // "x,y" coordinate with `dungeon.position`. There's no sane way to
  // convert an old linear corridor into a maze, so any in-progress
  // expedition/dungeon from a v2 save is discarded — permanent progress
  // (characters, dice, gold, stats) is unaffected.
  2: (data) => ({
    ...data,
    saveVersion: 3,
    expedition: null,
    dungeon: null,
  }),
  // v3 saves predate character leveling — every character starts at
  // level 1 / 0 XP / no bonus dice, same as a brand new save.
  3: (data) => ({
    ...data,
    saveVersion: 4,
    permanent: {
      ...data.permanent,
      characterProgress: Object.fromEntries(
        allCharacterIds().map((id) => [id, { level: 1, xp: 0, bonusDice: [] }])
      ),
    },
  }),
};

/** True if a saved dungeon actually matches the current maze data shape. */
function isValidDungeon(dungeon) {
  return !!(
    dungeon &&
    dungeon.floor &&
    dungeon.floor.rooms &&
    typeof dungeon.floor.rooms === 'object' &&
    !Array.isArray(dungeon.floor.rooms) &&
    dungeon.position &&
    typeof dungeon.position.x === 'number' &&
    typeof dungeon.position.y === 'number'
  );
}

export function saveGame() {
  try {
    const { screen, debugPanelOpen, mapOpen, ...persisted } = store.get();
    localStorage.setItem(SAVE_KEY, JSON.stringify(persisted));
    return true;
  } catch (err) {
    console.error('Save failed:', err);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    let data = JSON.parse(raw);
    data = runMigrations(data);
    // Defense in depth: never trust a saved dungeon that doesn't match
    // the current shape, whatever the version number claims.
    if (!isValidDungeon(data.dungeon)) {
      data = { ...data, dungeon: null, expedition: null };
    }
    store.update({ ...freshState(), ...data, screen: 'title' });
    return true;
  } catch (err) {
    console.error('Load failed:', err);
    return false;
  }
}

export function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
  store.reset();
}

function runMigrations(data) {
  let version = data.saveVersion || 1;
  while (version < CURRENT_VERSION) {
    const migrate = migrations[version];
    if (!migrate) break;
    data = migrate(data);
    version = data.saveVersion;
  }
  return data;
}
