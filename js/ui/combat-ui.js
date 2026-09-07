// ============================================================
// COMBAT-UI.JS — renders the battle as a full-viewport overlay on
// top of the dungeon scene (see dungeon-ui.js), not a boxed panel:
//   - monster name/HP/intent pinned along the top
//   - a vertical party-HP bar pinned to the left edge
//   - a vertical, flame-animated Overcharge bar pinned to the right,
//     filling upward, with the current threshold labeled beside it
//   - the party fanned out like a hand of cards along the bottom
//   - tapping a card "deals" a die into the center; tapping the die
//     rolls it (a real 3D cube) and reveals the result
//   - a circular RELEASE button and a small FLEE link under the fan
//
// The monster's animated sprite itself lives in the corridor scene
// (mounted by the active dungeon renderer) so it can be huge without
// this overlay needing to manage it — this file anchors FX bursts to
// it via #corridor-occupant.
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
let lastThresholdRank = null;
let lastOvercharge = null;
let rollCycleInterval = null;
// Local UI-only state machine for the tap-card -> tap-die flow. Not part
// of game state on purpose: it's pure presentation, reset whenever combat
// re-renders after a real action resolves.
let pushPhase = 'idle'; // 'idle' | 'die-ready' | 'rolling'
let activeCardIndex = null;

