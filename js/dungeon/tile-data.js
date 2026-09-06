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

// Corridor tiles for "empty" and "monster" rooms (which use a plain
// hallway backdrop, plus a monster sprite overlay for the latter).
// The stone region has full geometry variety; other regions currently
// have one signature corridor look each — more can be dropped in later
// without touching any other file.
const REGION_CORRIDOR_TILES = {
  stone: ['01_straight_forward.png', '02_turn_left.png', '03_turn_right.png', '04_t_junction.png', '05_cross_intersection.png'],
  bone: ['25_web_corridor.png'],
  ember: ['27_lava_corridor.png'],
  arcane: ['26_ice_corridor.png'],
  void: ['24_fog_mist.png'],
};

function pickCorridorTile(theme, roomIndex) {
  const tiles = REGION_CORRIDOR_TILES[theme] || REGION_CORRIDOR_TILES.stone;
  return tiles[roomIndex % tiles.length];
}

/** Returns the asset path (not just filename) for a given room + region theme. */
export function getTileForRoom(room, theme) {
  let filename;
  if (room.kind === 'treasure') {
    filename = room.resolved ? TREASURE_OPEN : TREASURE_CLOSED;
  } else if (KIND_TILES[room.kind]) {
    filename = KIND_TILES[room.kind];
  } else {
    filename = pickCorridorTile(theme, room.index);
  }
  return `${TILE_DIR}/${filename}`;
}

export function stairsDownTile() {
  return `${TILE_DIR}/19_stairs_down.png`;
}
export function stairsUpTile() {
  return `${TILE_DIR}/18_stairs_up.png`;
}
