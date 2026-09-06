// ============================================================
// FLOOR-DATA.JS — region metadata + procedural floor generation.
//
// Floors are a real branching maze on a grid (not a single line of
// rooms): a randomized depth-first "growing tree" carve produces a
// spanning tree (no loops, so there's always exactly one path between
// any two rooms) with genuine dead ends and forks — turning left or
// right at a junction actually leads somewhere different.
//
// Room lookup is by "x,y" key (see roomKey()). The room farthest from
// the entrance (by graph distance) becomes the floor's exit — a
// staircase down (or the boss chamber, on a region's final floor).
// ============================================================

import { MONSTER_DATA } from './monster-data.js';

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

export const DIRECTIONS = ['north', 'east', 'south', 'west'];
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
const DELTA = {
  north: { dx: 0, dy: -1 }, east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 }, west: { dx: -1, dy: 0 },
};

export function roomKey(x, y) { return `${x},${y}`; }

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

/** Tier cap by absolute floor number: early game stays safe regardless of
 *  which region it's in. A region-relative cap doesn't work here because
 *  some regions (e.g. Infernal Depths) have no tier-1 monsters in their
 *  pool at all — gating by real progression through the whole dungeon
 *  is what actually keeps a floor-1 player away from elites. */
function tierCapForFloor(floorNumber) {
  if (floorNumber <= 3) return 1;
  if (floorNumber <= 15) return 2;
  return 3;
}

function weightedRoomKind(rng) {
  const roll = rng();
  if (roll < 0.26) return 'monster';
  if (roll < 0.40) return 'treasure';
  if (roll < 0.52) return 'hidden_dice';
  if (roll < 0.62) return 'trap';
  if (roll < 0.74) return 'puzzle';
  if (roll < 0.84) return 'shrine';
  if (roll < 0.92) return 'story';
  return 'empty';
}

/**
 * Generates a floor as a branching maze. Deterministic per floor number
 * (same seed -> same layout), matching the previous corridor generator's
 * debuggability while actually branching.
 */
export function generateFloor(floorNumber, opts = {}) {
  const region = getRegionForFloor(floorNumber);
  const rng = mulberry32(floorNumber * 7919 + 13);
  const targetCount = opts.roomCount || (9 + Math.floor(rng() * 4)); // 9-12 rooms
  const isBossFloor = floorNumber % 10 === 0;
  const tierCap = tierCapForFloor(floorNumber);
  const pool = region.monsterPool.filter((id) => (MONSTER_DATA[id]?.tier ?? 1) <= tierCap);
  const safePool = pool.length ? pool : region.monsterPool;

  // --- Carve a spanning-tree maze via randomized DFS ("growing tree") ---
  // Plain object (not a Map) so the whole floor can round-trip through
  // JSON.stringify for the save system.
  const rooms = {};
  const startRoom = { x: 0, y: 0, connections: {}, kind: 'empty', monsterId: null, resolved: false, extractionPoint: false, isExit: false, visited: true, distance: 0 };
  rooms[roomKey(0, 0)] = startRoom;
  const stack = [startRoom];

  while (stack.length && Object.keys(rooms).length < targetCount) {
    const current = stack[stack.length - 1];
    const unvisitedDirs = DIRECTIONS.filter((dir) => {
      const { dx, dy } = DELTA[dir];
      return !(roomKey(current.x + dx, current.y + dy) in rooms);
    });
    if (unvisitedDirs.length === 0) { stack.pop(); continue; }

    const dir = pick(rng, unvisitedDirs);
    const { dx, dy } = DELTA[dir];
    const nx = current.x + dx;
    const ny = current.y + dy;
    const next = {
      x: nx, y: ny, connections: {}, kind: 'empty', monsterId: null,
      resolved: false, extractionPoint: false, isExit: false, visited: false, distance: current.distance + 1,
    };
    current.connections[dir] = true;
    next.connections[OPPOSITE[dir]] = true;
    rooms[roomKey(nx, ny)] = next;
    stack.push(next);
  }

  // --- Find the room farthest from the entrance (BFS) -> the exit ---
  let farthest = startRoom;
  for (const room of Object.values(rooms)) {
    if (room.distance > farthest.distance) farthest = room;
  }
  farthest.isExit = true;

  // --- Assign room kinds (entrance and exit are handled specially) ---
  for (const room of Object.values(rooms)) {
    if (room === startRoom) { room.kind = 'empty'; continue; }
    if (room === farthest) {
      if (isBossFloor) {
        room.kind = 'boss';
        room.monsterId = safePool.find((id) => MONSTER_DATA[id]?.boss)
          || region.monsterPool.find((id) => MONSTER_DATA[id]?.boss)
          || region.monsterPool[region.monsterPool.length - 1];
      } else {
        room.kind = 'empty'; // a clean, unobstructed staircase down
      }
      continue;
    }
    room.kind = weightedRoomKind(rng);
    if (room.kind === 'monster') {
      room.monsterId = pick(rng, safePool);
    }
  }

  // --- Extraction points: 1-2 rooms at distance >= 2, never the exit ---
  const candidates = Object.values(rooms).filter((r) => r !== startRoom && r !== farthest && r.distance >= 2);
  const extractionCount = Math.min(candidates.length, 1 + Math.floor(rng() * 2));
  const chosen = new Set();
  for (let i = 0; i < extractionCount && chosen.size < candidates.length; i++) {
    const room = pick(rng, candidates);
    room.extractionPoint = true;
    chosen.add(room);
  }

  return {
    floorNumber,
    regionId: region.id,
    regionName: region.name,
    theme: region.theme,
    rooms,
    entrance: { x: 0, y: 0 },
    exit: { x: farthest.x, y: farthest.y },
    roomCount: Object.keys(rooms).length,
  };
}

export function getRoom(floor, x, y) {
  return floor.rooms[roomKey(x, y)];
}