export function renderBattleOverlay(root, state, actions) {
  const { fight, expedition } = state;
  const monster = fight.monster;
  const intent = getIntentInfo(fight);
  const threshold = getThreshold(fight.overcharge);
  const potentialDamage = computeReleaseDamage(fight.overcharge);
  const hpPct = Math.max(0, Math.round((monster.currentHp / monster.hp) * 100));
  const ocPct = Math.min(100, Math.round((fight.overcharge / bustCeiling()) * 100));
  const partyHpPct = Math.max(0, Math.round((expedition.partyHp / expedition.partyMaxHp) * 100));
  const revealed = bagPeek(fight);
  const nextDieId = expedition.bag[0]?.dieId;
  const nextDieTheme = nextDieId ? getDieDef(nextDieId).theme : 'stone';
  const nextDieShape = nextDieId ? shapeForMaxFace(getMaxFaceValue(nextDieId)) : 'd6';
  const readyToRelease = threshold.id === 'hot' || threshold.id === 'critical';
  const bagEmpty = expedition.bag.length === 0;

  root.dataset.danger = threshold.id;
  const pendingChoice = fight.pendingChoice;
  root.innerHTML = `
    <div class="battle-top-bar">
      <div class="battle-monster-name-row">
        <span class="battle-monster-name">${monster.name}</span>
        <span class="battle-monster-hp-text">${monster.currentHp}/${monster.hp}</span>
      </div>
      <div class="bar bar--hp battle-monster-hp-bar"><div class="bar-fill" style="width:${hpPct}%"></div></div>
      <div class="intent-row ${intent.danger ? 'intent-row--danger' : ''}">
        <span class="intent-label">INTENT</span>
        <span class="intent-text">${intent.text}</span>
        <span class="intent-detail">${intent.detail}</span>
      </div>
      ${revealed.length ? `<div class="reveal-next">🔮 next ${revealed.length > 1 ? 'dice' : 'die'}: <strong>${revealed.map((d) => d.name).join(', ')}</strong></div>` : ''}
    </div>

    <div class="battle-vertical-bar battle-vertical-bar--hp" aria-label="Party HP">
      <div class="battle-vbar-track">
        <div class="battle-vbar-fill battle-vbar-fill--hp" style="height:${partyHpPct}%"></div>
      </div>
      <span class="battle-vbar-label">${expedition.partyHp}<small>/${expedition.partyMaxHp}</small></span>
    </div>

    <div class="battle-vertical-bar battle-vertical-bar--oc" id="oc-vbar" aria-label="Overcharge">
      <span class="battle-vbar-tag threshold-tag--${threshold.id}">${threshold.label}</span>
      <div class="battle-vbar-track battle-vbar-track--oc">
        <div class="battle-vbar-fill battle-vbar-fill--oc" id="oc-vbar-fill" style="height:${ocPct}%">
          <div class="battle-vbar-flame"></div>
        </div>
        <div class="battle-vbar-tick" style="bottom:${(15 / bustCeiling()) * 100}%"></div>
        <div class="battle-vbar-tick" style="bottom:${(25 / bustCeiling()) * 100}%"></div>
      </div>
      <span class="battle-vbar-label">${fight.overcharge}<small>/${bustCeiling()}</small></span>
      <span class="battle-vbar-sub">+${potentialDamage} dmg</span>
    </div>

    <div class="battle-center-zone" id="battle-center">
      ${pendingChoice ? `
        <div class="choice-prompt">Choose a die to roll</div>
        <div class="choice-die-row">
          ${pendingChoice.candidates.map((c) => {
            const def = getDieDef(c.dieId);
            return `<button class="choice-die" data-instance="${c.instanceId}" style="background-image:url(${DIE_THEME_ART[def.theme] || DIE_THEME_ART.stone})">
              <span class="choice-die-name">${def.name}</span>
            </button>`;
          }).join('')}
        </div>
      ` : `
        <div class="die-shape-badge" id="die-shape-badge" style="display:none">${nextDieShape}</div>
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
      `}
    </div>

    <div class="battle-bottom">
      <div class="card-fan" id="card-fan">
        ${expedition.partyIds.map((id, i) => {
          const c = getCharacterDef(id);
          return `<button class="party-card" data-idx="${i}" data-char="${id}" style="background-image:url(${c.portrait}); --fan-i:${i}; --fan-n:${expedition.partyIds.length}" ${bagEmpty || pushPhase !== 'idle' || pendingChoice ? 'disabled' : ''}></button>`;
        }).join('')}
      </div>
      <div class="battle-bottom-actions">
        <button class="release-fab ${readyToRelease ? 'release-fab--ready' : ''}" data-action="release" ${pendingChoice ? 'disabled' : ''} aria-label="Release">
          <span>RELEASE</span>
        </button>
      </div>
      <button class="btn btn--text btn--flee" data-action="flee" ${pendingChoice ? 'disabled' : ''}>🏃 Flee${bagEmpty ? ' — out of dice!' : ''}</button>
    </div>
  `;

  if (pendingChoice) {
    root.querySelectorAll('.choice-die').forEach((btn) => {
      btn.addEventListener('click', () => {
        vibrate(15, state.permanent.settings);
        actions.combatResolveChoice(btn.dataset.instance);
      });
    });
  }

  const releaseBtn = root.querySelector('[data-action="release"]');
  const fleeBtn = root.querySelector('[data-action="flee"]');
  releaseBtn.addEventListener('click', () => {
    vibrate(40, state.permanent.settings);
    actions.combatRelease();
  });
  fleeBtn.addEventListener('click', actions.combatFlee);

  root.querySelectorAll('.party-card').forEach((btn) => {
    btn.addEventListener('click', () => handleCardTap(Number(btn.dataset.idx), expedition, actions, state.permanent.settings));
  });

  if (pushPhase === 'idle') {
    const dieZone = document.getElementById('battle-center');
    if (dieZone) dieZone.classList.remove('battle-center-zone--active');
  }

  const rank = THRESHOLD_RANK[threshold.id];
  if (lastOvercharge !== null && fight.overcharge > lastOvercharge) {
    const fillEl = document.getElementById('oc-vbar-fill');
    if (fillEl) { fillEl.classList.add('battle-vbar-fill--pulse'); setTimeout(() => fillEl.classList.remove('battle-vbar-fill--pulse'), 500); }
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
  lastThresholdRank = null;
  lastOvercharge = null;
  pushPhase = 'idle';
  activeCardIndex = null;
  if (rollCycleInterval) { clearInterval(rollCycleInterval); rollCycleInterval = null; }
}

function celebrateThreshold(info, settings) {
  const bar = document.getElementById('oc-vbar');
  if (!bar) return;
  bar.classList.add('battle-vbar--flash');
  setTimeout(() => bar.classList.remove('battle-vbar--flash'), 700);

  const host = document.getElementById('battle-center');
  if (host) {
    const banner = document.createElement('div');
    banner.className = `threshold-banner ${info.cls}`;
    banner.textContent = info.text;
    host.appendChild(banner);
    setTimeout(() => banner.remove(), 900);
  }
  vibrate([20, 30, 60], settings);
}

// ---------------------------------------------------------------
// Tap-card -> tap-die push flow
// ---------------------------------------------------------------

function handleCardTap(idx, expedition, actions, settings) {
  if (pushPhase !== 'idle' || expedition.bag.length === 0) return;
  pushPhase = 'die-ready';
  activeCardIndex = idx;

  const fan = document.getElementById('card-fan');
  const card = fan?.querySelector(`[data-idx="${idx}"]`);
  if (card) card.classList.add('party-card--active');
  if (fan) fan.querySelectorAll('.party-card').forEach((el) => { el.disabled = true; });

  const centerZone = document.getElementById('battle-center');
  const dieStage = document.getElementById('die-stage');
  const shapeBadge = document.getElementById('die-shape-badge');
  if (centerZone) centerZone.classList.add('battle-center-zone--active');
  if (dieStage) dieStage.classList.add('die-stage--pulsing');
  if (shapeBadge) shapeBadge.style.display = '';

  vibrate(10, settings);

  const dieVisual = document.getElementById('die-visual');
  if (dieVisual) {
    dieVisual.onclick = () => handleDieTap(expedition, actions, settings);
  }
}

function handleDieTap(expedition, actions, settings) {
  if (pushPhase !== 'die-ready') return;
  pushPhase = 'rolling';

  const dieStage = document.getElementById('die-stage');
  const dieVisual = document.getElementById('die-visual');
  const dieResult = document.getElementById('die-result');
  const nextDieId = expedition.bag[0]?.dieId;
  const maxFace = nextDieId ? getMaxFaceValue(nextDieId) : 6;

  if (dieStage) { dieStage.classList.remove('die-stage--pulsing'); dieStage.classList.add('die-stage--rolling'); }
  if (dieVisual) dieVisual.onclick = null;
  vibrate(15, settings);

  if (dieResult) {
    dieResult.className = 'die-result die-result--cycling';
    rollCycleInterval = setInterval(() => {
      dieResult.textContent = String(1 + Math.floor(Math.random() * maxFace));
    }, 65);
  }

  setTimeout(() => {
    if (rollCycleInterval) { clearInterval(rollCycleInterval); rollCycleInterval = null; }
    pushPhase = 'idle';
    activeCardIndex = null;
    actions.combatPush();
  }, 550);
}

function renderDieResult(lastEvent) {
  const dieStage = document.getElementById('die-stage');
  const dieResult = document.getElementById('die-result');
  if (!dieStage || !dieResult || !lastEvent) return;
  if (!['roll', 'crit-roll', 'heal', 'bust'].includes(lastEvent.type)) return;

  dieStage.classList.remove('die-stage--rolling');
  dieStage.classList.add('die-visual--landed');
  setTimeout(() => dieStage.classList.remove('die-visual--landed'), 320);

  const face = lastEvent.face;
  let label = '';
  let cls = 'die-result--normal';
  if (lastEvent.type === 'bust') { label = '💥'; cls = 'die-result--danger'; }
  else if (face?.type === 'crit') { label = `${face.value}!`; cls = 'die-result--crit'; }
  else if (face?.type === 'heal') { label = `+${lastEvent.healAmount}`; cls = 'die-result--heal'; }
  else if (face?.type === 'element') { label = `${face.value}`; cls = 'die-result--element'; }
  else if (face) { label = `${face.value}`; }

  dieResult.textContent = label;
  dieResult.className = `die-result die-result--reveal ${cls}`;

  setTimeout(() => {
    const centerZone = document.getElementById('battle-center');
    if (centerZone) centerZone.classList.remove('battle-center-zone--active');
  }, 900);
}

/** Briefly glows the party card of whichever character's ability just fired, and drops a small toast naming them. */
function creditAbility(credit) {
  if (!credit) return;
  const card = document.querySelector(`.party-card[data-char="${credit.characterId}"]`);
  if (card) {
    card.classList.add('party-card--ability-glow');
    setTimeout(() => card.classList.remove('party-card--ability-glow'), 1100);
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
  const centerZone = document.getElementById('battle-center');
  const dungeonScreen = document.querySelector('.screen--dungeon');

  switch (event.type) {
    case 'release':
    case 'victory':
      if (occupant) playSpriteOnce(occupant, FX_SPRITES.releaseHit, { scale: 3.2 });
      vibrate(60, settings);
      break;
    case 'bust':
      if (dungeonScreen) {
        dungeonScreen.classList.add('screen--shake');
        setTimeout(() => dungeonScreen.classList.remove('screen--shake'), 420);
      }
      if (centerZone) playSpriteOnce(centerZone, FX_SPRITES.bustShock, { scale: 2.4, className: 'fx-burst--danger' });
      vibrate([40, 40, 60], settings);
      break;
    case 'crit-roll':
      if (centerZone) playSpriteOnce(centerZone, FX_SPRITES.critBurst, { scale: 3.6 });
      vibrate(30, settings);
      break;
    case 'heal':
      if (centerZone) playSpriteOnce(centerZone, FX_SPRITES.healSparkle, { scale: 3.6 });
      break;
    default:
      break;
  }
}
