// ============================================================
// GAME.JS — top-level orchestrator. Owns the action functions
// that the UI layer calls; translates them into state updates
// using the engine/combat/dungeon/progression modules.
// ============================================================

import { store } from './engine/state.js';
import { saveGame, loadGame, hasSave, clearSave } from './engine/save.js';
import * as DiceEngine from './engine/dice-engine.js';
import * as Combat from './combat/combat.js';
import * as Dungeon from './dungeon/dungeon.js';
import * as Movement from './dungeon/movement.js';
import * as Encounters from './dungeon/encounters.js';
import * as Progression from './progression/progression.js';
import { getMonsterDef } from './data/monster-data.js';
import { getCharacterDef } from './data/character-data.js';
import { getDieDef } from './data/dice-data.js';
import { getPuzzle } from './data/content-data.js';
import { BALANCE } from './data/balance.js';
import * as UI from './ui/ui.js';
import { showModal, closeModal } from './ui/modal.js';

function rerender() {
  UI.render(store.get(), actions);
}

function hasScoutBonus(partyIds) {
  const found = partyIds
    .map(getCharacterDef)
    .find((c) => c.ability.hook === 'onSearchBoost');
  return found ? found.ability.bonusChance : 0;
}

function applyPartyDamage(expedition, amount) {
  const partyHp = Math.max(0, expedition.partyHp - amount);
  return { ...expedition, partyHp };
}

function applyPartyHeal(expedition, amount) {
  const partyHp = Math.min(expedition.partyMaxHp, expedition.partyHp + amount);
  return { ...expedition, partyHp };
}

function checkPartyWipe() {
  const { expedition } = store.get();
  if (expedition && expedition.partyHp <= 0) {
    gameOver('Your party was overwhelmed in the dark.');
    return true;
  }
  return false;
}

// ---------------------------------------------------------------
// TITLE / PARTY SELECT
// ---------------------------------------------------------------

function goToPartySelect() {
  store.update({ screen: 'party-select', pendingParty: [] });
}

function backToTitle() {
  store.update({
    screen: 'title', expedition: null, dungeon: null, fight: null, pendingParty: [],
  });
  saveGame();
}

function toggleCharacterSelect(id) {
  const { pendingParty } = store.get();
  const size = BALANCE.expedition.startingPartySize;
  let next;
  if (pendingParty.includes(id)) {
    next = pendingParty.filter((p) => p !== id);
  } else if (pendingParty.length < size) {
    next = pendingParty.concat(id);
  } else {
    next = pendingParty;
  }
  store.update({ pendingParty: next });
}

function confirmParty() {
  const { pendingParty } = store.get();
  const expedition = Progression.createExpedition(pendingParty, 1);
  const startingDice = ['basic_die', 'basic_die', 'basic_die', 'basic_die', 'basic_die', 'power_die', 'healing_die'];
  expedition.bag = DiceEngine.createBag(startingDice);
  const dungeon = Dungeon.enterFloor(1);
  store.update({ screen: 'dungeon', expedition, dungeon, pendingParty: [] });
  saveGame();
}

function continueExpedition() {
  const state = store.get();
  if (state.expedition && state.dungeon) {
    store.update({ screen: 'dungeon', fight: null });
  } else {
    goToPartySelect();
  }
}

// ---------------------------------------------------------------
// MOVEMENT
// ---------------------------------------------------------------

function moveForward() {
  const { dungeon } = store.get();
  store.update({ dungeon: Movement.moveForward(dungeon) });
  saveGame();
}
function turnLeft() {
  const { dungeon } = store.get();
  store.update({ dungeon: Movement.turnLeft(dungeon) });
}
function turnRight() {
  const { dungeon } = store.get();
  store.update({ dungeon: Movement.turnRight(dungeon) });
}

// ---------------------------------------------------------------
// INTERACT — dispatches based on the current room's kind
// ---------------------------------------------------------------

