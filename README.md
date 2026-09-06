# Dice & Depths (working title)

A portrait-first, mobile PWA dungeon crawler built around four pillars:
expendable dice, push-your-luck Overcharge combat, character cards, and
first-person grid dungeon exploration.

> "How far will you push?"

This is a **complete, playable vertical slice**, not a mockup. Every system
described below actually works end to end: party select → explore → fight →
push/release/bust → find dice → extract or descend → bank rewards → save →
start again.

---

## 1. Running it locally

Browsers block ES module `import` statements from `file://` URLs, so you need
a tiny local web server — you can't just double-click `index.html`.

**Easiest option (Python, already on most machines):**
```
cd "D:\Dice Overload"
python -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

**If you have Node.js installed:**
```
cd "D:\Dice Overload"
npx serve .
```

**VS Code:** install the "Live Server" extension, right-click `index.html`,
choose "Open with Live Server."

Any of these work — the game is plain HTML/CSS/JS with no build step.

---

## 2. Deploying to GitHub Pages (so you can install it as a PWA on your phone)

1. Create a new GitHub repository (e.g. `dice-and-depths`).
2. Copy everything in this folder into that repo (keep the folder structure
   exactly as-is — `index.html` must be at the repo root, or at the root of
   whichever folder you point Pages at).
3. Push it:
   ```
   cd "D:\Dice Overload"
   git init
   git add .
   git commit -m "Initial vertical slice"
   git branch -M main
   git remote add origin https://github.com/<you>/dice-and-depths.git
   git push -u origin main
   ```
4. On GitHub: **Settings → Pages → Source → Deploy from a branch → `main` /
   `/ (root)` → Save.**
5. GitHub will give you a URL like `https://<you>.github.io/dice-and-depths/`.
   It can take a minute or two to go live the first time.

### Installing it as a PWA on your phone
- **Android (Chrome):** open the GitHub Pages URL → menu (⋮) → "Add to Home
  screen" / "Install app."
- **iPhone (Safari):** open the URL → Share button → "Add to Home Screen."

Once installed, the service worker caches the app shell, so it keeps working
without a signal after the first successful load.

> Note: the placeholder icons are SVGs. Chrome/Android handle this fine.
> iOS home-screen icons look best as PNG — if the icon looks off on iPhone,
> swap `assets/placeholder/icon-192.svg` / `icon-512.svg` for PNGs of the
> same names (or update the paths in `manifest.json` and the `<link>` tags
> in `index.html`).

### Updating the game after you've deployed it
Bump `CACHE_NAME` in `service-worker.js` (e.g. `v1` → `v2`) any time you push
changes, or returning players' installed copies will keep serving the old
cached files. Then `git add . && git commit && git push` as usual.

---

## 3. Project structure

```
index.html              Entry HTML shell
manifest.json           PWA manifest (icons, name, display mode)
service-worker.js       Offline caching (app-shell precache)

css/
  main.css              Design tokens (colors/type), layout, buttons, modal, title/party-select
  dungeon.css            First-person corridor + exploration screen
  combat.css              Overcharge meter + combat screen
  cards.css               Shared card framing / dice rarity accents
  responsive.css          Breakpoints (phones first, desktop fallback)

js/
  main.js                 Entry point — wires up the renderer + boots the game
  game.js                  Orchestrator: owns every player action, talks to all systems below

  data/                    ALL tunable content lives here — nothing is hard-coded elsewhere
    balance.js             Overcharge thresholds, bust rules, starting dice capacity, etc.
    dice-data.js            The 7 die types
    character-data.js       The 6 character cards + their abilities
    monster-data.js         The 10 monsters (incl. 1 boss) + their Intent patterns
    floor-data.js            The 5 regions + procedural floor/room generation
    content-data.js          Puzzles, treasure tables, random events

  engine/
    state.js                Single source of truth (a tiny store + pub/sub)
    save.js                  Versioned localStorage save/load
    dice-engine.js            Dice bag: draw, add, remove, roll
    overcharge.js             Threshold math, release-damage calculation

  combat/
    combat.js                The push/release/bust state machine + character ability hooks
    monster-intent.js         Monster telegraph + resolution (monsters never roll dice)

  dungeon/
    dungeon.js                Current floor + room-position state
    movement.js                Forward / turn-left / turn-right
    encounters.js              What happens in treasure/trap/puzzle/shrine/story rooms
    renderer.js                 THE SWAPPABLE CONTRACT for dungeon visuals (see below)
    placeholder-renderer.js     Current CSS-only implementation of that contract

  progression/
    progression.js            Permanent vs. expedition progression, banking on extract

  ui/
    ui.js                     Screen dispatcher (title/party-select/summary/game-over)
    dungeon-ui.js               Renders the exploration screen
    combat-ui.js                Renders the combat screen
    modal.js                    Generic reusable modal
    debug-panel.js               Dev-only balance tools
```

---

## 4. How the core systems work

**Dice bag:** a shuffled queue, not a pure random draw each time — this is
what lets the Mage's "reveal next die" ability work, since there's a real
"next" die. Adding a die splices it into a random position in the remaining
queue. Dice are consumed on draw and never auto-refill.

