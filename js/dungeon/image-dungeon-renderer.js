// ============================================================
// IMAGE-DUNGEON-RENDERER.JS — the "final art" implementation of
// the renderer contract from renderer.js, built on the licensed
// AI-generated dungeon tile pack (assets/dungeon/). This is the
// exact swap-in the architecture in renderer.js was designed for:
// PlaceholderDungeonRenderer -> ImageDungeonRenderer, with zero
// changes needed anywhere else in the codebase.
//
// Dropping in higher-resolution versions of these tiles later is
// a one-file change: js/dungeon/tile-data.js.
// ============================================================

import { ASSET_MANIFEST } from './renderer.js';
import { getTileForRoom } from './tile-data.js';
import { getMonsterSprite } from '../data/sprite-data.js';
import { playSpriteLoop } from '../ui/sprite-fx.js';

export class ImageDungeonRenderer {
  mount(containerEl) {
    this.container = containerEl;
    this.container.innerHTML = `
      <div class="corridor corridor--photo" aria-hidden="true">
        <div class="corridor-photo" id="corridor-photo"></div>
        <div class="corridor-tint"></div>
        <div class="corridor-torch corridor-torch--left"></div>
        <div class="corridor-torch corridor-torch--right"></div>
        <div class="corridor-occupant" id="corridor-occupant"></div>
        <div class="corridor-vignette"></div>
      </div>
    `;
    this.el = {
      corridor: this.container.querySelector('.corridor'),
      photo: this.container.querySelector('#corridor-photo'),
      occupant: this.container.querySelector('#corridor-occupant'),
    };
    this.stopSpriteLoop = null;
  }

  renderScene(scene) {
    if (!this.container) return;
    if (this.stopSpriteLoop) { this.stopSpriteLoop(); this.stopSpriteLoop = null; }

    const palette = ASSET_MANIFEST[scene.theme] || ASSET_MANIFEST.stone;
    this.el.corridor.style.setProperty('--accent-color', palette.accent);
    this.el.corridor.style.setProperty('--fog-color', palette.fog);
    this.el.corridor.dataset.kind = scene.roomKind;
    this.el.corridor.dataset.resolved = String(!!scene.resolved);
    this.el.corridor.classList.toggle('corridor--boss', scene.roomKind === 'boss');

    const tile = getTileForRoom(scene.room, scene.theme, scene.exits);
    this.el.photo.style.backgroundImage = `url(${tile.path})`;
    this.el.photo.style.transform = tile.flip ? 'scaleX(-1)' : '';

    this.el.occupant.innerHTML = '';
    const showsMonster = scene.roomKind === 'monster' || scene.roomKind === 'boss';
    if (showsMonster && !scene.resolved && scene.monsterId) {
      const sprite = getMonsterSprite(scene.monsterId);
      if (sprite) {
        const spriteEl = document.createElement('div');
        const scale = scene.roomKind === 'boss' ? 2.6 : 3.2;
        spriteEl.style.width = `${sprite.frameW * scale}px`;
        spriteEl.style.height = `${sprite.frameH * scale}px`;
        spriteEl.className = 'corridor-monster-sprite';
        this.el.occupant.appendChild(spriteEl);
        this.stopSpriteLoop = playSpriteLoop(spriteEl, sprite, 5);
      }
    }
  }
}
