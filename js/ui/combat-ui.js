// ============================================================
// COMBAT-UI.JS — renders the push-your-luck combat screen with
// real pixel-art monster sprites, an animated dice roll, and
// one-shot FX bursts (hit flash / bust shock / crit sparkle).
// ============================================================

import { getIntentInfo, bagPeek } from '../combat/combat.js';
import { getThreshold, computeReleaseDamage, bustCeiling } from '../engine/overcharge.js';
import { getCharacterDef } from '../data/character-data.js';
import { getDieDef } from '../data/dice-data.js';
import { getMonsterSprite, DIE_THEME_ART, FX_SPRITES } from '../data/sprite-data.js';
import { playSpriteLoop, playSpriteOnce, vibrate } from './sprite-fx.js';

let stopMonsterLoop = null;
let lastPlayedSeq = -1;
let rollLock = false;

export function renderCombat(root, state, actions) {
  const { fight, expedition } = state;
  const monster = fight.monster;
  const intent = getIntentInfo(fight);
  const threshold = getThreshold(fight.overcharge);
  const potentialDamage = computeReleaseDamage(fight.overcharge);
  const hpPct = Math.max(0, Math.round((monster.currentHp / monster.hp) * 100));
  const ocPct = Math.min(100, Math.round((fight.overcharge / bustCeiling()) * 100));
  const partyHpPct = Math.max(0, Math.round((expedition.partyHp / expedition.partyMaxHp) * 100));
  const revealed = bagPeek(fight, 1);
  const nextDieTheme = expedition.bag[0] ? getDieDef(expedition.bag[0].dieId).theme : 'stone';

  if (stopMonsterLoop) { stopMonsterLoop(); stopMonsterLoop = null; }

  root.innerHTML = `
    <div class="screen screen--combat" data-danger="${threshold.id}" id="combat-screen">
      <div class="monster-panel">
        <div class="monster-stage" id="monster-stage">
          <div class="monster-sprite-wrap"><div class="monster-sprite" id="monster-sprite"></div></div>
        </div>
        <div class="monster-name">${monster.name}</div>
        <div class="bar bar--hp"><div class="bar-fill" style="width:${hpPct}%"></div>
          <span class="bar-label">${monster.currentHp}/${monster.hp}</span></div>
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
          <div class="bar-tick" style="left:50%"></div>
          <div class="bar-tick" style="left:75%"></div>
        </div>
        <div class="overcharge-numbers">
          <span>${fight.overcharge} / 100</span>
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
        ${fight.log.slice(-4).map((l) => `<div class="log-line">${l}</div>`).join('')}
      </div>

      <div class="combat-actions">
        <button class="btn btn--release" data-action="release">RELEASE</button>
        <button class="btn btn--push" data-action="push" ${expedition.bag.length === 0 ? 'disabled' : ''}>PUSH 🎲 ${expedition.bag.length}</button>
      </div>

      <div class="party-strip party-strip--combat">
        ${expedition.partyIds.map((id) => {
          const c = getCharacterDef(id);
          return `<span class="party-chip" title="${c.description}">${c.icon}</span>`;
        }).join('')}
        <div class="party-hp-bar" id="party-hp-bar" aria-label="Party HP">
          <div class="party-hp-fill" style="width:${partyHpPct}%"></div>
          <span class="party-hp-label">${expedition.partyHp}/${expedition.partyMaxHp}</span>
        </div>
      </div>
    </div>
  `;

  const monsterSpriteEl = root.querySelector('#monster-sprite');
  const sprite = getMonsterSprite(monster.id);
  if (sprite && monsterSpriteEl) {
    const scale = monster.boss ? 3.4 : 4.2;
    monsterSpriteEl.style.width = `${sprite.frameW * scale}px`;
    monsterSpriteEl.style.height = `${sprite.frameH * scale}px`;
    stopMonsterLoop = playSpriteLoop(monsterSpriteEl, sprite, 6);
  }

  const pushBtn = root.querySelector('[data-action="push"]');
  const releaseBtn = root.querySelector('[data-action="release"]');

  pushBtn.addEventListener('click', () => handlePushClick(expedition, actions, pushBtn, releaseBtn, state.permanent.settings));
  releaseBtn.addEventListener('click', () => {
    vibrate(40, state.permanent.settings);
    actions.combatRelease();
  });

  // Fire any FX tied to the most recent combat event exactly once.
  if (fight.lastEvent && fight.lastEvent.seq !== lastPlayedSeq) {
    lastPlayedSeq = fight.lastEvent.seq;
    playEventFx(fight.lastEvent, state.permanent.settings);
  }

  renderDieResult(fight.lastEvent);
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
  else if (face?.type === 'element') { label = `${face.value}`; cls = `die-result--element`; }
  else if (face) { label = `${face.value}`; }

  dieResult.textContent = label;
  dieResult.className = `die-result ${cls}`;
}

function playEventFx(event, settings) {
  const stage = document.getElementById('monster-stage');
  const roller = document.getElementById('dice-roller');
  const partyBar = document.getElementById('party-hp-bar');
  const screen = document.getElementById('combat-screen');

  switch (event.type) {
    case 'release':
    case 'victory':
      if (stage) playSpriteOnce(stage, FX_SPRITES.releaseHit, { scale: 2.6 });
      vibrate(60, settings);
      break;
    case 'bust':
      if (screen) {
        screen.classList.add('screen--shake');
        setTimeout(() => screen.classList.remove('screen--shake'), 420);
      }
      if (roller) playSpriteOnce(roller, FX_SPRITES.bustShock, { scale: 2.2, className: 'fx-burst--danger' });
      vibrate([40, 40, 60], settings);
      break;
    case 'crit-roll':
      if (roller) playSpriteOnce(roller, FX_SPRITES.critBurst, { scale: 3.5 });
      vibrate(30, settings);
      break;
    case 'heal':
      if (partyBar) playSpriteOnce(partyBar, FX_SPRITES.healSparkle, { scale: 3.5 });
      break;
    default:
      break;
  }
}
