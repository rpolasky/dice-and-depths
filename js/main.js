// ============================================================
// MAIN.JS — application entry point.
// ============================================================

import { initGame } from './game.js';
import { initModal } from './ui/modal.js';
import { setActiveRenderer } from './dungeon/renderer.js';
import { ImageDungeonRenderer } from './dungeon/image-dungeon-renderer.js';

// The renderer contract (renderer.js) lets us swap dungeon visuals
// without touching game logic. ImageDungeonRenderer uses the real,
// license-free AI-generated tile pack in assets/dungeon/. The earlier
// CSS-only PlaceholderDungeonRenderer is still in the codebase
// (placeholder-renderer.js) as a reference for how to implement a
// from-scratch renderer, or as a zero-asset fallback.
setActiveRenderer(new ImageDungeonRenderer());

initModal();
initGame();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
