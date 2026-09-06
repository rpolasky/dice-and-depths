// ============================================================
// MOVEMENT.JS — grid-based first-person movement.
//
// goRelative() is the primary action the UI calls: tapping a
// direction both turns to face it and steps into it in one motion,
// and is only enabled when a door actually exists that way — this
// is what makes a fork in the maze a real, single-tap decision
// instead of a "turn, then separately check if forward works" chore.
// turnLeft/turnRight/moveForward remain as lower-level primitives
// (used by the debug panel and available for a future free-look mode).
// ============================================================

import { DIRECTIONS, canMoveForward, currentRoom } from './dungeon.js';
import { getRoom } from '../data/floor-data.js';

const DELTA = {
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
};

export function turnLeft(dungeonState) {
  const idx = DIRECTIONS.indexOf(dungeonState.position.direction);
  const direction = DIRECTIONS[(idx + 3) % 4];
  return { ...dungeonState, position: { ...dungeonState.position, direction } };
}

export function turnRight(dungeonState) {
  const idx = DIRECTIONS.indexOf(dungeonState.position.direction);
  const direction = DIRECTIONS[(idx + 1) % 4];
  return { ...dungeonState, position: { ...dungeonState.position, direction } };
}

/** Moves into the room ahead, if (and only if) there's a door that way. */
export function moveForward(dungeonState) {
  if (!canMoveForward(dungeonState)) return dungeonState;
  const { dx, dy } = DELTA[dungeonState.position.direction];
  return {
    ...dungeonState,
    position: {
      ...dungeonState.position,
      x: dungeonState.position.x + dx,
      y: dungeonState.position.y + dy,
    },
  };
}

/**
 * Relative exits from the current room, given current facing —
 * used by the renderer to decide which corridor art to show and by
 * the UI to decide which movement buttons are usable right now.
 */
export function relativeExits(dungeonState) {
  const room = currentRoom(dungeonState);
  const idx = DIRECTIONS.indexOf(dungeonState.position.direction);
  const leftDir = DIRECTIONS[(idx + 3) % 4];
  const rightDir = DIRECTIONS[(idx + 1) % 4];
  const backDir = DIRECTIONS[(idx + 2) % 4];
  return {
    forward: !!room.connections[dungeonState.position.direction],
    left: !!room.connections[leftDir],
    right: !!room.connections[rightDir],
    back: !!room.connections[backDir],
  };
}

const REL_OFFSET = { forward: 0, right: 1, back: 2, left: 3 };

/**
 * Turns to face a relative direction AND steps into it in one action —
 * this is the primary movement action the UI calls. Turning-without-
 * moving is intentionally not exposed as a separate step: a button for
 * a direction with no door there is simply disabled, so every tap does
 * something. No-ops (returns the same state) if that direction is walled.
 */
export function goRelative(dungeonState, rel) {
  const idx = DIRECTIONS.indexOf(dungeonState.position.direction);
  const targetDir = DIRECTIONS[(idx + REL_OFFSET[rel]) % 4];
  const room = currentRoom(dungeonState);
  if (!room.connections[targetDir]) return dungeonState;
  const { dx, dy } = DELTA[targetDir];
  return {
    ...dungeonState,
    position: { x: dungeonState.position.x + dx, y: dungeonState.position.y + dy, direction: targetDir },
  };
}

/** Room that lies ahead of the player right now, or null if there's a wall. */
export function roomAhead(dungeonState) {
  if (!canMoveForward(dungeonState)) return null;
  const { dx, dy } = DELTA[dungeonState.position.direction];
  return getRoom(dungeonState.floor, dungeonState.position.x + dx, dungeonState.position.y + dy);
}
