// ============================================================
// SAVE.JS — versioned save/load via localStorage.
// Bump CURRENT_VERSION and add a migration whenever the shape
// of saved state changes, so old saves keep loading.
// ============================================================

import { store, freshState } from './state.js';

const SAVE_KEY = 'dicecrawl_save_v1';
export const CURRENT_VERSION = 1;

const migrations = {
  // Example for the future:
  // 1: (data) => ({ ...data, saveVersion: 2, permanent: { ...data.permanent, newField: true } }),
};

export function saveGame() {
  try {
    const { screen, debugPanelOpen, ...persisted } = store.get();
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
