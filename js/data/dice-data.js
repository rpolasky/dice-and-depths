// ============================================================
// DICE-DATA.JS — data-driven definitions for every die type.
// Faces can be: { value } for plain overcharge points,
// or { value, type, ...extra } for special effects.
// Face "type" values understood by the dice engine:
//   'value'   -> add `value` to overcharge (default when type omitted)
//   'crit'    -> add `value`, and flag this roll as a critical hit
//   'heal'    -> heal the party for `value`, no overcharge gained
//   'element' -> add `value` overcharge, tag attack with `element`
//   'danger'  -> instantly triggers a BUST
//   'bonus'   -> add `value` overcharge, and refund a die back to the bag
// ============================================================

export const DICE_DATA = {
  basic_die: {
    id: 'basic_die',
    name: 'Basic Die',
    rarity: 'common',
    theme: 'stone',
    cursed: false,
    description: 'A dependable six-sided die. No surprises.',
    faces: [
      { value: 1 }, { value: 2 }, { value: 3 },
      { value: 4 }, { value: 5 }, { value: 6 },
    ],
  },

  power_die: {
    id: 'power_die',
    name: 'Power Die',
    rarity: 'uncommon',
    theme: 'ember',
    cursed: false,
    description: 'Weighted toward bigger numbers. Higher ceiling, higher risk of overshooting.',
    faces: [
      { value: 2 }, { value: 3 }, { value: 4 },
      { value: 6 }, { value: 8 }, { value: 10 },
    ],
  },

  critical_die: {
    id: 'critical_die',
    name: 'Critical Die',
    rarity: 'rare',
    theme: 'gold',
    cursed: false,
    description: 'One face hits devastatingly hard.',
    faces: [
      { value: 2 }, { value: 3 }, { value: 4 },
      { value: 5 }, { value: 6 }, { value: 14, type: 'crit' },
    ],
  },

  healing_die: {
    id: 'healing_die',
    name: 'Healing Die',
    rarity: 'uncommon',
    theme: 'verdant',
    cursed: false,
    description: 'Some faces mend the party instead of building Overcharge.',
    faces: [
      { value: 3 }, { value: 4 }, { value: 5 },
      { value: 8, type: 'heal' }, { value: 12, type: 'heal' }, { value: 2 },
    ],
  },

  elemental_die: {
    id: 'elemental_die',
    name: 'Elemental Die',
    rarity: 'rare',
    theme: 'arcane',
    cursed: false,
    description: 'Infused with volatile magic. Adds elemental force to your attack.',
    faces: [
      { value: 3 }, { value: 4, type: 'element', element: 'fire' },
      { value: 4, type: 'element', element: 'ice' }, { value: 5 },
      { value: 5, type: 'element', element: 'lightning' }, { value: 6, type: 'element', element: 'poison' },
    ],
  },

  cursed_die: {
    id: 'cursed_die',
    name: 'Cursed Die',
    rarity: 'cursed',
    theme: 'void',
    cursed: true,
    description: 'Something is wrong with this die. One face spells disaster.',
    faces: [
      { value: 1 }, { value: 2 }, { value: 3 },
      { value: 4 }, { value: 5 }, { value: 0, type: 'danger' },
    ],
  },

  lucky_die: {
    id: 'lucky_die',
    name: 'Lucky Die',
    rarity: 'rare',
    theme: 'gold',
    cursed: false,
    description: 'A rare find. One face rolls itself back into your bag.',
    faces: [
      { value: 2 }, { value: 3 }, { value: 4 },
      { value: 5 }, { value: 6, type: 'bonus' }, { value: 3 },
    ],
  },
};

export function getDieDef(dieId) {
  const def = DICE_DATA[dieId];
  if (!def) throw new Error(`Unknown die id: ${dieId}`);
  return def;
}

export function listDiceByRarity(rarity) {
  return Object.values(DICE_DATA).filter((d) => d.rarity === rarity);
}
