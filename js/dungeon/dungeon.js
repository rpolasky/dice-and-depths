// ============================================================
// DUNGEON.JS — manages the current floor's room graph and the
// player's position within it. For the vertical slice, a floor
// is a straight corridor of rooms (see data/floor-data.js);
// the coordinate system (x, y, direction) is still tracked so a
// branching/2D layout can be dropped in later without touching
// callers.
// ============================================================

import { generateFloor } from '../data/floor-data.js';

export const DIRECTIONS = ['north', 'east', 'south', 'west'];

export function enterFloor(floorNumber) {
  const floor = generateFloor(floorNumber);
  return {
    floor,
    position: { x: 0, y: 0, direction: 'north' },
    roomIndex: 0,
  };
}

export function currentRoom(dungeonState) {
  return dungeonState.floor.rooms[dungeonState.roomIndex];
}

export function canMoveForward(dungeonState) {
  const room = currentRoom(dungeonState);
  return !room.blocksProgress && dungeonState.roomIndex < dungeonState.floor.rooms.length - 1;
}

export function isFloorComplete(dungeonState) {
  return dungeonState.roomIndex >= dungeonState.floor.rooms.length - 1
    && currentRoom(dungeonState).resolved;
}

export function markRoomResolved(dungeonState) {
  const rooms = dungeonState.floor.rooms.slice();
  rooms[dungeonState.roomIndex] = { ...rooms[dungeonState.roomIndex], resolved: true };
  return { ...dungeonState, floor: { ...dungeonState.floor, rooms } };
}

export function blockProgress(dungeonState, blocked) {
  const rooms = dungeonState.floor.rooms.slice();
  rooms[dungeonState.roomIndex] = { ...rooms[dungeonState.roomIndex], blocksProgress: blocked };
  return { ...dungeonState, floor: { ...dungeonState.floor, rooms } };
}
