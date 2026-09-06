// ============================================================
// ENCOUNTERS.JS — resolves what happens when the player interacts
// with the room they are standing in. Combat is handed off to
// combat.js by the caller (game.js); everything else resolves here.
// ============================================================

import { BALANCE } from '../data/balance.js';
import { TREASURE_TABLES, randomPuzzle, randomEvent } from '../data/content-data.js';
import { getDieDef } from '../data/dice-data.js';

const ROOM_FLAVOR = {
  monster: { icon: '⚔️', title: 'A monster blocks the way.' },
  boss: { icon: '🐉', title: 'Something enormous stirs ahead.' },
  treasure: { icon: '💰', title: 'A glint of treasure catches your eye.' },
  hidden_dice: { icon: '🎲', title: 'This room feels worth searching.' },
  trap: { icon: '⚠️', title: 'Something feels off here.' },
  puzzle: { icon: '🧩', title: 'An ancient mechanism blocks the way.' },
  shrine: { icon: '🕯️', title: 'A strange shrine hums quietly.' },
  story: { icon: '📜', title: 'You find a fragment of the dungeon\'s history.' },
  empty: { icon: '🚪', title: 'An empty stretch of corridor.' },
};

export function describeRoom(room) {
  return ROOM_FLAVOR[room.kind] || ROOM_FLAVOR.empty;
}

export function rollTreasureChoices(rareChance = 0.35) {
  const pool = Math.random() < rareChance ? TREASURE_TABLES.rare : TREASURE_TABLES.common;
  const commonPool = TREASURE_TABLES.common;
  const choices = new Set();
  choices.add(pool[Math.floor(Math.random() * pool.length)]);
  while (choices.size < 3) {
    choices.add(commonPool[Math.floor(Math.random() * commonPool.length)]);
  }
  return Array.from(choices).map((id) => getDieDef(id));
}

export function resolveSearch(searchBonusChance = 0) {
  const successChance = Math.min(0.95, BALANCE.search.baseSuccessChance + searchBonusChance);
  const roll = Math.random();
  if (roll > successChance) {
    if (Math.random() < BALANCE.search.trapChance) {
      return { outcome: 'trap', damage: 8 + Math.floor(Math.random() * 8) };
    }
    return { outcome: 'nothing' };
  }
  const foundDice = 1 + (Math.random() < 0.3 ? 1 : 0);
  const dieId = Math.random() < 0.2 ? 'power_die' : 'basic_die';
  return { outcome: 'found', dieId, count: foundDice };
}

export function resolveTrap() {
  const roll = Math.random();
  if (roll < 0.6) return { outcome: 'damage', value: 10 + Math.floor(Math.random() * 10) };
  if (roll < 0.85) return { outcome: 'cursedDie' };
  return { outcome: 'loseDie' };
}

export function pickPuzzle() {
  return randomPuzzle();
}

export function pickShrineEvent() {
  return randomEvent();
}

export function resolveStory(floorNumber) {
  const fragments = [
    'The walls here are older than the halls above — carved by hands that were not quite human.',
    'A journal page, half-burned: "...the Core calls to us. We should not have answered."',
    'Faded murals depict an expedition much like your own, descending toward a pulsing light.',
    'Scratched into the stone: "Turn back. There is nothing to win below the Abyss."',
    'A cold draft carries a whisper: the corruption is not the enemy. It is a symptom.',
  ];
  return fragments[floorNumber % fragments.length];
}
