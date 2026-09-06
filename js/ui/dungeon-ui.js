// ============================================================
// DUNGEON-UI.JS — renders the first-person exploration screen.
// Visual rendering of the corridor itself is delegated to the
// active DungeonRenderer (see js/dungeon/renderer.js).
// ============================================================

import { currentRoom, isFloorComplete } from '../dungeon/dungeon.js';
import { describeRoom } from '../dungeon/encounters.js';
import { getActiveRenderer } from '../dungeon/renderer.js';
import { getCharacterDef } from '../data/character-data.js';

let sceneMounted = false;

export function renderDungeon(root, state, actions) {
  const { expedition, dungeon } = state;
  const room = currentRoom(dungeon);
  const flavor = describeRoom(room);
  const depthRemaining = dungeon.floor.rooms.length - 1 - dungeon.roomIndex;
  const hpPct = Math.max(0, Math.round((expedition.partyHp / expedition.partyMaxHp) * 100));

  root.innerHTML = `
    <div class="screen screen--dungeon">
      <div class="dungeon-hud-top">
        <div class="region-label">${dungeon.floor.regionName} · Floor ${dungeon.floor.floorNumber}</div>
        <button class="icon-btn" data-action="open-bag" aria-label="Dice bag">🎲 ${expedition.bag.length}</button>
      </div>

      <div id="dungeon-scene" class="dungeon-scene"></div>

      <div class="room-banner" data-kind="${room.kind}">
        <span class="room-banner-icon">${flavor.icon}</span>
        <span class="room-banner-text">${room.resolved ? 'Cleared.' : flavor.title}</span>
      </div>

      <div class="party-strip">
        ${expedition.partyIds.map((id) => {
          const c = getCharacterDef(id);
          return `<span class="party-chip" title="${c.name}">${c.icon}</span>`;
        }).join('')}
        <div class="party-hp-bar" aria-label="Party HP">
          <div class="party-hp-fill" style="width:${hpPct}%"></div>
          <span class="party-hp-label">${expedition.partyHp}/${expedition.partyMaxHp}</span>
        </div>
      </div>

      <div class="dpad">
        <button class="dpad-btn dpad-btn--turn" data-action="turn-left" aria-label="Turn left">↺</button>
        <button class="dpad-btn dpad-btn--forward" data-action="move-forward" ${depthRemaining <= 0 ? 'disabled' : ''}>FORWARD</button>
        <button class="dpad-btn dpad-btn--turn" data-action="turn-right" aria-label="Turn right">↻</button>
      </div>

      <button class="btn btn--interact ${room.resolved ? 'btn--muted' : ''}" data-action="interact">
        ${room.resolved ? 'MOVE ON' : interactLabel(room.kind)}
      </button>

      ${room.extractionPoint ? `<button class="btn btn--extract" data-action="open-extract">🚪 EXTRACTION POINT</button>` : ''}
      ${isFloorComplete(dungeon) ? `<button class="btn btn--descend" data-action="descend-floor">DESCEND ➜ FLOOR ${dungeon.floor.floorNumber + 1}</button>` : ''}
    </div>
  `;

  sceneMounted = false;
  mountScene(dungeon, room, depthRemaining);

  root.querySelector('[data-action="move-forward"]').addEventListener('click', actions.moveForward);
  root.querySelector('[data-action="turn-left"]').addEventListener('click', actions.turnLeft);
  root.querySelector('[data-action="turn-right"]').addEventListener('click', actions.turnRight);
  root.querySelector('[data-action="interact"]').addEventListener('click', actions.interact);
  root.querySelector('[data-action="open-bag"]').addEventListener('click', actions.openDiceBag);
  const extractBtn = root.querySelector('[data-action="open-extract"]');
  if (extractBtn) extractBtn.addEventListener('click', actions.openExtractPrompt);
  const descendBtn = root.querySelector('[data-action="descend-floor"]');
  if (descendBtn) descendBtn.addEventListener('click', actions.descendFloor);
}

function interactLabel(kind) {
  switch (kind) {
    case 'monster': case 'boss': return 'ENGAGE';
    case 'treasure': return 'OPEN';
    case 'hidden_dice': return 'SEARCH';
    case 'trap': return 'INVESTIGATE';
    case 'puzzle': return 'EXAMINE';
    case 'shrine': return 'APPROACH';
    case 'story': return 'READ';
    default: return 'LOOK AROUND';
  }
}

function mountScene(dungeon, room, depthRemaining) {
  const container = document.getElementById('dungeon-scene');
  const renderer = getActiveRenderer();
  if (!renderer || !container) return;
  renderer.mount(container);
  renderer.renderScene({
    theme: dungeon.floor.theme,
    roomKind: room.kind,
    room,
    monsterId: room.monsterId,
    direction: dungeon.position.direction,
    depthRemaining,
    resolved: room.resolved,
  });
  sceneMounted = true;
}
