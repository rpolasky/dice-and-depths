// ============================================================
// COMBAT-UI.JS — renders the push-your-luck battle panel INLINE
// on the dungeon screen (see dungeon-ui.js) rather than as a
// separate screen. The monster's animated sprite lives in the
// corridor scene above this panel (mounted by the active dungeon
// renderer) — this file only owns the HUD/controls below it, and
// anchors FX bursts to that shared sprite via #corridor-occupant.
// ============================================================

import { getIntentInfo, bagPeek } from '../combat/combat.js';
import { getThreshold, computeReleaseDamage, bustCeiling } from '../engine/overcharge.js';
import { getCharacterDef } from '../data/character-data.js';
import { getDieDef } from '../data/dice-data.js';
import { DIE_THEME_ART, FX_SPRITES } from '../data/sprite-data.js';
import { playSpriteOnce, vibrate } from './sprite-fx.js';

let lastPlayedSeq = -1;
let rollLock = false;

/** Renders the battle HUD/controls into `root`. Call after the corridor scene is mounted. */
export function renderBattlePanel(root, state, actions) {
  const { fight, expedition } = state;
  const monster = fight.monster;
  const intent = getIntentInfo(fight);
  const threshold = getThreshold(fight.overcharge);
  const potentialDamage = computeReleaseDamage(fight.overcharge);
  const hpPct = Math.max(0, Math.round((monster.currentHp / monster.hp) * 100));
  const ocPct = Math.min(100, Math.round((fight.overcharge / bustCeiling()) * 100));
  const revealed = bagPeek(fight, 1);
  const nextDieTheme = expedition.bag[0] ? getDieDef(expedition.bag[0].dieId).theme : 'stone';

  root.dataset.danger = threshold.id;
  root.innerHTML = `
    <div class="monster-panel">
      <div class="monster-name-row">
        <span class="monster-name">${monster.name}</span>
        <span class="monster-hp-text">${monster.currentHp}/${monster.hp}</span>
      </div>
      <div class="bar bar--hp"><div class="bar-fill" style="width:${hpPct}%"></div></div>
      <div class="intent-row ${intent.danger ? 'intent-row--danger' : ''}">
        <span class="intent-label">INTENT</span>
        <span class="intent-text">${intent.text}</span>
        <span class="intent-detail">${intent.detail}</span>
      </div>
    </div>

    <div class="overcharge-panel">
      <div class="overcharge-label">OVERCHARGE</div>
      <div class="bar bar--overcharge">
        <div class="bar-fill" style="width:${ocPct}%"></div>
      </div>
      <div class="overcharge-numbers">
        <span>${fight.overcharge} / ${bustCeiling()}</span>
        <span class="threshold-tag threshold-tag--${threshold.id}">${threshold.label}</span>
      </div>
      <div class="potential-damage">Potential Release: <strong>${potentialDamage}</strong> dmg</div>
      ${revealed.length ? `<div class="reveal-next">🔮 Next die: <strong>${revealed[0].name}</strong></div>` : ''}
    </div>

    <div class="dice-roller" id="dice-roller">
      <div class="die-visual" id="die-visual" style="background-image:url(${DIE_THEME_ART[nextDieTheme] || DIE_THEME_ART.stone})"></div>
      <div class="die-result" id="die-result"></div>
    </div>

    <div class="combat-log" id="combat-log">
      ${fight.log.slice(-3).map((l) => `<div class="log-line">${l}</div>`).join('')}
    </div>

    <div class="combat-actions">
      <button class="btn btn--release" data-action="release">RELEASE</button>
      <button class="btn btn--push" data-action="push" ${expedition.bag.length === 0 ? 'disabled' : ''}>PUSH 🎲 ${expedition.bag.length}</button>
    </div>
    <button class="btn btn--text btn--flee" data-action="flee">🏃 Flee the fight${expedition.bag.length === 0 ? ' — out of dice!' : ''}</button>
  `;

  const pushBtn = root.querySelector('[data-action="push"]');
  const releaseBtn = root.querySelector('[data-action="release"]');
  const fleeBtn = root.querySelector('[data-action="flee"]');
  pushBtn.addEventListener('click', () => handlePushClick(expedition, actions, pushBtn, releaseBtn, state.permanent.settings));
  releaseBtn.addEventListener('click', () => {
    vibrate(40, state.permanent.settings);
    actions.combatRelease();
  });
  fleeBtn.addEventListener('click', actions.combatFlee);

  if (fight.lastEvent && fight.lastEvent.seq !== lastPlayedSeq) {
    lastPlayedSeq = fight.lastEvent.seq;
    playEventFx(fight.lastEvent, state.permanent.settings);
  }
  renderDieResult(fight.lastEvent);
}

