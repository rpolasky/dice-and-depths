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

// One real hand-painted polyhedron per shape (provided by the project
// owner, no license required) — shared across all die themes, with a
// CSS `filter` recoloring it per theme (see DIE_THEME_FILTER). This
// replaces the earlier per-theme static images: rather than needing a
// separately-painted die for every theme/shape combination, one asset
// per SHAPE covers every theme via color filtering.
export const DIE_SHAPE_ART = {
  d4: 'assets/dice/shapes/d4.png',
  d6: 'assets/dice/shapes/d6.png',
  d8: 'assets/dice/shapes/d8.png',
  d10: 'assets/dice/shapes/d10.png',
  d12: 'assets/dice/shapes/d12.png',
  d20: 'assets/dice/shapes/d20.png',
};

// The source art is a warm ember-red/orange, so `ember` needs no filter;
// every other theme is a genuine CSS color-filter recolor (hue-rotate
// for the base hue shift, saturate/brightness/contrast to keep it
// reading correctly once shifted — a pure hue-rotate on a warm image
// tends to muddy blues/purples without a saturation boost).
export const DIE_THEME_FILTER = {
  ember: 'none',
  gold: 'hue-rotate(32deg) saturate(1.35) brightness(1.08)',
  verdant: 'hue-rotate(112deg) saturate(1.25) brightness(1.02)',
  arcane: 'hue-rotate(232deg) saturate(1.3) brightness(1.05)',
  void: 'hue-rotate(150deg) saturate(0.55) brightness(0.6) contrast(1.1)',
  lucky: 'hue-rotate(52deg) saturate(1.45) brightness(1.15)',
  stone: 'grayscale(0.8) brightness(0.92) contrast(1.05)',
};

/** Which polyhedron a die's face range actually corresponds to. */
export function shapeForMaxFace(maxValue) {
  if (maxValue <= 4) return 'd4';
  if (maxValue <= 6) return 'd6';
  if (maxValue <= 8) return 'd8';
  if (maxValue <= 10) return 'd10';
  if (maxValue <= 12) return 'd12';
  return 'd20';
}

export const FX_SPRITES = {
  releaseHit: { file: 'assets/fx/release-hit.png', frameW: 51, frameH: 51, frames: 5 },
  bustShock: { file: 'assets/fx/bust-shock.png', frameW: 46, frameH: 46, frames: 5 },
  critBurst: { file: 'assets/fx/crit-burst.png', frameW: 13, frameH: 13, frames: 4 },
  fireBurst: { file: 'assets/fx/fire-burst.png', frameW: 13, frameH: 13, frames: 4 },
  healSparkle: { file: 'assets/fx/heal-sparkle.png', frameW: 6, frameH: 6, frames: 4 },
  sparkle: { file: 'assets/fx/sparkle.png', frameW: 7, frameH: 7, frames: 4 },
};

// Single hand-drawn flame (not a filmstrip) — used as the real art for
// the Overcharge bar's flame and for elemental/status FX, animated via
// CSS transform/opacity flicker rather than frame-cycling.
export const FLAME_ART = 'assets/fx/flame-hand.png';

// Carved-stone numeral art (provided by the project owner) for the
// values our dice actually roll. Not every 1-20 value exists as a
// separate file (15 was missing from the source sheet, and none of our
// current dice need it) — getNumeralArt() falls back to null so the UI
// can fall back to styled text for anything not covered here.
const NUMERAL_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 20];
export const NUMERAL_ART = Object.fromEntries(
  NUMERAL_VALUES.map((n) => [n, `assets/dice/numerals/${n}.png`])
);
export function getNumeralArt(value) {
  return NUMERAL_ART[value] || null;
}

// Hand-painted status/effect icons for elemental die faces and special
// results (provided by the project owner).
export const STATUS_ICON_ART = {
  fire: 'assets/fx/icons/rage.png', // reuse the flaming bull head as a general "fire" icon
  poison: 'assets/fx/icons/poison.png',
  lightning: 'assets/fx/icons/lightning.png',
  heal: 'assets/fx/icons/healing.png',
  crit: 'assets/fx/icons/double_sword.png',
  danger: 'assets/fx/icons/skull.png',
  // 'ice' intentionally has no dedicated icon yet — falls back to
  // styled text rather than reusing an unrelated icon.
};
export function getStatusIcon(key) {
  return STATUS_ICON_ART[key] || null;
}

export function getMonsterSprite(monsterId) {
  return MONSTER_SPRITES[monsterId] || null;
}
