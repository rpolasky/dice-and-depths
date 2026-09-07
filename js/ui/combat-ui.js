// ============================================================
// COMBAT-UI.JS — renders the battle as a full-viewport overlay on
// top of the dungeon scene (see dungeon-ui.js), not a boxed panel.
//
// Layout (top to bottom):
//   - monster name/HP/intent pinned along the top
//   - a SHORT row of two compact columns: party HP + a small FLEE
//     button on the left, Overcharge + the circular RELEASE button
//     on the right — both are intentionally short (not full-height
//     bars) so they don't dominate the screen
//   - open space in the middle where the corridor scene's huge
//     monster sprite shows through, undisturbed
//   - the dice roll, sitting just above the party's hand of cards
//   - the party fanned out like cards near the very bottom; tapping
//     one enlarges it and shows its ability description underneath
//
// RELEASE and monster counter-attacks both get a real hit: a
// floating damage number, a burst anchored on the monster/party,
// and a screen flash + shake — not just a bar quietly changing width.
// ============================================================

import { getIntentInfo, bagPeek } from '../combat/combat.js';
import { getThreshold, computeReleaseDamage, bustCeiling } from '../engine/overcharge.js';
import { getCharacterDef } from '../data/character-data.js';
import { getDieDef, getMaxFaceValue } from '../data/dice-data.js';
import {
  DIE_SHAPE_ART, DIE_THEME_FILTER, FX_SPRITES, FLAME_ART,
  shapeForMaxFace, getNumeralArt, getStatusIcon,
} from '../data/sprite-data.js';
import { playSpriteOnce, vibrate } from './sprite-fx.js';

const THRESHOLD_RANK = { normal: 0, hot: 1, critical: 2, bust: -1 };
const THRESHOLD_CELEBRATION = {
  hot: { text: 'OVERCHARGED!', cls: 'threshold-banner--hot' },
  critical: { text: 'CRITICAL!!', cls: 'threshold-banner--critical' },
};

