// ============================================================
// UI.JS — top-level screen dispatcher. Owns the #app root and
// hands off to dungeon-ui.js for the exploration/combat screen.
// Every screen render function receives (root, state, actions).
// ============================================================

import { renderDungeon } from './dungeon-ui.js';
import { renderDebugPanel } from './debug-panel.js';
import { getCharacterDef } from '../data/character-data.js';
import { BALANCE } from '../data/balance.js';

let appRoot = null;

export function initUI() {
  appRoot = document.getElementById('app');
}

export function render(state, actions) {
  if (!appRoot) return;
  switch (state.screen) {
    case 'title': renderTitle(appRoot, state, actions); break;
    case 'tavern': renderTavern(appRoot, state, actions); break;
    case 'party-select': renderPartySelect(appRoot, state, actions); break;
    case 'dungeon': renderDungeon(appRoot, state, actions); break;
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
  const resuming = !!(state.expedition && state.dungeon);
  root.innerHTML = `
    <div class="screen screen--title">
      <div class="title-lockup">
        <div class="title-glyph">🎲</div>
        <h1>DICE &amp; DEPTHS</h1>
        <p class="title-tag">How far will you push?</p>
      </div>
      <div class="title-actions">
        <button class="btn btn--primary btn--large" data-action="enter">
          ${resuming ? 'RESUME EXPEDITION' : 'ENTER THE GUILD HALL'}
        </button>
      </div>
      <div class="title-meta">
        <span>Highest floor reached: ${state.permanent.highestFloorReached}</span>
        <span>Banked gold: ${state.permanent.bankedGold}</span>
      </div>
    </div>
  `;
  root.querySelector('[data-action="enter"]').addEventListener('click', actions.enterGame);
}

// ---------------------------------------------------------------
// TAVERN — the home base. Land here after boot, after extracting,
// and after dying. Choose a party, check stats/codex/dice, then
// head to the dungeon when ready.
// ---------------------------------------------------------------

function renderTavern(root, state, actions) {
  const { permanent } = state;
  const size = BALANCE.expedition.startingPartySize;
  const hasParty = permanent.activeParty.length === size;

  root.innerHTML = `
    <div class="screen screen--tavern screen--full-bleed">
      <div class="tavern-hero">
        <div class="tavern-hero-overlay">
          <h1>The Guild Hall</h1>
          <p class="title-tag">Rest here between expeditions.</p>
        </div>
      </div>

      <div class="tavern-party-preview">
        ${hasParty
          ? permanent.activeParty.map((id) => {
              const c = getCharacterDef(id);
              return `<button class="party-chip party-chip--large" data-char="${id}">${c.icon}<span class="party-chip-name">${c.name}</span></button>`;
            }).join('')
          : '<p class="subtle">No party chosen yet.</p>'}
      </div>

      <div class="tavern-menu">
        <button class="btn btn--secondary" data-action="party">🛡️ Choose Party</button>
        <button class="btn btn--secondary" data-action="codex">📖 Monster Codex</button>
        <button class="btn btn--secondary" data-action="dice">🎲 Dice Library</button>
        <button class="btn btn--secondary" data-action="stats">📊 Stats</button>
      </div>

      <button class="btn btn--primary btn--large btn--descend" data-action="depart" ${hasParty ? '' : 'disabled'}>
        ${hasParty ? '⚔️ HEAD TO THE DUNGEON' : 'CHOOSE A PARTY FIRST'}
      </button>
    </div>
  `;

  root.querySelector('[data-action="party"]').addEventListener('click', actions.goToPartySelect);
  root.querySelector('[data-action="codex"]').addEventListener('click', actions.showMonsterCodex);
  root.querySelector('[data-action="dice"]').addEventListener('click', actions.showDiceLibrary);
  root.querySelector('[data-action="stats"]').addEventListener('click', actions.showStats);
  root.querySelector('[data-action="depart"]').addEventListener('click', actions.startExpeditionFromTavern);
  root.querySelectorAll('.party-chip').forEach((btn) => {
    btn.addEventListener('click', () => actions.showCharacterInfo(btn.dataset.char));
  });
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
        CONFIRM PARTY (${selected.length}/${size})
      </button>
      <button class="btn btn--text" data-action="back">Back to the tavern</button>
    </div>
  `;
  root.querySelectorAll('.character-card').forEach((card) => {
    card.addEventListener('click', () => actions.toggleCharacterSelect(card.dataset.id));
  });
  root.querySelector('[data-action="confirm"]').addEventListener('click', actions.confirmParty);
  root.querySelector('[data-action="back"]').addEventListener('click', actions.backToTavernFromPartySelect);
}
