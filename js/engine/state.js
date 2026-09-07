// ============================================================
// STATE.JS — single source of truth for game state, plus a tiny
// pub/sub so UI modules can react to changes without polling.
// No other module should keep its own copy of persistent state.
// ============================================================

import { BALANCE } from '../data/balance.js';
import { allCharacterIds } from '../data/character-data.js';

function freshCharacterProgress() {
  const progress = {};
  for (const id of allCharacterIds()) {
    progress[id] = { level: 1, xp: 0, bonusDice: [] };
  }
  return progress;
}

function freshState() {
  return {
    saveVersion: 4,

    // PERMANENT PROGRESSION (persists across expeditions/death)
    permanent: {
      unlockedCharacters: ['paladin', 'rogue', 'mage', 'berserker', 'cleric', 'scout'],
      unlockedDiceTypes: ['basic_die', 'power_die', 'healing_die', 'critical_die', 'elemental_die', 'cursed_die', 'lucky_die'],
      diceCapacity: BALANCE.expedition.startingDiceCapacity,
      highestFloorReached: 0,
      bankedGold: 0,
      relics: [],
      storyFlags: [],
      activeParty: [], // character ids chosen at the tavern, carried into the next expedition
      monsterCodex: [], // monster ids the player has actually encountered
      // Per-character level/XP/loot-earned bonus dice — persists across
      // expeditions regardless of who's in the active party, so leveling
      // up (or finding loot for) a bench character is meaningful even
      // before you bring them along. See progression.js.
      characterProgress: freshCharacterProgress(),
      stats: { bestAttackDamage: 0, monstersDefeated: 0, expeditionsRun: 0 },
      settings: { sound: true, haptics: true, reducedMotion: false },
    },

    // EXPEDITION PROGRESSION (lost on death, kept if extracted)
    expedition: null, // see startExpedition() in game.js for shape

    // Meta / UI
    screen: 'title', // title | tavern | party-select | dungeon | extraction-summary | game-over
    debugPanelOpen: false,
    mapOpen: false,
  };
}

class Store {
  constructor() {
    this.state = freshState();
    this.listeners = new Set();
  }

  reset() {
    this.state = freshState();
    this.emit();
  }

  get() {
    return this.state;
  }

  /** Shallow-merge patch into state (or into a named sub-object). */
  update(patch) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.state);
  }
}

export const store = new Store();
export { freshState };
