// ============================================================
// DUNGEON.JS — manages the current floor's maze and the player's
// position + facing within it. Rooms are looked up by grid
// coordinate (see floor-data.js's roomKey), not by a flat index —
// this is what makes turning actually change what's ahead.
// ============================================================

import { generateFloor, getRoom, DIRECTIONS } from '../data/floor-data.js';

export { DIRECTIONS };

export function enterFloor(floorNumber) {
  const floor = generateFloor(floorNumber);
  const entranceRoom = getRoom(floor, floor.entrance.x, floor.entrance.y);
  // Face whichever direction the entrance actually opens onto, rather
  // than a hardcoded 'north' — otherwise the very first room can render
  // (and behave) like a dead end until the player figures out to turn.
  const initialDirection = DIRECTIONS.find((dir) => entranceRoom.connections[dir]) || 'north';
  return {
    floor,
    position: { x: floor.entrance.x, y: floor.entrance.y, direction: initialDirection },
  };
}

export function currentRoom(dungeonState) {
  return getRoom(dungeonState.floor, dungeonState.position.x, dungeonState.position.y);
}

/** Whether the room ahead (in the current facing direction) is reachable. */
export function canMoveForward(dungeonState) {
  const room = currentRoom(dungeonState);
  return !!room.connections[dungeonState.position.direction];
}

export function isFloorComplete(dungeonState) {
  const room = currentRoom(dungeonState);
  return !!room.isExit && room.resolved;
}

export function markRoomResolved(dungeonState) {
  const room = currentRoom(dungeonState);
  room.resolved = true;
  // Rooms are mutated in place (they live in a Map, not a redrawn array),
  // so we still return a fresh top-level object to trigger a store update.
  return { ...dungeonState, floor: { ...dungeonState.floor } };
}
