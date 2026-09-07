// ============================================================
// COMBAT-UI.JS — renders the push-your-luck battle panel INLINE
// on the dungeon screen (see dungeon-ui.js). The monster's
// animated sprite lives in the corridor scene above this panel
// (mounted by the active dungeon renderer) — this file owns the
// HUD/controls below it, and anchors FX bursts to that shared
// sprite via #corridor-occupant.
// ============================================================

import { getIntentInfo, bagPeek } from '../combat/combat.js';
import { getThreshold, computeReleaseDamage, bustCeiling } from '../engine/overcharge.js';
import { getCharacterDef } from '../data/character-data.js';
import { getDieDef, getMaxFaceValue } from '../data/dice-data.js';
import { DIE_THEME_ART, FX_SPRITES, shapeForMaxFace } from '../data/sprite-data.js';
import { playSpriteOnce, vibrate } from './sprite-fx.js';

const THRESHOLD_RANK = { normal: 0, hot: 1, critical: 2, bust: -1 };
const THRESHOLD_CELEBRATION = {
  hot: { text: 'OVERCHARGED!', cls: 'threshold-banner--hot' },
  critical: { text: 'CRITICAL!!', cls: 'threshold-banner--critical' },
};

let lastPlayedSeq = -1;
let rollLock = false;
let lastThresholdRank = null;
let lastOvercharge = null;
let rollCycleInterval = null;

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
  const nextDieId = expedition.bag[0]?.dieId;
  const nextDieTheme = nextDieId ? getDieDef(nextDieId).theme : 'stone';
  const nextDieShape = nextDieId ? shapeForMaxFace(getMaxFaceValue(nextDieId)) : 'd6';
  const readyToRelease = threshold.id === 'hot' || threshold.id === 'critical';

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

    <div class="overcharge-panel" id="overcharge-panel">
      <div class="overcharge-label">OVERCHARGE</div>
      <div class="bar bar--overcharge" id="overcharge-bar">
        <div class="bar-fill" id="overcharge-fill" style="width:${ocPct}%"></div>
        <div class="bar-tick" style="left:${(15 / bustCeiling()) * 100}%"></div>
        <div class="bar-tick" style="left:${(25 / bustCeiling()) * 100}%"></div>
      </div>
      <div class="overcharge-numbers">
        <span class="overcharge-value">${fight.overcharge} <small>/ ${bustCeiling()}</small></span>
        <span class="threshold-tag threshold-tag--${threshold.id}">${threshold.label}</span>
      </div>
      <div class="potential-damage">Potential Release: <strong>${potentialDamage}</strong> dmg</div>
      ${revealed.length ? `<div class="reveal-next">🔮 <strong>Mage's Arcane Sight</strong> — next die: <strong>${revealed[0].name}</strong></div>` : ''}
    </div>

    <div class="dice-roller" id="dice-roller">
      <div class="die-shape-badge" id="die-shape-badge">${nextDieShape}</div>
      <div class="die-stage" id="die-stage">
        <div class="die-visual" id="die-visual" style="background-image:url(${DIE_THEME_ART[nextDieTheme] || DIE_THEME_ART.stone})"></div>
        <div class="die-cube" id="die-cube">
          <div class="die-cube-face die-cube-face--front"></div>
          <div class="die-cube-face die-cube-face--back"></div>
          <div class="die-cube-face die-cube-face--right"></div>
          <div class="die-cube-face die-cube-face--left"></div>
          <div class="die-cube-face die-cube-face--top"></div>
          <div class="die-cube-face die-cube-face--bottom"></div>
        </div>
      </div>
      <div class="die-result" id="die-result"></div>
    </div>

    <div class="combat-log" id="combat-log">
      ${fight.log.slice(-3).map((l) => `<div class="log-line">${l}</div>`).join('')}
    </div>

    <div class="combat-actions">
      <button class="btn btn--release ${readyToRelease ? 'btn--ready' : ''}" data-action="release">
        ⚡ RELEASE${readyToRelease ? ' NOW' : ''}
      </button>
      <button class="btn btn--push" data-action="push" ${expedition.bag.length === 0 ? 'disabled' : ''}>
        🎲 PUSH <span class="btn-sub">${expedition.bag.length} left</span>
      </button>
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

  // Overcharge bar "comes alive": pulse on every increase, big banner on
  // crossing into a new damage tier.
  const rank = THRESHOLD_RANK[threshold.id];
  if (lastOvercharge !== null && fight.overcharge > lastOvercharge) {
    const fillEl = document.getElementById('overcharge-fill');
    if (fillEl) { fillEl.classList.add('bar-fill--pulse'); setTimeout(() => fillEl.classList.remove('bar-fill--pulse'), 500); }
  }
  if (lastThresholdRank !== null && rank > lastThresholdRank && THRESHOLD_CELEBRATION[threshold.id]) {
    celebrateThreshold(THRESHOLD_CELEBRATION[threshold.id], state.permanent.settings);
  }
  lastOvercharge = fight.overcharge;
  lastThresholdRank = rank;

  if (fight.lastEvent && fight.lastEvent.seq !== lastPlayedSeq) {
    lastPlayedSeq = fight.lastEvent.seq;
    playEventFx(fight.lastEvent, state.permanent.settings);
    creditAbility(fight.lastEvent.abilityCredit);
  }
  renderDieResult(fight.lastEvent);
}

