// ============================================================
// FLOOR-DATA.JS — region metadata + procedural floor generation.
// Floors are generated as a simple grid of rooms with a fixed
// event assigned to each room. Kept intentionally small/simple
// for the vertical slice (a line of rooms with a couple branches).
// ============================================================

export const REGIONS = [
  { id: 'forgotten_halls', name: 'The Forgotten Halls', floors: [1, 10], theme: 'stone',
    monsterPool: ['goblin', 'skeleton', 'batilisk', 'lizard_monk', 'goblin_brute'] },
  { id: 'catacombs', name: 'The Catacombs', floors: [11, 20], theme: 'bone',
    monsterPool: ['skeleton', 'skeleton_knight', 'ghost', 'bogslium', 'orc_archer'] },
  { id: 'infernal_depths', name: 'The Infernal Depths', floors: [21, 30], theme: 'ember',
    monsterPool: ['bogslium', 'minotaur', 'ghost', 'dragon'] },
  { id: 'astral_ruins', name: 'The Astral Ruins', floors: [31, 40], theme: 'arcane',
    monsterPool: ['ghost', 'minotaur', 'orc_archer'] },
  { id: 'abyss', name: 'The Abyss', floors: [41, 50], theme: 'void',
    monsterPool: ['minotaur', 'dragon', 'ghost'] },
];

export function getRegionForFloor(floorNumber) {
  return REGIONS.find((r) => floorNumber >= r.floors[0] && floorNumber <= r.floors[1]) || REGIONS[REGIONS.length - 1];
}

const EVENT_KINDS = ['monster', 'treasure', 'hidden_dice', 'trap', 'puzzle', 'shrine', 'story', 'empty'];

// Simple seeded RNG so a given floor number always generates the same layout
// within a save (keeps things debuggable), while still feeling varied.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a floor as a straight corridor of N rooms (with the option
 * to extend later into branches) — enough to demonstrate the full loop
 * without over-engineering dungeon topology for the vertical slice.
 */
export function generateFloor(floorNumber, opts = {}) {
  const region = getRegionForFloor(floorNumber);
  const rng = mulberry32(floorNumber * 7919 + 13);
  const length = opts.length || (6 + Math.floor(rng() * 3));
  const isBossFloor = floorNumber % 10 === 0;

  const rooms = [];
  for (let i = 0; i < length; i++) {
    const isLast = i === length - 1;
    let kind;
    if (isLast && isBossFloor) {
      kind = 'boss';
    } else if (i === 0) {
      kind = 'empty'; // entrance is always safe
    } else {
      const roll = rng();
      if (roll < 0.30) kind = 'monster';
      else if (roll < 0.45) kind = 'treasure';
      else if (roll < 0.58) kind = 'hidden_dice';
      else if (roll < 0.68) kind = 'trap';
      else if (roll < 0.80) kind = 'puzzle';
      else if (roll < 0.88) kind = 'shrine';
      else if (roll < 0.94) kind = 'story';
      else kind = 'empty';
    }

    let extractionPoint = false;
    if (!isLast && i > 0 && i % 3 === 0) extractionPoint = true;

    let monsterId = null;
    if (kind === 'monster') {
      monsterId = region.monsterPool[Math.floor(rng() * region.monsterPool.length)];
    } else if (kind === 'boss') {
      monsterId = region.monsterPool.find((m) => m.includes('dragon')) || region.monsterPool[region.monsterPool.length - 1];
    }

    rooms.push({
      index: i,
      x: i, y: 0,
      kind,
      monsterId,
      extractionPoint,
      resolved: false,
    });
  }

  return {
    floorNumber,
    regionId: region.id,
    regionName: region.name,
    theme: region.theme,
    rooms,
    length,
  };
}
