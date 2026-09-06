// ============================================================
// DUNGEON-UI.JS — renders the first-person exploration screen.
// Visual rendering of the corridor itself is delegated to the
// active DungeonRenderer (see js/dungeon/renderer.js). When a
// fight is active, the lower control panel is replaced by the
// inline battle panel (combat-ui.js) — the corridor, HUD, and
// party strip stay exactly where they are; nothing navigates
// away to a different screen.
// ============================================================

import { currentRoom, isFloorComplete } from '../dungeon/dungeon.js';
import { relativeExits } from '../dungeon/movement.js';
import { describeRoom } from '../dungeon/encounters.js';
import { getActiveRenderer } from '../dungeon/renderer.js';
import { getCharacterDef } from '../data/character-data.js';
import { renderBattlePanel, resetBattleFxState } from './combat-ui.js';
import { closeModal } from './modal.js';

let wasInCombat = false;

export function renderDungeon(root, state, actions) {
  const { expedition, dungeon, mapOpen } = state;
  const room = currentRoom(dungeon);
  const exits = relativeExits(dungeon);
  const flavor = describeRoom(room);
  const inCombat = !!state.fight;

  if (inCombat) wasInCombat = true;
  else if (wasInCombat) { resetBattleFxState(); wasInCombat = false; }

  const hpPct = Math.max(0, Math.round((expedition.partyHp / expedition.partyMaxHp) * 100));

  root.innerHTML = `
    <div class="screen screen--dungeon screen--full-bleed" id="dungeon-screen">
      <div class="dungeon-viewport">
        <div id="dungeon-scene" class="dungeon-scene"></div>

        <div class="dungeon-hud-overlay">
          <div class="region-label">${dungeon.floor.regionName} · Floor ${dungeon.floor.floorNumber}</div>
          <div class="hud-top-actions">
            <button class="icon-btn" data-action="open-map" aria-label="Map">🗺️</button>
            <button class="icon-btn" data-action="open-bag" aria-label="Dice bag">🎲 ${expedition.bag.length}</button>
          </div>
        </div>

        ${!inCombat ? `
          <div class="room-banner" data-kind="${room.kind}">
            <span class="room-banner-icon">${flavor.icon}</span>
            <span class="room-banner-text">${room.resolved ? 'Cleared.' : flavor.title}</span>
          </div>
        ` : ''}
      </div>

      <div class="dungeon-sheet">
        <div class="party-strip">
          ${expedition.partyIds.map((id) => {
            const c = getCharacterDef(id);
            return `<button class="party-chip" data-char="${id}" title="Tap for details" style="background-image:url(${c.portrait})"></button>`;
          }).join('')}
          <div class="party-hp-bar" aria-label="Party HP">
            <div class="party-hp-fill" style="width:${hpPct}%"></div>
            <span class="party-hp-label">${expedition.partyHp}/${expedition.partyMaxHp}</span>
          </div>
        </div>

        <div id="panel-area" class="panel-area"></div>
      </div>
    </div>
  `;

  mountScene(dungeon, room, exits);

  const panelArea = root.querySelector('#panel-area');
  if (inCombat) {
    renderBattlePanel(panelArea, state, actions);
  } else {
    renderExplorationPanel(panelArea, dungeon, room, exits, actions);
  }

  root.querySelector('[data-action="open-bag"]').addEventListener('click', actions.openDiceBag);
  root.querySelector('[data-action="open-map"]').addEventListener('click', actions.toggleMap);
  root.querySelectorAll('.party-chip').forEach((btn) => {
    btn.addEventListener('click', () => actions.showCharacterInfo(btn.dataset.char));
  });

  if (mapOpen) {
    renderMapOverlay(dungeon, actions);
  } else if (document.getElementById('map-backdrop')) {
    closeModal();
  }
}