let lastPlayedSeq = -1;
let lastPartyDamageSeq = -1;
let lastThresholdRank = null;
let lastOvercharge = null;
let rollCycleInterval = null;
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
  const nextDieFilter = DIE_THEME_FILTER[nextDieTheme] || 'none';
  const readyToRelease = threshold.id === 'hot' || threshold.id === 'critical';
  const bagEmpty = expedition.bag.length === 0;
  const pendingChoice = fight.pendingChoice;

  root.dataset.danger = threshold.id;
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

    <div class="battle-side-row">
      <div class="battle-side-col battle-side-col--hp" id="hp-vbar">
        <div class="battle-vbar-track">
          <div class="battle-vbar-fill battle-vbar-fill--hp" style="height:${partyHpPct}%"></div>
        </div>
        <span class="battle-vbar-label">${expedition.partyHp}<small>/${expedition.partyMaxHp}</small></span>
        <button class="mini-action-btn mini-action-btn--flee" data-action="flee" ${pendingChoice ? 'disabled' : ''}>🏃 Flee</button>
      </div>

      <div class="battle-side-col battle-side-col--oc" id="oc-vbar">
        <span class="battle-vbar-tag threshold-tag--${threshold.id}">${threshold.label}</span>
        <div class="battle-vbar-track battle-vbar-track--oc">
          <div class="battle-vbar-fill battle-vbar-fill--oc" id="oc-vbar-fill" style="height:${ocPct}%">
            <div class="battle-vbar-flame" id="oc-flame" style="background-image:url(${FLAME_ART})"></div>
          </div>
          <div class="battle-vbar-tick" style="bottom:${(15 / bustCeiling()) * 100}%"></div>
          <div class="battle-vbar-tick" style="bottom:${(25 / bustCeiling()) * 100}%"></div>
        </div>
        <span class="battle-vbar-label">${fight.overcharge}<small>/${bustCeiling()}</small></span>
        <span class="battle-vbar-sub">+${potentialDamage} dmg</span>
        <button class="release-fab ${readyToRelease ? 'release-fab--ready' : ''}" data-action="release" ${pendingChoice ? 'disabled' : ''} aria-label="Release">
          <span>RELEASE</span>
        </button>
      </div>
    </div>

    <div class="battle-spacer" id="battle-spacer"></div>

    <div class="battle-center-zone" id="battle-center">
      ${pendingChoice ? `
        <div class="choice-prompt">Choose a die to roll</div>
        <div class="choice-die-row">
          ${pendingChoice.candidates.map((c) => {
            const def = getDieDef(c.dieId);
            const shape = shapeForMaxFace(getMaxFaceValue(c.dieId));
            const filter = DIE_THEME_FILTER[def.theme] || 'none';
            return `<button class="choice-die" data-instance="${c.instanceId}" style="background-image:url(${DIE_SHAPE_ART[shape]}); filter:${filter}">
              <span class="choice-die-name">${def.name}</span>
            </button>`;
          }).join('')}
        </div>
      ` : `
        <div class="die-shape-badge" id="die-shape-badge" style="display:none">${nextDieShape}</div>
        <div class="die-stage" id="die-stage">
          <div class="die-visual" id="die-visual" style="background-image:url(${DIE_SHAPE_ART[nextDieShape]}); filter:${nextDieFilter}"></div>
          <div class="die-cube" id="die-cube" style="filter:${nextDieFilter}">
            <div class="die-cube-face die-cube-face--front"></div>
            <div class="die-cube-face die-cube-face--back"></div>
            <div class="die-cube-face die-cube-face--right"></div>
            <div class="die-cube-face die-cube-face--left"></div>
            <div class="die-cube-face die-cube-face--top"></div>
            <div class="die-cube-face die-cube-face--bottom"></div>
          </div>
          <div class="die-result-overlay" id="die-result"></div>
        </div>
      `}
    </div>

    <div class="battle-bottom">
      <div class="card-fan" id="card-fan">
        ${expedition.partyIds.map((id, i) => {
          const c = getCharacterDef(id);
          return `<button class="party-card" data-idx="${i}" data-char="${id}" style="background-image:url(${c.portrait}); --fan-i:${i}; --fan-n:${expedition.partyIds.length}" ${bagEmpty || pushPhase !== 'idle' || pendingChoice ? 'disabled' : ''}></button>`;
        }).join('')}
      </div>
      <div class="card-description" id="card-description"></div>
    </div>
  `;

  const releaseBtn = root.querySelector('[data-action="release"]');
  const fleeBtn = root.querySelector('[data-action="flee"]');
  releaseBtn.addEventListener('click', () => {
    vibrate(40, state.permanent.settings);
    actions.combatRelease();
  });
  fleeBtn.addEventListener('click', actions.combatFlee);

  if (pendingChoice) {
    root.querySelectorAll('.choice-die').forEach((btn) => {
      btn.addEventListener('click', () => {
        vibrate(15, state.permanent.settings);
        actions.combatResolveChoice(btn.dataset.instance);
      });
    });
  }

  root.querySelectorAll('.party-card').forEach((btn) => {
    btn.addEventListener('click', () => handleCardTap(Number(btn.dataset.idx), expedition, actions, state.permanent.settings));
  });

  if (pushPhase === 'idle') {
    document.getElementById('battle-center')?.classList.remove('battle-center-zone--active');
  }

  // Overcharge bar "comes alive": pulse on every increase (the flame
  // itself flickers constantly regardless, via CSS), big banner on
  // crossing into a new damage tier.
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
  if (fight.partyDamageEvent && fight.partyDamageEvent.seq !== lastPartyDamageSeq) {
    lastPartyDamageSeq = fight.partyDamageEvent.seq;
    playPartyDamageFx(fight.partyDamageEvent, state.permanent.settings);
  }
  renderDieResult(fight.lastEvent);
}

/** Reset per-fight tracking — call when leaving combat so the next fight starts clean. */
export function resetBattleFxState() {
  lastPlayedSeq = -1;
  lastPartyDamageSeq = -1;
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

  const charId = card?.dataset.char;
  const descEl = document.getElementById('card-description');
  if (descEl && charId) {
    const c = getCharacterDef(charId);
    descEl.innerHTML = `<strong>${c.icon} ${c.name}</strong> — ${c.description}`;
    descEl.classList.add('card-description--visible');
  }

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
    dieResult.className = 'die-result-overlay die-result-overlay--cycling';
    dieResult.innerHTML = '';
    rollCycleInterval = setInterval(() => {
      dieResult.textContent = String(1 + Math.floor(Math.random() * maxFace));
    }, 65);
  }

  setTimeout(() => {
    if (rollCycleInterval) { clearInterval(rollCycleInterval); rollCycleInterval = null; }
    pushPhase = 'idle';
    activeCardIndex = null;
    const descEl = document.getElementById('card-description');
    if (descEl) descEl.classList.remove('card-description--visible');
    actions.combatPush();
  }, 550);
}

/** Picks the best visual for a rolled face: a real carved numeral image
 *  when we have one for that value, an icon badge for special face
 *  types, or styled text as the fallback. */
function renderFaceVisual(container, lastEvent) {
  container.innerHTML = '';
  container.className = 'die-result-overlay die-result-overlay--reveal';

  const face = lastEvent.face;
  let iconKey = null;
  let value = face?.value;
  let extraCls = '';

  if (lastEvent.type === 'bust') { iconKey = 'danger'; extraCls = 'die-result--danger'; value = null; }
  else if (face?.type === 'crit') { iconKey = 'crit'; extraCls = 'die-result--crit'; }
  else if (face?.type === 'heal') { iconKey = 'heal'; extraCls = 'die-result--heal'; value = lastEvent.healAmount; }
  else if (face?.type === 'element') { iconKey = face.element === 'fire' ? 'fire' : face.element === 'poison' ? 'poison' : face.element === 'lightning' ? 'lightning' : null; extraCls = 'die-result--element'; }

  container.classList.add(extraCls || 'die-result--normal');

  const icon = iconKey ? getStatusIcon(iconKey) : null;
  if (icon) {
    const iconEl = document.createElement('div');
    iconEl.className = 'die-result-icon';
    iconEl.style.backgroundImage = `url(${icon})`;
    container.appendChild(iconEl);
  }

  if (value != null) {
    const numeralArt = getNumeralArt(value);
    if (numeralArt) {
      const numEl = document.createElement('div');
      numEl.className = 'die-result-numeral' + (icon ? ' die-result-numeral--badge' : '');
      numEl.style.backgroundImage = `url(${numeralArt})`;
      container.appendChild(numEl);
    } else {
      const textEl = document.createElement('div');
      textEl.className = 'die-result-text' + (icon ? ' die-result-text--badge' : '');
      textEl.textContent = (lastEvent.type === 'heal' ? '+' : '') + value + (face?.type === 'crit' ? '!' : '');
      container.appendChild(textEl);
    }
  }
}

function renderDieResult(lastEvent) {
  const dieStage = document.getElementById('die-stage');
  const dieResult = document.getElementById('die-result');
  if (!dieStage || !dieResult || !lastEvent) return;
  if (!['roll', 'crit-roll', 'heal', 'bust'].includes(lastEvent.type)) return;

  dieStage.classList.remove('die-stage--rolling');
  dieStage.classList.add('die-visual--landed');
  setTimeout(() => dieStage.classList.remove('die-visual--landed'), 320);

  renderFaceVisual(dieResult, lastEvent);

  setTimeout(() => {
    document.getElementById('battle-center')?.classList.remove('battle-center-zone--active');
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

/** Spawns a floating "-N" number that rises and fades, anchored to `hostEl`. */
function spawnFloatingNumber(hostEl, text, cls) {
  if (!hostEl) return;
  const el = document.createElement('div');
  el.className = `floating-number ${cls}`;
  el.textContent = text;
  hostEl.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

function playEventFx(event, settings) {
  const occupant = document.getElementById('corridor-occupant');
  const centerZone = document.getElementById('battle-center');
  const dungeonScreen = document.querySelector('.screen--dungeon');

  switch (event.type) {
    case 'release':
    case 'victory':
      // A release should feel like an actual hit landing: a big burst
      // right on the monster, a floating damage number, a full-screen
      // flash, and a shake — not just the HP bar quietly shrinking.
      if (occupant) {
        playSpriteOnce(occupant, FX_SPRITES.releaseHit, { scale: 4.5 });
        spawnFloatingNumber(occupant, `-${event.damage}`, 'floating-number--damage');
      }
      if (dungeonScreen) {
        dungeonScreen.classList.add('screen--hit-flash');
        setTimeout(() => dungeonScreen.classList.remove('screen--hit-flash'), 260);
        dungeonScreen.classList.add('screen--shake');
        setTimeout(() => dungeonScreen.classList.remove('screen--shake'), 420);
      }
      vibrate(70, settings);
      break;
    case 'bust':
      if (dungeonScreen) {
        dungeonScreen.classList.add('screen--shake');
        setTimeout(() => dungeonScreen.classList.remove('screen--shake'), 420);
      }
      if (centerZone) playSpriteOnce(centerZone, FX_SPRITES.bustShock, { scale: 2.6, className: 'fx-burst--danger' });
      vibrate([40, 40, 60], settings);
      break;
    case 'crit-roll':
      if (centerZone) playSpriteOnce(centerZone, FX_SPRITES.critBurst, { scale: 3.8 });
      vibrate(30, settings);
      break;
    case 'heal':
      if (centerZone) playSpriteOnce(centerZone, FX_SPRITES.healSparkle, { scale: 3.8 });
      break;
    default:
      break;
  }
}

/** The monster's counter-attack landing on the party — needs its own visible "ouch" moment. */
function playPartyDamageFx(event, settings) {
  const hpCol = document.getElementById('hp-vbar');
  const dungeonScreen = document.querySelector('.screen--dungeon');

  if (hpCol) {
    spawnFloatingNumber(hpCol, `-${event.damage}`, 'floating-number--incoming');
    playSpriteOnce(hpCol, FX_SPRITES.bustShock, { scale: 1.6, className: 'fx-burst--danger' });
  }
  if (dungeonScreen) {
    dungeonScreen.classList.add('screen--damage-flash');
    setTimeout(() => dungeonScreen.classList.remove('screen--damage-flash'), 280);
    dungeonScreen.classList.add('screen--shake');
    setTimeout(() => dungeonScreen.classList.remove('screen--shake'), 420);
  }
  vibrate([50, 30, 50], settings);
}
