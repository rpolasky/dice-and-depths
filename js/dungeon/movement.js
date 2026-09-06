// ============================================================
// MOVEMENT.JS — grid-based first-person movement primitives.
// Intentionally simple: FORWARD / TURN LEFT / TURN RIGHT / INTERACT.
// ============================================================

import { DIRECTIONS, canMoveForward } from './dungeon.js';

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

/** Moves forward one room in the corridor (vertical-slice: linear progress). */
export function moveForward(dungeonState) {
  if (!canMoveForward(dungeonState)) return dungeonState;
  const { dx, dy } = DELTA[dungeonState.position.direction];
  return {
    ...dungeonState,
    roomIndex: dungeonState.roomIndex + 1,
    position: {
      ...dungeonState.position,
      x: dungeonState.position.x + dx,
      y: dungeonState.position.y + dy,
    },
  };
}