function interact() {
  const { dungeon } = store.get();
  const room = Dungeon.currentRoom(dungeon);
  if (room.resolved) return;

  switch (room.kind) {
    case 'monster':
    case 'boss':
      startCombatEncounter(room.monsterId);
      return;
    case 'treasure':
      openTreasureModal();
      return;
    case 'hidden_dice':
      openSearchModal();
      return;
    case 'trap':
      openTrapModal();
      return;
    case 'puzzle':
      openPuzzleModal();
      return;
    case 'shrine':
      openShrineModal();
      return;
    case 'story':
      openStoryModal();
      return;
    default:
      resolveCurrentRoom();
  }
}

function resolveCurrentRoom() {
  const { dungeon } = store.get();
  store.update({ dungeon: Dungeon.markRoomResolved(dungeon) });
  saveGame();
}

function openDiceBag() {
  const { expedition } = store.get();
  const counts = {};
  expedition.bag.forEach((d) => { counts[d.dieId] = (counts[d.dieId] || 0) + 1; });
  const rows = Object.entries(counts).map(([dieId, count]) => {
    const def = getDieDef(dieId);
    return `<div class="bag-row"><span>${def.name}</span><span>×${count}</span></div>`;
  }).join('') || '<p>Your dice bag is empty.</p>';
  showModal({
    title: 'Dice Bag', icon: '🎲',
    bodyHtml: `<div class="bag-list">${rows}</div><p class="subtle">${expedition.bag.length} rolls remaining.</p>`,
    buttons: [{ label: 'Close', onClick: closeModal, variant: 'secondary' }],
  });
}

// --- Treasure ---
function openTreasureModal() {
  const choices = Encounters.rollTreasureChoices();
  showModal({
    title: 'Treasure', icon: '💰',
    bodyHtml: `<p>Choose one die to add to your bag.</p>
      <div class="die-choice-row">
        ${choices.map((d, i) => `<button class="die-choice die-choice--${d.theme}" data-i="${i}">
          <div class="die-choice-name">${d.name}</div>
          <div class="die-choice-desc">${d.description}</div>
        </button>`).join('')}
      </div>`,
    buttons: [],
    dismissible: false,
  });
  document.querySelectorAll('.die-choice').forEach((el, i) => {
    el.addEventListener('click', () => {
      const { expedition } = store.get();
      const newBag = DiceEngine.addDie(expedition.bag, choices[i].id);
      store.update({ expedition: { ...expedition, bag: newBag } });
      closeModal();
      resolveCurrentRoom();
    });
  });
}

// --- Hidden dice / search ---
function openSearchModal() {
  const { expedition } = store.get();
  const bonus = hasScoutBonus(expedition.partyIds);
  const result = Encounters.resolveSearch(bonus);
  let bodyHtml;
  if (result.outcome === 'found') {
    const def = getDieDef(result.dieId);
    const newBag = DiceEngine.addDie(expedition.bag, result.dieId, result.count);
    store.update({ expedition: { ...expedition, bag: newBag } });
    bodyHtml = `<p>You found <strong>${result.count}× ${def.name}</strong>!</p>`;
  } else if (result.outcome === 'trap') {
    const updated = applyPartyDamage(expedition, result.damage);
    store.update({ expedition: updated });
    bodyHtml = `<p>A trap triggers! The party takes <strong>${result.damage}</strong> damage.</p>`;
  } else {
    bodyHtml = `<p>You search carefully but find nothing of note.</p>`;
  }
  showModal({
    title: 'Search', icon: '🔍', bodyHtml,
    buttons: [{ label: 'Continue', onClick: () => { closeModal(); resolveCurrentRoom(); checkPartyWipe(); } }],
    dismissible: false,
  });
}