function renderExplorationPanel(panelArea, dungeon, room, exits, actions) {
  panelArea.innerHTML = `
    <div class="dpad dpad--cross">
      <button class="dpad-btn dpad-btn--corner" data-dir="left" ${exits.left ? '' : 'disabled'}>◀ LEFT</button>
      <button class="dpad-btn dpad-btn--forward" data-dir="forward" ${exits.forward ? '' : 'disabled'}>FORWARD ▲</button>
      <button class="dpad-btn dpad-btn--corner" data-dir="right" ${exits.right ? '' : 'disabled'}>RIGHT ▶</button>
      <div></div>
      <button class="dpad-btn dpad-btn--back" data-dir="back" ${exits.back ? '' : 'disabled'}>▼ BACK</button>
      <div></div>
    </div>

    <button class="btn btn--interact ${room.resolved ? 'btn--muted' : ''}" data-action="interact">
      ${room.resolved ? 'MOVE ON' : interactLabel(room.kind)}
    </button>

    ${room.extractionPoint ? `<button class="btn btn--extract" data-action="open-extract">🚪 EXTRACTION POINT</button>` : ''}
    ${isFloorComplete(dungeon) ? `<button class="btn btn--descend" data-action="descend-floor">DESCEND TO NEXT FLOOR</button>` : ''}
  `;

  panelArea.querySelectorAll('[data-dir]').forEach((btn) => {
    btn.addEventListener('click', () => actions.goDirection(btn.dataset.dir));
  });
  panelArea.querySelector('[data-action="interact"]').addEventListener('click', actions.interact);
  const extractBtn = panelArea.querySelector('[data-action="open-extract"]');
  if (extractBtn) extractBtn.addEventListener('click', actions.openExtractPrompt);
  const descendBtn = panelArea.querySelector('[data-action="descend-floor"]');
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

function mountScene(dungeon, room, exits) {
  const container = document.getElementById('dungeon-scene');
  const renderer = getActiveRenderer();
  if (!renderer || !container) return;
  renderer.mount(container);
  renderer.renderScene({
    theme: dungeon.floor.theme,
    roomKind: room.kind,
    room,
    monsterId: room.monsterId,
    exits,
    direction: dungeon.position.direction,
    resolved: room.resolved,
  });
}

// ---------------------------------------------------------------
// MAP OVERLAY — a simple fog-of-war schematic of visited rooms.
// ---------------------------------------------------------------

const KIND_MAP_ICON = {
  monster: '⚔️', boss: '🐉', treasure: '💰', hidden_dice: '✨',
  trap: '⚠️', puzzle: '🧩', shrine: '🕯️', story: '📜', empty: '',
};
const FACING_ARROW = { north: '▲', east: '▶', south: '▼', west: '◀' };
const CSS_SIDE = { north: 'top', south: 'bottom', east: 'right', west: 'left' };

function renderMapOverlay(dungeon, actions) {
  const rooms = Object.values(dungeon.floor.rooms).filter((r) => r.visited);
  const xs = rooms.map((r) => r.x).concat([dungeon.position.x]);
  const ys = rooms.map((r) => r.y).concat([dungeon.position.y]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cols = maxX - minX + 1;
  const rowsCount = maxY - minY + 1;
  const cell = 40;

  const cellsHtml = rooms.map((r) => {
    const left = (r.x - minX) * cell;
    const top = (r.y - minY) * cell;
    const isCurrent = r.x === dungeon.position.x && r.y === dungeon.position.y;
    const borders = ['north', 'east', 'south', 'west']
      .map((dir) => (r.connections[dir] ? `border-${CSS_SIDE[dir]}:none;` : ''))
      .join('');
    const icon = r.isExit ? (r.kind === 'boss' ? '🐉' : '⬇️') : (KIND_MAP_ICON[r.kind] || '');
    return `
      <div class="map-cell ${isCurrent ? 'map-cell--current' : ''} ${r.resolved ? 'map-cell--resolved' : ''}"
           style="left:${left}px; top:${top}px; width:${cell}px; height:${cell}px; ${borders}">
        ${isCurrent ? `<span class="map-facing">${FACING_ARROW[dungeon.position.direction]}</span>` : `<span class="map-icon">${icon}</span>`}
      </div>`;
  }).join('');

  const modalRoot = document.getElementById('modal-root');
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="map-backdrop">
      <div class="modal-card map-card">
        <div class="modal-header"><span class="modal-icon">🗺️</span><h2>${dungeon.floor.regionName}</h2></div>
        <div class="map-viewport">
          <div class="map-grid" style="width:${cols * cell}px; height:${rowsCount * cell}px;">${cellsHtml}</div>
        </div>
        <p class="subtle map-legend">Explored rooms only — the rest of the floor is still unknown.</p>
        <div class="modal-actions"><button class="btn btn--secondary" id="map-close">Close</button></div>
      </div>
    </div>
  `;
  document.getElementById('map-close').addEventListener('click', actions.toggleMap);
  document.getElementById('map-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'map-backdrop') actions.toggleMap();
  });
}