/** Reset per-fight tracking — call when leaving combat so the next fight starts clean. */
export function resetBattleFxState() {
  lastPlayedSeq = -1;
  rollLock = false;
  lastThresholdRank = null;
  lastOvercharge = null;
  if (rollCycleInterval) { clearInterval(rollCycleInterval); rollCycleInterval = null; }
}

function celebrateThreshold(info, settings) {
  const panel = document.getElementById('overcharge-panel');
  if (!panel) return;
  panel.classList.add('overcharge-panel--flash');
  setTimeout(() => panel.classList.remove('overcharge-panel--flash'), 700);

  const banner = document.createElement('div');
  banner.className = `threshold-banner ${info.cls}`;
  banner.textContent = info.text;
  panel.appendChild(banner);
  setTimeout(() => banner.remove(), 900);
  vibrate([20, 30, 60], settings);
}

function handlePushClick(expedition, actions, pushBtn, releaseBtn, settings) {
  if (rollLock || expedition.bag.length === 0) return;
  rollLock = true;
  pushBtn.disabled = true;
  releaseBtn.disabled = true;

  const dieStage = document.getElementById('die-stage');
  const dieResult = document.getElementById('die-result');
  const nextDieId = expedition.bag[0]?.dieId;
  const maxFace = nextDieId ? getMaxFaceValue(nextDieId) : 6;

  // Swap the flat static art for a real 3D cube (true rotateX/Y in 3D
  // space, not a flat image faking rotation) while it "tumbles."
  if (dieStage) dieStage.classList.add('die-stage--rolling');
  vibrate(15, settings);

  // Slot-machine number cycling while the die tumbles — purely cosmetic,
  // the real result is already determined and revealed the instant the
  // roll settles, so this never lies about the outcome, just delays it.
  if (dieResult) {
    dieResult.className = 'die-result die-result--cycling';
    rollCycleInterval = setInterval(() => {
      dieResult.textContent = String(1 + Math.floor(Math.random() * maxFace));
    }, 65);
  }

  setTimeout(() => {
    if (rollCycleInterval) { clearInterval(rollCycleInterval); rollCycleInterval = null; }
    rollLock = false;
    actions.combatPush();
  }, 550);
}

function renderDieResult(lastEvent) {
  const dieStage = document.getElementById('die-stage');
  const dieVisual = document.getElementById('die-visual');
  const dieResult = document.getElementById('die-result');
  if (!dieVisual || !dieResult || !lastEvent) return;
  if (!['roll', 'crit-roll', 'heal', 'bust'].includes(lastEvent.type)) return;

  if (dieStage) dieStage.classList.remove('die-stage--rolling');
  dieVisual.classList.add('die-visual--landed');
  setTimeout(() => dieVisual.classList.remove('die-visual--landed'), 300);

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

/** Briefly glows the party chip of whichever character's ability just fired, and drops a small toast naming them. */
function creditAbility(credit) {
  if (!credit) return;
  const chip = document.querySelector(`.party-chip[data-char="${credit.characterId}"]`);
  if (chip) {
    chip.classList.add('party-chip--ability-glow');
    setTimeout(() => chip.classList.remove('party-chip--ability-glow'), 1100);
  }

  const c = getCharacterDef(credit.characterId);
  const messages = {
    onFirstBustMitigate: `${c.name}'s Second Chance softened that bust!`,
    onHealingDieBoost: `${c.name}'s Blessed Hands boosted that heal!`,
    onConsecutivePushDamage: `${c.name}'s Blood Rage added +${credit.bonusPercent}% damage!`,
  };
  const text = messages[credit.hook];
  if (!text) return;

  const host = document.getElementById('dungeon-screen') || document.body;
  const toast = document.createElement('div');
  toast.className = 'ability-toast';
  toast.innerHTML = `<span class="ability-toast-icon">${c.icon}</span>${text}`;
  host.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
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