// --- Trap ---
function openTrapModal() {
  const { expedition } = store.get();
  const result = Encounters.resolveTrap();
  let bodyHtml;
  if (result.outcome === 'damage') {
    store.update({ expedition: applyPartyDamage(expedition, result.value) });
    bodyHtml = `<p>The floor gives way! The party takes <strong>${result.value}</strong> damage.</p>`;
  } else if (result.outcome === 'cursedDie') {
    store.update({ expedition: { ...expedition, bag: DiceEngine.addDie(expedition.bag, 'cursed_die') } });
    bodyHtml = `<p>A cursed die slips into your bag...</p>`;
  } else {
    const { bag, removed } = DiceEngine.removeDice(expedition.bag, 1);
    store.update({ expedition: { ...expedition, bag } });
    bodyHtml = `<p>You lose ${removed.length ? '1 die' : 'nothing (bag was already empty)'} in the chaos.</p>`;
  }
  showModal({
    title: 'Trap!', icon: '⚠️', bodyHtml,
    buttons: [{ label: 'Continue', onClick: () => { closeModal(); resolveCurrentRoom(); checkPartyWipe(); } }],
    dismissible: false,
  });
}

// --- Puzzle ---
function openPuzzleModal() {
  const puzzle = Encounters.pickPuzzle();
  if (puzzle.type === 'choice') {
    showModal({
      title: puzzle.name, icon: '🧩',
      bodyHtml: `<p>${puzzle.prompt}</p>
        <div class="puzzle-options">
          ${puzzle.options.map((opt, i) => `<button class="btn btn--secondary" data-i="${i}">${opt}</button>`).join('')}
        </div>`,
      buttons: [],
      dismissible: false,
    });
    document.querySelectorAll('.puzzle-options .btn').forEach((btn, i) => {
      btn.addEventListener('click', () => resolvePuzzle(puzzle, i === puzzle.correctOption));
    });
  } else {
    // Sequence-type puzzles: shown as a memory flash, resolved with a
    // skill-flavored attempt roll to keep the vertical slice interaction light.
    showModal({
      title: puzzle.name, icon: '🧩',
      bodyHtml: `<p>${puzzle.prompt}</p>
        <div class="puzzle-symbols">${puzzle.symbols.join(' ')}</div>
        <p class="subtle">Memorize the sequence, then attempt it.</p>`,
      buttons: [
        { label: 'Attempt', onClick: () => resolvePuzzle(puzzle, Math.random() < 0.65) },
      ],
      dismissible: false,
    });
  }
}

function resolvePuzzle(puzzle, success) {
  const { expedition } = store.get();
  closeModal();
  let bodyHtml;
  let updated = expedition;
  if (success) {
    let bag = expedition.bag;
    if (puzzle.reward.dice) bag = DiceEngine.addDie(bag, puzzle.reward.dieType || 'basic_die', puzzle.reward.dice);
    updated = { ...expedition, bag };
    bodyHtml = `<p>Success! ${puzzle.reward.dice ? `You gain ${puzzle.reward.dice} dice.` : 'The mechanism yields its reward.'}</p>`;
  } else {
    let bag = expedition.bag;
    let hp = expedition.partyHp;
    if (puzzle.failPenalty.loseDice) bag = DiceEngine.removeDice(bag, puzzle.failPenalty.loseDice).bag;
    if (puzzle.failPenalty.cursedDie) bag = DiceEngine.addDie(bag, 'cursed_die');
    if (puzzle.failPenalty.damage) hp = Math.max(0, hp - puzzle.failPenalty.damage);
    updated = { ...expedition, bag, partyHp: hp };
    bodyHtml = `<p>The puzzle backfires.</p>`;
  }
  store.update({ expedition: updated });
  showModal({
    title: success ? 'Solved!' : 'Failed', icon: success ? '✅' : '❌', bodyHtml,
    buttons: [{ label: 'Continue', onClick: () => { closeModal(); resolveCurrentRoom(); checkPartyWipe(); } }],
    dismissible: false,
  });
}

