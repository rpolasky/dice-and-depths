// ============================================================
// TILE-DATA.JS — maps room kinds + region themes to the real
// dungeon artwork in assets/dungeon/ (AI-generated, license-free,
// provided by the project owner). This is intentionally the ONLY
// file that knows actual filenames — everything else just asks
// "what tile represents this room" and gets a path back, so a
// future higher-resolution art drop only touches this file.
// ============================================================

const TILE_DIR = 'assets/dungeon';

// Tiles keyed directly by room kind (these show the room's contents,
// so they don't vary by region).
const KIND_TILES = {
  boss: '11_large_room.png',
  hidden_dice: '17_pot_urn.png',
  trap: '20_trap.png',
  puzzle: '36_puzzle_statues.png',
  shrine: '21_shrine.png',
  story: '37_rune_pedestal.png',
};

const TREASURE_CLOSED = '12_chest_closed.png';
const TREASURE_OPEN = '13_chest_open.png';
const DEAD_END = '10_small_room.png';
const STAIRS_DOWN = '19_stairs_down.png';

// Corridor tiles for "empty" and "monster" rooms (which use a plain
// hallway backdrop, plus a monster sprite overlay for the latter).
// The stone region has full junction-shape art and picks based on the
// player's actual relative exits (see pickStoneCorridorTile). Other
// regions currently have one signature corridor look each — more can
// be dropped in later without touching any other file.
const REGION_SINGLE_CORRIDOR = {
  bone: '25_web_corridor.png',
  ember: '27_lava_corridor.png',
  arcane: '26_ice_corridor.png',
  void: '24_fog_mist.png',
};

const STONE_STRAIGHT = '01_straight_forward.png';
const STONE_TURN_LEFT = '02_turn_left.png';
const STONE_TURN_RIGHT = '03_turn_right.png';
const STONE_T_JUNCTION = '04_t_junction.png';
const STONE_CROSS = '05_cross_intersection.png';

/**
 * Picks stone-region corridor art from the player's actual relative
 * exits (forward/left/right — "back" is always open since that's where
 * they came from, so it doesn't affect which tile reads correctly).
 */
function pickStoneCorridorTile(exits) {
  const { forward, left, right } = exits;
  if (forward && left && right) return STONE_CROSS;
  if (forward && (left || right)) return STONE_T_JUNCTION;
  if (!forward && left && right) return STONE_T_JUNCTION;
  if (forward) return STONE_STRAIGHT;
  if (left) return STONE_TURN_LEFT;
  if (right) return STONE_TURN_RIGHT;
  return DEAD_END; // only the way back is open
}

function pickCorridorTile(theme, exits) {
  if (theme === 'stone' || !REGION_SINGLE_CORRIDOR[theme]) return pickStoneCorridorTile(exits);
  return REGION_SINGLE_CORRIDOR[theme];
}

/**
 * Returns the asset path (not just filename) for a given room + region
 * theme. `exits` (relative forward/left/right/back booleans — see
 * js/dungeon/movement.js relativeExits()) is required for 'empty' and
 * 'monster' rooms so the corridor art matches the actual junction shape;
 * it's ignored for rooms with their own dedicated art (treasure, trap...).
 */
export function getTileForRoom(room, theme, exits = { forward: true, left: false, right: false, back: true }) {
  let filename;
  if (room.kind === 'treasure') {
    filename = room.resolved ? TREASURE_OPEN : TREASURE_CLOSED;
  } else if (KIND_TILES[room.kind]) {
    filename = KIND_TILES[room.kind];
  } else if (room.isExit) {
    filename = STAIRS_DOWN; // clear visual signal this room leads to the next floor
  } else {
    filename = pickCorridorTile(theme, exits);
  }
  return `${TILE_DIR}/${filename}`;
}

export function stairsDownTile() {
  return `${TILE_DIR}/19_stairs_down.png`;
}
export function stairsUpTile() {
  return `${TILE_DIR}/18_stairs_up.png`;
}
