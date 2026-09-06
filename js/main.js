// ============================================================
// MAIN.JS — application entry point.
// ============================================================

import { initGame } from './game.js';
import { initModal } from './ui/modal.js';
import { setActiveRenderer } from './dungeon/renderer.js';
import { PlaceholderDungeonRenderer } from './dungeon/placeholder-renderer.js';

// Swap PlaceholderDungeonRenderer for a real FirstPersonDungeonRenderer
// here when final art is ready — nothing else in the codebase changes.
setActiveRenderer(new PlaceholderDungeonRenderer());

initModal();
initGame();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