// --- Shrine / random event ---
function openShrineModal() {
  const event = Encounters.pickShrineEvent();
  showModal({
    title: event.name, icon: '🕯️',
    bodyHtml: `<p>${event.description}</p>`,
    buttons: event.choices.map((choice) => ({
      label: choice.label,
      variant: 'secondary',
      onClick: () => resolveShrineChoice(choice),
    })),
    dismissible: false,
  });
}

function resolveShrineChoice(choice) {
  const { expedition } = store.get();
  let updated = { ...expedition };
  let bodyHtml = '<p>Nothing happens.</p>';

  const canAffordCost = !choice.cost || countDice(updated.bag, choice.cost.dieType) >= choice.cost.count;

  if (choice.cost && !canAffordCost) {
    bodyHtml = `<p>You don't have enough dice to do that.</p>`;
  } else {
    if (choice.cost) updated.bag = removeDiceByType(updated.bag, choice.cost.dieType, choice.cost.count);

    if (choice.successChance !== undefined) {
      const success = Math.random() < choice.successChance;
      const outcome = success ? choice.success : choice.failure;
      bodyHtml = applyOutcome(updated, outcome, success ? 'It works.' : 'It backfires.');
    } else if (choice.reward) {
      bodyHtml = applyOutcome(updated, choice.reward, 'You gain something.');
    } else {
      bodyHtml = '<p>You move on.</p>';
    }
  }

  store.update({ expedition: updated });
  closeModal();
  showModal({
    title: 'Result', icon: '✨', bodyHtml,
    buttons: [{ label: 'Continue', onClick: () => { closeModal(); resolveCurrentRoom(); checkPartyWipe(); } }],
    dismissible: false,
  });

  function applyOutcome(expObj, outcome, defaultText) {
    if (!outcome) return `<p>${defaultText}</p>`;
    const parts = [];
    if (outcome.heal) { expObj.partyHp = Math.min(expObj.partyMaxHp, expObj.partyHp + outcome.heal); parts.push(`Healed ${outcome.heal} HP.`); }
    if (outcome.damage) { expObj.partyHp = Math.max(0, expObj.partyHp - outcome.damage); parts.push(`Took ${outcome.damage} damage.`); }
    if (outcome.gold) { expObj.unbanked = { ...expObj.unbanked, gold: expObj.unbanked.gold + outcome.gold }; parts.push(`Found ${outcome.gold} gold.`); }
    if (outcome.dieType) { expObj.bag = DiceEngine.addDie(expObj.bag, outcome.dieType, outcome.count || 1); parts.push(`Gained ${outcome.count || 1}× ${getDieDef(outcome.dieType).name}.`); }
    if (outcome.storyFragment) { expObj.unbanked = { ...expObj.unbanked, storyFragments: expObj.unbanked.storyFragments.concat(outcome.storyFragment) }; parts.push('A story fragment is revealed.'); }
    return `<p>${parts.join(' ') || defaultText}</p>`;
  }
}

function countDice(bag, dieId) {
  return bag.filter((d) => d.dieId === dieId).length;
}
function removeDiceByType(bag, dieId, count) {
  let remaining = count;
  const kept = [];
  for (const d of bag) {
    if (d.dieId === dieId && remaining > 0) { remaining--; continue; }
    kept.push(d);
  }
  return kept;
}

// --- Story ---
function openStoryModal() {
  const { dungeon } = store.get();
  const text = Encounters.resolveStory(dungeon.floor.floorNumber);
  showModal({
    title: 'A Fragment of History', icon: '📜',
    bodyHtml: `<p>${text}</p>`,
    buttons: [{ label: 'Continue', onClick: () => { closeModal(); resolveCurrentRoom(); } }],
  });
}

// ---------------------------------------------------------------
// EXTRACTION
// ---------------------------------------------------------------

function openExtractPrompt() {
  showModal({
    title: 'Extraction Point', icon: '🚪',
    bodyHtml: `<p>Return to camp with everything you've found, or press on for greater risk and reward?</p>`,
    buttons: [
      { label: 'EXTRACT', onClick: extract },
      { label: 'Keep going', variant: 'secondary', onClick: closeModal },
    ],
  });
}

