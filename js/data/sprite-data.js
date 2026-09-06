// ============================================================
// SPRITE-DATA.JS — metadata for the real art assets (pixel-art
// monster sheets, rendered dice, and combat FX bursts). Kept
// separate from the gameplay data files (monster-data.js etc.)
// since this is purely presentational.
//
// Monster/FX sheets are horizontal filmstrips of equal-width
// frames, cycled by js/ui/sprite-fx.js via background-position
// (not CSS @keyframes, since frame counts vary per sheet).
// ============================================================

export const MONSTER_SPRITES = {
  goblin: { file: 'assets/monsters/goblin.png', frameW: 25, frameH: 25, frames: 4 },
  goblin_brute: { file: 'assets/monsters/goblin_brute.png', frameW: 25, frameH: 25, frames: 4 },
  skeleton: { file: 'assets/monsters/skeleton.png', frameW: 19, frameH: 20, frames: 4 },
  skeleton_knight: { file: 'assets/monsters/skeleton_knight.png', frameW: 19, frameH: 20, frames: 4 },
  batilisk: { file: 'assets/monsters/batilisk.png', frameW: 25, frameH: 25, frames: 4 },
  bogslium: { file: 'assets/monsters/bogslium.png', frameW: 39, frameH: 26, frames: 4 },
  lizard_monk: { file: 'assets/monsters/lizard_monk.png', frameW: 21, frameH: 20, frames: 4 },
  orc_archer: { file: 'assets/monsters/orc_archer.png', frameW: 20, frameH: 18, frames: 4 },
  ghost: { file: 'assets/monsters/ghost.png', frameW: 19, frameH: 28, frames: 4 },
  minotaur: { file: 'assets/monsters/minotaur.png', frameW: 31, frameH: 24, frames: 4 },
  dragon: { file: 'assets/monsters/dragon.png', frameW: 70, frameH: 73, frames: 6 },
};

// One rendered d6 per die "theme" (see js/data/dice-data.js theme field).
export const DIE_THEME_ART = {
  stone: 'assets/dice/stone.png',
  ember: 'assets/dice/ember.png',
  gold: 'assets/dice/gold.png',
  verdant: 'assets/dice/verdant.png',
  arcane: 'assets/dice/arcane.png',
  void: 'assets/dice/void.png',
  lucky: 'assets/dice/lucky.png',
};

export const FX_SPRITES = {
  releaseHit: { file: 'assets/fx/release-hit.png', frameW: 51, frameH: 51, frames: 5 },
  bustShock: { file: 'assets/fx/bust-shock.png', frameW: 46, frameH: 46, frames: 5 },
  critBurst: { file: 'assets/fx/crit-burst.png', frameW: 13, frameH: 13, frames: 4 },
  fireBurst: { file: 'assets/fx/fire-burst.png', frameW: 13, frameH: 13, frames: 4 },
  healSparkle: { file: 'assets/fx/heal-sparkle.png', frameW: 6, frameH: 6, frames: 4 },
  sparkle: { file: 'assets/fx/sparkle.png', frameW: 7, frameH: 7, frames: 4 },
};

export function getMonsterSprite(monsterId) {
  return MONSTER_SPRITES[monsterId] || null;
}
