// ============================================================
// TILE-DATA.JS — maps room kinds + region themes to the real
// dungeon artwork in assets/dungeon/ (AI-generated, license-free,
// provided by the project owner). This is intentionally the ONLY
// file that knows actual filenames — everything else just asks
// "what tile represents this room" and gets a path back, so a
// future higher-resolution art drop only touches this file.
//
// assets/dungeon/hires/ holds a second, native-portrait (768x1376,
// true ~9:16) art pass that supersedes the original lower-res pack
// for the tiles it covers. The original pack's files remain for the
// per-region single corridors (bone/ember/arcane/void) and anything
// the hires pass didn't cover (puzzle, shrine, treasure-open).
// ============================================================

const TILE_DIR = 'assets/dungeon';
const HIRES_DIR = 'assets/dungeon/hires';

// Tiles keyed directly by room kind (these show the room's contents,
// so they don't vary by region).
const KIND_TILES = {
  boss: `${HIRES_DIR}/boss-door.jpg`,
  hidden_dice: `${HIRES_DIR}/hidden-dice.jpg`,
  trap: `${HIRES_DIR}/trap.jpg`,
  puzzle: `${TILE_DIR}/36_puzzle_statues.png`,
  shrine: `${TILE_DIR}/21_shrine.png`,
  story: `${HIRES_DIR}/story-rune.jpg`,
  monster: `${HIRES_DIR}/monster-corridor.jpg`,
};

const TREASURE_CLOSED = `${HIRES_DIR}/treasure-closed.jpg`;
const TREASURE_OPEN = `${TILE_DIR}/13_chest_open.png`;
const DEAD_END = `${HIRES_DIR}/dead-end.jpg`;
const STAIRS_DOWN = `${HIRES_DIR}/stairs-down.jpg`;

// Corridor tiles for "empty" rooms (monster rooms have their own
// dedicated backdrop above, plus a monster sprite overlay). The stone
// region has real junction-shape art and picks based on the player's
// actual relative exits (see pickStoneCorridorTile). Other regions
// currently have one signature corridor look each — more can be
// dropped in later without touching any other file.
const REGION_SINGLE_CORRIDOR = {
  bone: `${TILE_DIR}/25_web_corridor.png`,
  ember: `${TILE_DIR}/27_lava_corridor.png`,
  arcane: `${TILE_DIR}/26_ice_corridor.png`,
  void: `${TILE_DIR}/24_fog_mist.png`,
};

const STONE_STRAIGHT = `${HIRES_DIR}/straight.jpg`;
const STONE_TURN_LEFT = `${HIRES_DIR}/turn-left.jpg`;
const STONE_T_JUNCTION = `${HIRES_DIR}/t-junction.jpg`;
const STONE_CROSS = `${HIRES_DIR}/cross-intersection.jpg`;
// No distinct "turn right" shot exists yet — the turn-left art is
// mirrored horizontally instead of duplicating/AI-generating a new
// image. getTileForRoom() returns { path, flip } so the renderer can
// apply this; every other case returns flip: false.

/**
 * Picks stone-region corridor art from the player's actual relative
 * exits (forward/left/right — "back" is always open since that's where
 * they came from, so it doesn't affect which tile reads correctly).
 * Returns { path, flip }.
 */
function pickStoneCorridorTile(exits) {
  const { forward, left, right } = exits;
  if (forward && left && right) return { path: STONE_CROSS, flip: false };
  if (forward && (left || right)) return { path: STONE_T_JUNCTION, flip: false };
  if (!forward && left && right) return { path: STONE_T_JUNCTION, flip: false };
  if (forward) return { path: STONE_STRAIGHT, flip: false };
  if (left) return { path: STONE_TURN_LEFT, flip: false };
  if (right) return { path: STONE_TURN_LEFT, flip: true }; // mirrored stand-in for turn-right
  return { path: DEAD_END, flip: false }; // only the way back is open
}

function pickCorridorTile(theme, exits) {
  if (theme === 'stone' || !REGION_SINGLE_CORRIDOR[theme]) return pickStoneCorridorTile(exits);
  return { path: REGION_SINGLE_CORRIDOR[theme], flip: false };
}

/**
 * Returns { path, flip } for a given room + region theme. `exits`
 * (relative forward/left/right/back booleans — see
 * js/dungeon/movement.js relativeExits()) is required for 'empty' rooms
 * so the corridor art matches the actual junction shape; it's ignored
 * for rooms with their own dedicated art (treasure, trap, monster...).
 */
export function getTileForRoom(room, theme, exits = { forward: true, left: false, right: false, back: true }) {
  if (room.kind === 'treasure') {
    return { path: room.resolved ? TREASURE_OPEN : TREASURE_CLOSED, flip: false };
  }
  if (KIND_TILES[room.kind]) {
    return { path: KIND_TILES[room.kind], flip: false };
  }
  if (room.isExit) {
    return { path: STAIRS_DOWN, flip: false }; // clear visual signal this room leads to the next floor
  }
  return pickCorridorTile(theme, exits);
}