function extract() {
  closeModal();
  const state = store.get();
  const permanent = Progression.bankExpedition(state.permanent, state.expedition);
  const lastExtraction = {
    floorNumber: state.dungeon.floor.floorNumber,
    gold: state.expedition.unbanked.gold,
    relics: state.expedition.unbanked.relics.length,
  };
  store.update({
    permanent, lastExtraction, screen: 'extraction-summary',
    expedition: null, dungeon: null, fight: null,
  });
  saveGame();
}

function descendFloor() {
  const { dungeon, expedition } = store.get();
  const nextFloorNumber = dungeon.floor.floorNumber + 1;
  const nextDungeon = Dungeon.enterFloor(nextFloorNumber);
  store.update({
    dungeon: nextDungeon,
    expedition: { ...expedition, floorNumber: nextFloorNumber },
  });
  saveGame();
}

function gameOver(reason) {
  const state = store.get();
  const permanent = Progression.loseExpedition(state.permanent, state.expedition);
  const lastExtraction = { floorNumber: state.dungeon?.floor?.floorNumber ?? state.expedition?.floorNumber ?? 1 };
  store.update({
    permanent, lastRunReason: reason, lastExtraction,
    screen: 'game-over', expedition: null, dungeon: null, fight: null,
  });
  saveGame();
}

// ---------------------------------------------------------------
// COMBAT
// ---------------------------------------------------------------

function startCombatEncounter(monsterId) {
  const { expedition } = store.get();
  const fight = Combat.startCombat({ monsterId, partyIds: expedition.partyIds, bag: expedition.bag });
  store.update({ fight, screen: 'combat' });
}

function combatPush() {
  const state = store.get();
  const { fight: updatedFight, result } = Combat.push(state.fight);
  store.update({ fight: updatedFight, expedition: { ...state.expedition, bag: updatedFight.bag } });

  if (result.type === 'choose') {
    showModal({
      title: 'Choose a die to roll', icon: '🛡️',
      bodyHtml: `<p>Divine Guidance drew two dice. Pick one to roll — the other returns to your bag.</p>
        <div class="die-choice-row">
          ${updatedFight.pendingChoice.candidates.map((c, i) => {
            const def = getDieDef(c.dieId);
            return `<button class="die-choice die-choice--${def.theme}" data-instance="${c.instanceId}">
              <div class="die-choice-name">${def.name}</div>
              <div class="die-choice-desc">${def.description}</div>
            </button>`;
          }).join('')}
        </div>`,
      buttons: [],
      dismissible: false,
    });
    document.querySelectorAll('.die-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        closeModal();
        const current = store.get();
        const { fight: resolvedFight, result: pushResult } = Combat.resolvePush(current.fight, btn.dataset.instance);
        finishPush(resolvedFight, pushResult);
      });
    });
    return;
  }

  finishPush(updatedFight, result);
}

function finishPush(fight, result) {
  let nextFight = fight;
  if (result.type === 'heal' && result.healAmount) {
    const { expedition } = store.get();
    store.update({ expedition: applyPartyHeal(expedition, result.healAmount) });
  }
  if (result.type === 'bust') {
    const { fight: advancedFight, effects } = Combat.advanceMonster(nextFight);
    nextFight = advancedFight;
    applyMonsterEffects(effects);
  }
  store.update({ fight: nextFight, expedition: { ...store.get().expedition, bag: nextFight.bag } });
  checkPartyWipe();
}

function combatRelease() {
  const state = store.get();
  const { fight: releasedFight, result } = Combat.release(state.fight);

  if (result.type === 'victory') {
    handleVictory(releasedFight);
    return;
  }

  const { fight: advancedFight, effects } = Combat.advanceMonster(releasedFight);
  store.update({ fight: advancedFight, expedition: { ...state.expedition, bag: advancedFight.bag } });
  applyMonsterEffects(effects);
  checkPartyWipe();
}