**Overcharge:** one shared meter for the whole party per fight (not per
character, not persistent). PUSH draws and rolls a die, adding its value.
RELEASE cashes it in as damage (scaled by the current threshold — Steady /
Overcharged / Critical). Cross 100, or roll a "danger" face, and you BUST —
losing most of the accumulated Overcharge (configurable in `balance.js`,
and modified by character abilities like the Rogue's).

**Monsters never roll dice.** Each has an `intentPattern` array it cycles
through, telegraphing exactly what it'll do next (attack for X, guard,
curse your dice, web your next push, steal a die, or — for the dragon —
charge up for a big hit). This is why combat can escalate without feeling
unfair: you always know what's coming.

**Two-layer push-your-luck:** the micro decision (push vs. release, every
turn) and the macro decision (extract vs. descend, at extraction points and
floor transitions) reinforce each other — winning a fight can still leave
you dice-poor and force the macro decision sooner.

---

## 5. Adding new content

Everything below is pure data — you never need to touch combat/dungeon/UI
code to add content.

### Add a character
Edit `js/data/character-data.js`, add an entry keyed by a new id:
```js
druid: {
  id: 'druid', name: 'Druid', className: 'Druid', icon: '🌿',
  portrait: 'placeholder/druid.svg',
  tagline: 'Wild Growth',
  description: 'Your description here.',
  stats: { fortitude: 6, insight: 6 },
  ability: { hook: 'onHealingDieBoost', boostPercent: 25 }, // reuse an existing hook...
},
```
Then add `'druid'` to `permanent.unlockedCharacters` in
`js/engine/state.js` (or grant it later via a real unlock system).

If you want a *new* kind of ability (a new hook), you'll need to:
1. Add the hook's logic in `js/combat/combat.js` (search for
   `fight.abilities.onXxx` for the pattern other abilities follow).
2. Reference that hook name in the character's `ability.hook`.

### Add a die
Edit `js/data/dice-data.js`:
```js
frost_die: {
  id: 'frost_die', name: 'Frost Die', rarity: 'rare', theme: 'arcane',
  cursed: false, description: 'Chilling.',
  faces: [{ value: 3 }, { value: 4 }, { value: 5 },
          { value: 6, type: 'element', element: 'ice' }, { value: 7 }, { value: 2 }],
},
```
Add its id to `permanent.unlockedDiceTypes` in `js/engine/state.js`, and to
wherever you want it to drop (a monster's `rewards.diceOptions`, a puzzle's
`reward.dieType`, `content-data.js`'s treasure tables, etc.).

### Add a monster
Edit `js/data/monster-data.js`:
```js
troll: {
  id: 'troll', name: 'Troll', icon: '🧟', hp: 60,
  intentPattern: [{ kind: 'attack', value: 14 }, { kind: 'guard', value: 20 }],
  rewards: { diceChance: 0.6, diceOptions: ['power_die'], gold: [20, 40] },
},
```
Then add `'troll'` to a region's `monsterPool` in `js/data/floor-data.js` so
it actually shows up.

### Add a puzzle or event
Add an entry to the `PUZZLES` or `EVENTS` array in `js/data/content-data.js`
— follow the shape of the existing entries (`type: 'choice'` for a
deterministic pick, `type: 'sequence'` for a chance-flavored one).

### Replace the placeholder dungeon art
This was designed for exactly this. See `js/dungeon/renderer.js` — it
defines the renderer contract (`mount(container)` / `renderScene(scene)`)
and an `ASSET_MANIFEST` of placeholder colors per region theme.

To swap in real art:
1. Write a new class (e.g. `FirstPersonDungeonRenderer`) implementing the
   same two methods, in a new file next to `placeholder-renderer.js`.
2. Point `ASSET_MANIFEST` (or your renderer's own manifest) at real
   texture/model URLs instead of placeholder hex colors.
3. In `js/main.js`, change:
   ```js
   setActiveRenderer(new PlaceholderDungeonRenderer());
   ```
   to:
   ```js
   setActiveRenderer(new FirstPersonDungeonRenderer());
   ```
Nothing in `dungeon.js`, `movement.js`, `encounters.js`, `combat.js`, or
`game.js` needs to change — they only know about rooms and coordinates,
never about how a room is drawn.

---

## 6. The dev/debug panel

Tap the small "DEV" tab in the bottom-left corner during play. It gives you:
add specific dice, force Overcharge to a value, damage/heal the party,
instantly kill the current monster, skip to the next floor, reset the
expedition, or wipe the save entirely. It's intentionally unstyled and
low-profile — meant for balancing, not for players. Remove the `#dev-tab`
button and its listener in `js/ui/ui.js` before a public release if you
don't want it visible at all.

---

## 7. What's deliberately not built yet

Per the original design brief, these are architected for but not
implemented in this vertical slice: character rarity/leveling, dice
fusion/crafting, equipment/relics with mechanical effects, a branching (as
opposed to linear) room graph per floor, real 3D dungeon art, sound/music,
and daily challenges/leaderboards. The data-driven structure throughout
means all of these can be layered in without refactoring the systems that
already exist.
