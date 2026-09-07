// ============================================================
// SERVICE-WORKER.JS — precaches the app shell so the game keeps
// working offline after the first successful load.
//
// Bump CACHE_NAME whenever you ship new files so old caches are
// cleared out automatically.
// ============================================================

const CACHE_NAME = 'dice-and-depths-v9';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',

  './css/main.css',
  './css/dungeon.css',
  './css/combat.css',
  './css/cards.css',
  './css/responsive.css',

  './js/main.js',
  './js/game.js',

  './js/data/balance.js',
  './js/data/character-data.js',
  './js/data/content-data.js',
  './js/data/dice-data.js',
  './js/data/floor-data.js',
  './js/data/monster-data.js',
  './js/data/sprite-data.js',

  './js/engine/dice-engine.js',
  './js/engine/overcharge.js',
  './js/engine/save.js',
  './js/engine/state.js',

  './js/combat/combat.js',
  './js/combat/monster-intent.js',

  './js/dungeon/dungeon.js',
  './js/dungeon/encounters.js',
  './js/dungeon/movement.js',
  './js/dungeon/placeholder-renderer.js',
  './js/dungeon/image-dungeon-renderer.js',
  './js/dungeon/tile-data.js',
  './js/dungeon/renderer.js',

  './js/progression/progression.js',

  './js/ui/combat-ui.js',
  './js/ui/debug-panel.js',
  './js/ui/dungeon-ui.js',
  './js/ui/modal.js',
  './js/ui/ui.js',
  './js/ui/sprite-fx.js',

  './assets/placeholder/icon.svg',
  './assets/placeholder/icon-192.svg',
  './assets/placeholder/icon-512.svg',
  './assets/characters/paladin.png',
  './assets/characters/rogue.svg',
  './assets/characters/mage.png',
  './assets/characters/berserker.svg',
  './assets/characters/cleric.svg',
  './assets/characters/scout.svg',

  './assets/dice/shapes/d4.png',
  './assets/dice/shapes/d6.png',
  './assets/dice/shapes/d8.png',
  './assets/dice/shapes/d10.png',
  './assets/dice/shapes/d12.png',
  './assets/dice/shapes/d20.png',
  './assets/dice/numerals/1.png',
  './assets/dice/numerals/2.png',
  './assets/dice/numerals/3.png',
  './assets/dice/numerals/4.png',
  './assets/dice/numerals/5.png',
  './assets/dice/numerals/6.png',
  './assets/dice/numerals/7.png',
  './assets/dice/numerals/8.png',
  './assets/dice/numerals/9.png',
  './assets/dice/numerals/10.png',
  './assets/dice/numerals/11.png',
  './assets/dice/numerals/12.png',
  './assets/dice/numerals/13.png',
  './assets/dice/numerals/14.png',
  './assets/dice/numerals/16.png',
  './assets/dice/numerals/17.png',
  './assets/dice/numerals/19.png',
  './assets/dice/numerals/20.png',

  './assets/monsters/goblin.png',
  './assets/monsters/goblin_brute.png',
  './assets/monsters/skeleton.png',
  './assets/monsters/skeleton_knight.png',
  './assets/monsters/batilisk.png',
  './assets/monsters/bogslium.png',
  './assets/monsters/lizard_monk.png',
  './assets/monsters/orc_archer.png',
  './assets/monsters/ghost.png',
  './assets/monsters/minotaur.png',
  './assets/monsters/dragon.png',

  './assets/fx/release-hit.png',
  './assets/fx/bust-shock.png',
  './assets/fx/crit-burst.png',
  './assets/fx/fire-burst.png',
  './assets/fx/heal-sparkle.png',
  './assets/fx/sparkle.png',
  './assets/fx/flame-hand.png',
  './assets/fx/icons/poison.png',
  './assets/fx/icons/rage.png',
  './assets/fx/icons/healing.png',
  './assets/fx/icons/lightning.png',
  './assets/fx/icons/double_arrow.png',
  './assets/fx/icons/double_sword.png',
  './assets/fx/icons/skull.png',
  './assets/fx/icons/double_axe.png',

  './assets/env/gold-pile.png',
  './assets/env/stairs.png',

  './assets/dungeon/13_chest_open.png',
  './assets/dungeon/21_shrine.png',
  './assets/dungeon/24_fog_mist.png',
  './assets/dungeon/25_web_corridor.png',
  './assets/dungeon/26_ice_corridor.png',
  './assets/dungeon/27_lava_corridor.png',
  './assets/dungeon/36_puzzle_statues.png',

  './assets/dungeon/hires/straight.jpg',
  './assets/dungeon/hires/turn-left.jpg',
  './assets/dungeon/hires/t-junction.jpg',
  './assets/dungeon/hires/cross-intersection.jpg',
  './assets/dungeon/hires/dead-end.jpg',
  './assets/dungeon/hires/trap.jpg',
  './assets/dungeon/hires/hidden-dice.jpg',
  './assets/dungeon/hires/treasure-closed.jpg',
  './assets/dungeon/hires/story-rune.jpg',
  './assets/dungeon/hires/boss-door.jpg',
  './assets/dungeon/hires/stairs-down.jpg',
  './assets/dungeon/hires/monster-corridor.jpg',

  './assets/scenes/guild-hall.jpg',
  './assets/scenes/brighthollow-castle.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for app-shell assets, falling back to network, then
// re-caching whatever we fetch so new content is picked up over time.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