/** Reset the "last played" FX marker — call when leaving combat so the next fight's first event always plays. */
export function resetBattleFxState() {
  lastPlayedSeq = -1;
  rollLock = false;
}

function handlePushClick(expedition, actions, pushBtn, releaseBtn, settings) {
  if (rollLock || expedition.bag.length === 0) return;
  rollLock = true;
  pushBtn.disabled = true;
  releaseBtn.disabled = true;

  const dieVisual = document.getElementById('die-visual');
  const dieResult = document.getElementById('die-result');
  if (dieResult) dieResult.textContent = '';
  if (dieVisual) dieVisual.classList.add('die-visual--rolling');
  vibrate(15, settings);

  setTimeout(() => {
    rollLock = false;
    actions.combatPush();
  }, 420);
}

function renderDieResult(lastEvent) {
  const dieVisual = document.getElementById('die-visual');
  const dieResult = document.getElementById('die-result');
  if (!dieVisual || !dieResult || !lastEvent) return;
  if (!['roll', 'crit-roll', 'heal', 'bust'].includes(lastEvent.type)) return;

  dieVisual.classList.remove('die-visual--rolling');
  dieVisual.classList.add('die-visual--landed');

  const face = lastEvent.face;
  let label = '';
  let cls = 'die-result--normal';
  if (lastEvent.type === 'bust') { label = '💥'; cls = 'die-result--danger'; }
  else if (face?.type === 'crit') { label = `${face.value}!`; cls = 'die-result--crit'; }
  else if (face?.type === 'heal') { label = `+${lastEvent.healAmount}`; cls = 'die-result--heal'; }
  else if (face?.type === 'element') { label = `${face.value}`; cls = 'die-result--element'; }
  else if (face) { label = `${face.value}`; }

  dieResult.textContent = label;
  dieResult.className = `die-result ${cls}`;
}

function playEventFx(event, settings) {
  const occupant = document.getElementById('corridor-occupant');
  const roller = document.getElementById('dice-roller');
  const dungeonScreen = document.querySelector('.screen--dungeon');

  switch (event.type) {
    case 'release':
    case 'victory':
      if (occupant) playSpriteOnce(occupant, FX_SPRITES.releaseHit, { scale: 2.2 });
      vibrate(60, settings);
      break;
    case 'bust':
      if (dungeonScreen) {
        dungeonScreen.classList.add('screen--shake');
        setTimeout(() => dungeonScreen.classList.remove('screen--shake'), 420);
      }
      if (roller) playSpriteOnce(roller, FX_SPRITES.bustShock, { scale: 2.0, className: 'fx-burst--danger' });
      vibrate([40, 40, 60], settings);
      break;
    case 'crit-roll':
      if (roller) playSpriteOnce(roller, FX_SPRITES.critBurst, { scale: 3.2 });
      vibrate(30, settings);
      break;
    case 'heal':
      if (roller) playSpriteOnce(roller, FX_SPRITES.healSparkle, { scale: 3.2 });
      break;
    default:
      break;
  }
}
