// ============================================================
// RENDERER.JS — the swappable contract between game logic and
// dungeon visuals.
//
// To replace the placeholder art later:
//   1. Write a new class implementing the same two methods below
//      (e.g. FirstPersonDungeonRenderer in a new file).
//   2. Feed it a theme asset manifest (see ASSET_MANIFEST) with
//      real texture/model URLs instead of the placeholder colors.
//   3. Call setActiveRenderer(new FirstPersonDungeonRenderer())
//      once, during startup, in main.js.
// Nothing in dungeon.js, movement.js, encounters.js, combat.js,
// or game.js needs to change.
// ============================================================

/**
 * Renderer contract (duck-typed, not a hard class requirement):
 *   mount(containerEl) -> called once when the dungeon screen opens
 *   renderScene(sceneDescriptor) -> called whenever the scene changes
 *
 * sceneDescriptor shape:
 * {
 *   theme: 'stone' | 'bone' | 'ember' | 'arcane' | 'void',
 *   roomKind: 'monster' | 'treasure' | 'hidden_dice' | 'trap' | 'puzzle'
 *            | 'shrine' | 'story' | 'empty' | 'boss',
 *   monsterIcon: string | null,
 *   direction: 'north' | 'east' | 'south' | 'west',
 *   depthRemaining: number,
 *   resolved: boolean,
 * }
 */

// Placeholder "asset manifest" — swap these for real texture/model URLs
// per region when final art arrives. Keys intentionally mirror what a
// real 3D renderer would need (wall/floor/ceiling/door/torch).
export const ASSET_MANIFEST = {
  stone: { wall: '#2a2d3a', floor: '#1a1c24', ceiling: '#141620', accent: '#e8a33d', fog: '#0d0e13' },
  bone: { wall: '#3a3428', floor: '#211d17', ceiling: '#161310', accent: '#d8c9a3', fog: '#0f0d0a' },
  ember: { wall: '#3a1f1a', floor: '#26120e', ceiling: '#1a0b08', accent: '#ff6b35', fog: '#140705' },
  arcane: { wall: '#231a3a', floor: '#150f26', ceiling: '#0f0a1a', accent: '#8b6be0', fog: '#0a0714' },
  void: { wall: '#151519', floor: '#0a0a0d', ceiling: '#050506', accent: '#7fe0d0', fog: '#020203' },
};

let activeRenderer = null;

export function setActiveRenderer(renderer) {
  activeRenderer = renderer;
}

export function getActiveRenderer() {
  return activeRenderer;
}