function applyMonsterEffects(effects) {
  if (effects.partyDamage > 0) {
    const { expedition } = store.get();
    store.update({ expedition: applyPartyDamage(expedition, effects.partyDamage) });
  }
}

function handleVictory(fight) {
  const monsterDef = getMonsterDef(fight.monster.id);
  const { expedition, dungeon } = store.get();
  let updatedExpedition = { ...expedition };
  let rewardText = [];

  if (Math.random() < monsterDef.rewards.diceChance) {
    const dieId = monsterDef.rewards.diceOptions[Math.floor(Math.random() * monsterDef.rewards.diceOptions.length)];
    updatedExpedition.bag = DiceEngine.addDie(updatedExpedition.bag, dieId);
    rewardText.push(`+1 ${getDieDef(dieId).name}`);
  }
  const [minGold, maxGold] = monsterDef.rewards.gold;
  const gold = minGold + Math.floor(Math.random() * (maxGold - minGold + 1));
  updatedExpedition.unbanked = { ...updatedExpedition.unbanked, gold: updatedExpedition.unbanked.gold + gold };
  rewardText.push(`+${gold} gold`);

  const updatedDungeon = Dungeon.markRoomResolved(dungeon);

  store.update({ expedition: updatedExpedition, dungeon: updatedDungeon, fight: null, screen: 'dungeon' });
  saveGame();

  showModal({
    title: 'Victory!', icon: '🏆',
    bodyHtml: `<p>${monsterDef.name} is defeated.</p><p>${rewardText.join(' · ')}</p>`,
    buttons: [{ label: 'Continue', onClick: closeModal }],
  });
}

// ---------------------------------------------------------------
// DEBUG PANEL
// ---------------------------------------------------------------

function toggleDebugPanel() {
  store.update({ debugPanelOpen: !store.get().debugPanelOpen });
}
function closeDebugPanel() {
  store.update({ debugPanelOpen: false });
}
function debugAddDie(dieId) {
  const { expedition } = store.get();
  if (!expedition) return;
  store.update({ expedition: { ...expedition, bag: DiceEngine.addDie(expedition.bag, dieId) } });
}
function debugSetOvercharge(value) {
  const { fight } = store.get();
  if (!fight) return;
  store.update({ fight: { ...fight, overcharge: value } });
}
function debugDamageParty(amount) {
  const { expedition } = store.get();
  if (!expedition) return;
  store.update({ expedition: applyPartyDamage(expedition, amount) });
  checkPartyWipe();
}
function debugHealParty(amount) {
  const { expedition } = store.get();
  if (!expedition) return;
  store.update({ expedition: applyPartyHeal(expedition, amount) });
}
function debugKillMonster() {
  const { fight } = store.get();
  if (!fight) return;
  const { fight: releasedFight, result } = Combat.release({ ...fight, overcharge: 9999 });
  if (result.type === 'victory') handleVictory(releasedFight);
}
function debugSkipFloor() {
  const { dungeon } = store.get();
  if (!dungeon) return;
  descendFloor();
}
function debugResetExpedition() {
  backToTitle();
}
function debugClearSave() {
  clearSave();
  store.update({ screen: 'title' });
}

// ---------------------------------------------------------------
// ACTIONS BUNDLE (passed to UI layer)
// ---------------------------------------------------------------

const actions = {
  goToPartySelect, backToTitle, toggleCharacterSelect, confirmParty, continueExpedition,
  moveForward, turnLeft, turnRight, interact, openDiceBag, openExtractPrompt, descendFloor,
  combatPush, combatRelease,
  toggleDebugPanel, closeDebugPanel, debugAddDie, debugSetOvercharge, debugDamageParty,
  debugHealParty, debugKillMonster, debugSkipFloor, debugResetExpedition, debugClearSave,
};

export function initGame() {
  UI.initUI();
  if (hasSave()) loadGame();
  store.subscribe(rerender);
  rerender();
}
