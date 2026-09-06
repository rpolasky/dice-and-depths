// ============================================================
// UI.JS — top-level screen dispatcher. Owns the #app root and
// hands off to dungeon-ui.js / combat-ui.js for those screens.
// Every screen render function receives (root, state, actions).
// ============================================================

import { renderDungeon } from './dungeon-ui.js';
import { renderCombat } from './combat-ui.js';
import { renderDebugPanel } from './debug-panel.js';
import { getCharacterDef, allCharacterIds } from '../data/character-data.js';
import { BALANCE } from '../data/balance.js';
import { hasSave } from '../engine/save.js';

let appRoot = null;

export function initUI() {
  appRoot = document.getElementById('app');
}

export function render(state, actions) {
  if (!appRoot) return;
  switch (state.screen) {
    case 'title': renderTitle(appRoot, state, actions); break;
    case 'party-select': renderPartySelect(appRoot, state, actions); break;
    case 'dungeon': renderDungeon(appRoot, state, actions); break;
    case 'combat': renderCombat(appRoot, state, actions); break;
    case 'extraction-summary': renderExtractionSummary(appRoot, state, actions); break;
    case 'game-over': renderGameOver(appRoot, state, actions); break;
    default: appRoot.innerHTML = `<div class="screen">Unknown screen: ${state.screen}</div>`;
  }
  renderDebugPanel(document, state, actions);
  renderDevTab(state, actions);
}

function renderDevTab(state, actions) {
  let tab = document.getElementById('dev-tab');
  if (!tab) {
    tab = document.createElement('button');
    tab.id = 'dev-tab';
    tab.textContent = 'DEV';
    tab.addEventListener('click', actions.toggleDebugPanel);
    document.body.appendChild(tab);
  }
}

function renderTitle(root, state, actions) {
  root.innerHTML = `
    <div class="screen screen--title">
      <div class="title-lockup">
        <div class="title-glyph">🎲</div>
        <h1>DICE &amp; DEPTHS</h1>
        <p class="title-tag">How far will you push?</p>
      </div>
      <div class="title-actions">
        <button class="btn btn--primary btn--large" data-action="new-expedition">NEW EXPEDITION</button>
        ${hasSave() ? '<button class="btn btn--secondary btn--large" data-action="continue">CONTINUE</button>' : ''}
      </div>
      <div class="title-meta">
        <span>Highest floor reached: ${state.permanent.highestFloorReached}</span>
        <span>Banked gold: ${state.permanent.bankedGold}</span>
      </div>
    </div>
  `;
  root.querySelector('[data-action="new-expedition"]').addEventListener('click', actions.goToPartySelect);
  const cont = root.querySelector('[data-action="continue"]');
  if (cont) cont.addEventListener('click', actions.continueExpedition);
}

function renderPartySelect(root, state, actions) {
  const size = BALANCE.expedition.startingPartySize;
  const selected = state.pendingParty || [];
  root.innerHTML = `
    <div class="screen screen--party-select">
      <h2>Choose your party</h2>
      <p class="subtle">Pick ${size} characters. They'll stay with you for the whole expedition.</p>
      <div class="character-grid">
        ${state.permanent.unlockedCharacters.map((id) => {
          const c = getCharacterDef(id);
          const isSelected = selected.includes(id);
          return `
            <button class="character-card ${isSelected ? 'character-card--selected' : ''}" data-id="${id}">
              <div class="character-icon">${c.icon}</div>
              <div class="character-name">${c.name}</div>
              <div class="character-tagline">${c.tagline}</div>
              <div class="character-desc">${c.description}</div>
            </button>`;
        }).join('')}
      </div>
      <button class="btn btn--primary btn--large" data-action="confirm" ${selected.length === size ? '' : 'disabled'}>
        ENTER THE DUNGEON (${selected.length}/${size})
      </button>
      <button class="btn btn--text" data-action="back">Back</button>
    </div>
  `;
  root.querySelectorAll('.character-card').forEach((card) => {
    card.addEventListener('click', () => actions.toggleCharacterSelect(card.dataset.id));
  });
  root.querySelector('[data-action="confirm"]').addEventListener('click', actions.confirmParty);
  root.querySelector('[data-action="back"]').addEventListener('click', actions.backToTitle);
}

function renderExtractionSummary(root, state, actions) {
  const { lastExtraction } = state;
  root.innerHTML = `
    <div class="screen screen--summary">
      <h2>Extraction successful</h2>
      <p class="subtle">You returned safely from Floor ${lastExtraction.floorNumber}.</p>
      <ul class="summary-list">
        <li>Gold banked: <strong>${lastExtraction.gold}</strong></li>
        <li>Relics found: <strong>${lastExtraction.relics}</strong></li>
        <li>Highest floor: <strong>${lastExtraction.floorNumber}</strong></li>
      </ul>
      <button class="btn btn--primary btn--large" data-action="continue">RETURN TO CAMP</button>
    </div>
  `;
  root.querySelector('[data-action="continue"]').addEventListener('click', actions.backToTitle);
}

function renderGameOver(root, state, actions) {
  const { lastRunReason, lastExtraction } = state;
  root.innerHTML = `
    <div class="screen screen--summary screen--gameover">
      <h2>The expedition has fallen</h2>
      <p class="subtle">${lastRunReason || 'Your party could not continue.'}</p>
      <ul class="summary-list">
        <li>Reached floor: <strong>${lastExtraction?.floorNumber ?? '-'}</strong></li>
      </ul>
      <p class="subtle">Permanent progress is kept. Unbanked treasure is lost.</p>
      <button class="btn btn--primary btn--large" data-action="continue">RETURN TO CAMP</button>
    </div>
  `;
  root.querySelector('[data-action="continue"]').addEventListener('click', actions.backToTitle);
}
