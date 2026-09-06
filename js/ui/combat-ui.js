// ============================================================
// COMBAT-UI.JS — renders the push-your-luck combat screen.
// ============================================================

import { getIntentInfo, bagPeek } from '../combat/combat.js';
import { getThreshold, computeReleaseDamage, bustCeiling } from '../engine/overcharge.js';
import { getCharacterDef } from '../data/character-data.js';
import { getDieDef } from '../data/dice-data.js';

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

  root.innerHTML = `
    <div class="screen screen--combat" data-danger="${threshold.id}">
      <div class="monster-panel">
        <div class="monster-name">${monster.icon} ${monster.name}</div>
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
        <div class="party-hp-bar" aria-label="Party HP">
          <div class="party-hp-fill" style="width:${partyHpPct}%"></div>
          <span class="party-hp-label">${expedition.partyHp}/${expedition.partyMaxHp}</span>
        </div>
      </div>
    </div>
  `;

  root.querySelector('[data-action="release"]').addEventListener('click', actions.combatRelease);
  root.querySelector('[data-action="push"]').addEventListener('click', actions.combatPush);
}

export function renderDiceChoiceModal(candidates, onChoose) {
  return {
    title: 'Choose a die to roll',
    icon: '🛡️',
    bodyHtml: `<p>Divine Guidance drew two dice. The other returns to your bag.</p>
      <div class="die-choice-row">
        ${candidates.map((d, i) => `<div class="die-choice die-choice--${d.theme}" data-i="${i}">
          <div class="die-choice-name">${d.name}</div>
          <div class="die-choice-desc">${d.description}</div>
        </div>`).join('')}
      </div>`,
    buttons: [],
    onMount: null,
  };
}
