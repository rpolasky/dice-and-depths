// ============================================================
// PLACEHOLDER-RENDERER.JS — the current (non-final) implementation
// of the renderer contract from renderer.js. Builds a first-person
// corridor illusion using CSS perspective + generated geometry,
// no external art assets required.
// ============================================================

import { ASSET_MANIFEST } from './renderer.js';

const ROOM_GLYPH = {
  monster: '⚔️', boss: '🐉', treasure: '💰', hidden_dice: '✨',
  trap: '⚠️', puzzle: '🧩', shrine: '🕯️', story: '📜', empty: '',
};

export class PlaceholderDungeonRenderer {
  mount(containerEl) {
    this.container = containerEl;
    this.container.innerHTML = `
      <div class="corridor" aria-hidden="true">
        <div class="corridor-ceiling"></div>
        <div class="corridor-floor"></div>
        <div class="corridor-wall corridor-wall--left"></div>
        <div class="corridor-wall corridor-wall--right"></div>
        <div class="corridor-far-door"></div>
        <div class="corridor-torch corridor-torch--left"></div>
        <div class="corridor-torch corridor-torch--right"></div>
        <div class="corridor-occupant"></div>
        <div class="corridor-vignette"></div>
      </div>
    `;
    this.el = {
      corridor: this.container.querySelector('.corridor'),
      farDoor: this.container.querySelector('.corridor-far-door'),
      occupant: this.container.querySelector('.corridor-occupant'),
    };
  }

  renderScene(scene) {
    if (!this.container) return;
    const palette = ASSET_MANIFEST[scene.theme] || ASSET_MANIFEST.stone;
    this.el.corridor.style.setProperty('--wall-color', palette.wall);
    this.el.corridor.style.setProperty('--floor-color', palette.floor);
    this.el.corridor.style.setProperty('--ceiling-color', palette.ceiling);
    this.el.corridor.style.setProperty('--accent-color', palette.accent);
    this.el.corridor.style.setProperty('--fog-color', palette.fog);

    this.el.corridor.dataset.kind = scene.roomKind;
    this.el.corridor.dataset.resolved = String(!!scene.resolved);
    this.el.corridor.classList.toggle('corridor--boss', scene.roomKind === 'boss');

    const glyph = ROOM_GLYPH[scene.roomKind] || '';
    this.el.occupant.textContent = scene.resolved ? '' : glyph;
    this.el.occupant.dataset.kind = scene.roomKind;

    this.el.farDoor.style.display = scene.exits?.forward === false ? 'none' : 'block';
  }
}
