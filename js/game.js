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
import { getMonsterDef, MONSTER_DATA } from './data/monster-data.js';
import { getCharacterDef, nextUnlock } from './data/character-data.js';
import { getDieDef, getMaxFaceValue } from './data/dice-data.js';
import { getPuzzle } from './data/content-data.js';
import { DIE_SHAPE_ART, DIE_THEME_FILTER, shapeForMaxFace } from './data/sprite-data.js';
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
// TITLE / TAVERN (home base) / PARTY SELECT
// ---------------------------------------------------------------

/** Title screen's single action: resume a mid-run expedition, or head to the tavern. */
function enterGame() {
  const state = store.get();
  if (state.expedition && state.dungeon) {
    store.update({ screen: 'dungeon' });
  } else {
    store.update({ screen: 'tavern' });
  }
}

/** Returns to the tavern without touching any in-progress expedition state. */
function goToTavern() {
  store.update({ screen: 'tavern' });
  saveGame();
}

/** A full reset back to the title screen (debug/quit use only). */
function backToTitle() {
  store.update({
    screen: 'title', expedition: null, dungeon: null, fight: null, pendingParty: [],
  });
  saveGame();
}

/** Discards any in-progress expedition and heads to the tavern fresh. Permanent progress (characters, dice, gold) is untouched. */
function startNewExpeditionFromTitle() {
  store.update({ screen: 'tavern', expedition: null, dungeon: null, fight: null });
  saveGame();
}

function goToPartySelect() {
  const { permanent } = store.get();
  store.update({ screen: 'party-select', pendingParty: permanent.activeParty.slice() });
}

function backToTavernFromPartySelect() {
  store.update({ screen: 'tavern', pendingParty: [] });
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

/** Confirming a party at the tavern just sets your roster — it does NOT start an expedition. */
function confirmParty() {
  const { pendingParty, permanent } = store.get();
  store.update({
    permanent: { ...permanent, activeParty: pendingParty },
    screen: 'tavern',
    pendingParty: [],
  });
  saveGame();
}

/** The tavern's "head to the dungeon" action — this is what actually starts a run. */
function startExpeditionFromTavern() {
  const { permanent } = store.get();
  if (permanent.activeParty.length !== BALANCE.expedition.startingPartySize) {
    goToPartySelect();
    return;
  }
  const expedition = Progression.createExpedition(permanent.activeParty, 1);
  const startingDice = Progression.assembleStartingBag(permanent.activeParty, permanent.characterProgress);
  expedition.bag = DiceEngine.createBag(startingDice);
  const dungeon = Dungeon.enterFloor(1);
  currentRoomVisited(dungeon);
  store.update({
    screen: 'dungeon', expedition, dungeon,
    permanent: { ...permanent, stats: { ...permanent.stats, expeditionsRun: permanent.stats.expeditionsRun + 1 } },
  });
  saveGame();
}

function currentRoomVisited(dungeon) {
  const room = Dungeon.currentRoom(dungeon);
  room.visited = true;
}

// ---------------------------------------------------------------
// TAVERN INFO PANELS (character info, monster codex, dice library, stats)
// ---------------------------------------------------------------

function showCharacterInfo(characterId) {
  const c = getCharacterDef(characterId);
  const { permanent } = store.get();
  const prog = permanent.characterProgress[characterId] || { level: 1, xp: 0, bonusDice: [] };
  const xpNext = Progression.xpForNextLevel(prog.level);
  const xpLine = xpNext !== null
    ? `${prog.xp} / ${xpNext} XP to level ${prog.level + 1}`
    : 'Max level reached';
  const upcoming = nextUnlock(characterId, prog.level);
  showModal({
    title: c.name, icon: c.icon,
    bodyHtml: `
      <div class="character-modal-portrait" style="background-image:url(${c.portrait})"></div>
      <p class="subtle" style="text-align:center;margin-top:8px;">${c.className} · "${c.tagline}"</p>
      <div class="char-level-row">
        <span class="char-level-badge">Lv.${prog.level}</span>
        <span class="subtle">${xpLine}</span>
      </div>
      <p>${c.description}</p>
      ${upcoming ? `<p class="subtle">Next unlock at level ${upcoming.level}${upcoming.unlockName ? `: <strong>${upcoming.unlockName}</strong>` : ''}</p>` : ''}
      ${prog.bonusDice.length ? `<p class="subtle">Loot-earned dice: ${prog.bonusDice.length}</p>` : ''}`,
    buttons: [{ label: 'Close', onClick: closeModal, variant: 'secondary' }],
  });
}

function showMonsterCodex() {
  const { permanent } = store.get();
  const known = new Set(permanent.monsterCodex);
  const rows = Object.values(MONSTER_DATA).map((m) => {
    const discovered = known.has(m.id);
    if (!discovered) {
      return `<div class="codex-row codex-row--unknown"><span class="codex-icon">❓</span><div><div class="codex-name">???</div><div class="codex-desc">Not yet encountered.</div></div></div>`;
    }
    return `<div class="codex-row"><span class="codex-icon">${m.icon}</span><div><div class="codex-name">${m.name}${m.boss ? ' — BOSS' : ''}</div><div class="codex-desc">${m.hp} HP · Tier ${m.tier}</div></div></div>`;
  }).join('');
  showModal({
    title: 'Monster Codex', icon: '📖',
    bodyHtml: `<div class="codex-list">${rows}</div><p class="subtle">${known.size} of ${Object.keys(MONSTER_DATA).length} discovered.</p>`,
    buttons: [{ label: 'Close', onClick: closeModal, variant: 'secondary' }],
  });
}

function showDiceLibrary() {
  const { permanent } = store.get();
  const rows = permanent.unlockedDiceTypes.map((dieId) => {
    const d = getDieDef(dieId);
    return `<div class="codex-row"><span class="codex-icon">🎲</span><div><div class="codex-name">${d.name}</div><div class="codex-desc">${d.description}</div></div></div>`;
  }).join('');
  showModal({
    title: 'Dice Library', icon: '🎲',
    bodyHtml: `<div class="codex-list">${rows}</div>`,
    buttons: [{ label: 'Close', onClick: closeModal, variant: 'secondary' }],
  });
}

function showStats() {
  const { permanent } = store.get();
  const s = permanent.stats;
  showModal({
    title: 'Expedition Record', icon: '📊',
    bodyHtml: `
      <ul class="summary-list">
        <li>Highest floor reached: <strong>${permanent.highestFloorReached}</strong></li>
        <li>Best single Release: <strong>${s.bestAttackDamage}</strong> dmg</li>
        <li>Monsters defeated: <strong>${s.monstersDefeated}</strong></li>
        <li>Expeditions started: <strong>${s.expeditionsRun}</strong></li>
        <li>Banked gold: <strong>${permanent.bankedGold}</strong></li>
      </ul>`,
    buttons: [{ label: 'Close', onClick: closeModal, variant: 'secondary' }],
  });
}

function toggleMap() {
  store.update({ mapOpen: !store.get().mapOpen });
}

// ---------------------------------------------------------------
// MOVEMENT
// ---------------------------------------------------------------

function goDirection(rel) {
  const { dungeon } = store.get();
  const next = Movement.goRelative(dungeon, rel);
  if (next === dungeon) return; // blocked, nothing to do
  currentRoomVisited(next);
  store.update({ dungeon: next });
  saveGame();
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
        ${choices.map((d, i) => {
          const shape = shapeForMaxFace(getMaxFaceValue(d.id));
          const filter = DIE_THEME_FILTER[d.theme] || 'none';
          return `<button class="die-choice die-choice--${d.theme}" data-i="${i}">
          <div class="die-choice-art" style="background-image:url(${DIE_SHAPE_ART[shape]}); filter:${filter}"></div>
          <div class="die-choice-text">
            <div class="die-choice-name">${d.name}</div>
            <div class="die-choice-desc">${d.description}</div>
          </div>
        </button>`;
        }).join('')}
      </div>`,
    buttons: [],
    dismissible: false,
  });
  document.querySelectorAll('.die-choice').forEach((el, i) => {
    el.addEventListener('click', () => {
      closeModal();
      openLootRecipientModal(choices[i]);
    });
  });
}

/**
 * Second step of a treasure pickup: which character does this die join?
 * Picking a bench character (not in the active party) gives up using
 * the die THIS run in exchange for permanently growing that character's
 * loadout once the expedition is successfully extracted.
 */
function openLootRecipientModal(dieDef) {
  const { expedition, permanent } = store.get();
  const rows = permanent.unlockedCharacters.map((charId) => {
    const c = getCharacterDef(charId);
    const inParty = expedition.partyIds.includes(charId);
    const prog = permanent.characterProgress[charId] || { level: 1 };
    return `<button class="loot-recipient" data-char="${charId}">
      <div class="loot-recipient-portrait" style="background-image:url(${c.portrait})"></div>
      <div class="loot-recipient-info">
        <div class="loot-recipient-name">${c.name} <span class="loot-recipient-level">Lv.${prog.level}</span></div>
        <div class="loot-recipient-tag">${inParty ? 'In this expedition — usable now' : 'Not with you — saved for next time'}</div>
      </div>
    </button>`;
  }).join('');

  showModal({
    title: `Give the ${dieDef.name} to...`, icon: '🎁',
    bodyHtml: `<div class="loot-recipient-list">${rows}</div>`,
    buttons: [],
    dismissible: false,
  });

  document.querySelectorAll('.loot-recipient').forEach((btn) => {
    btn.addEventListener('click', () => {
      const charId = btn.dataset.char;
      const state = store.get();
      const inParty = state.expedition.partyIds.includes(charId);
      let updatedExpedition = {
        ...state.expedition,
        unbanked: {
          ...state.expedition.unbanked,
          dice: state.expedition.unbanked.dice.concat({ dieId: dieDef.id, targetCharacterId: charId }),
        },
      };
      if (inParty) {
        updatedExpedition.bag = DiceEngine.addDie(state.expedition.bag, dieDef.id);
      }
      store.update({ expedition: updatedExpedition });
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
    const target = expedition.partyIds[Math.floor(Math.random() * expedition.partyIds.length)];
    const newUnbanked = {
      ...expedition.unbanked,
      dice: expedition.unbanked.dice.concat(Array(result.count).fill({ dieId: result.dieId, targetCharacterId: target })),
    };
    store.update({ expedition: { ...expedition, bag: newBag, unbanked: newUnbanked } });
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
    let unbanked = expedition.unbanked;
    if (puzzle.reward.dice) {
      const dieId = puzzle.reward.dieType || 'basic_die';
      bag = DiceEngine.addDie(bag, dieId, puzzle.reward.dice);
      const target = expedition.partyIds[Math.floor(Math.random() * expedition.partyIds.length)];
      unbanked = { ...unbanked, dice: unbanked.dice.concat(Array(puzzle.reward.dice).fill({ dieId, targetCharacterId: target })) };
    }
    updated = { ...expedition, bag, unbanked };
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
  const summary = {
    floorNumber: state.dungeon.floor.floorNumber,
    gold: state.expedition.unbanked.gold,
    relics: state.expedition.unbanked.relics.length,
  };
  store.update({
    permanent, screen: 'tavern',
    expedition: null, dungeon: null, fight: null,
  });
  saveGame();
  showModal({
    title: 'Extraction successful', icon: '🚪',
    bodyHtml: `<p>You returned safely from Floor ${summary.floorNumber}.</p>
      <ul class="summary-list">
        <li>Gold banked: <strong>${summary.gold}</strong></li>
        <li>Relics found: <strong>${summary.relics}</strong></li>
      </ul>`,
    buttons: [{ label: 'Back to the tavern', onClick: closeModal }],
  });
}

function descendFloor() {
  const { dungeon, expedition } = store.get();
  const nextFloorNumber = dungeon.floor.floorNumber + 1;
  const nextDungeon = Dungeon.enterFloor(nextFloorNumber);
  currentRoomVisited(nextDungeon);
  store.update({
    dungeon: nextDungeon,
    expedition: { ...expedition, floorNumber: nextFloorNumber },
  });
  saveGame();
}

function gameOver(reason) {
  const state = store.get();
  const permanent = Progression.loseExpedition(state.permanent, state.expedition);
  const floorReached = state.dungeon?.floor?.floorNumber ?? state.expedition?.floorNumber ?? 1;
  store.update({
    permanent, screen: 'tavern',
    expedition: null, dungeon: null, fight: null,
  });
  saveGame();
  showModal({
    title: 'The expedition has fallen', icon: '💀',
    bodyHtml: `<p>${reason || 'Your party could not continue.'}</p>
      <p>Reached floor <strong>${floorReached}</strong>. Permanent progress is kept; unbanked treasure is lost.</p>`,
    buttons: [{ label: 'Back to the tavern', onClick: closeModal }],
  });
}

// ---------------------------------------------------------------
// COMBAT
// ---------------------------------------------------------------

function startCombatEncounter(monsterId) {
  const { expedition, permanent } = store.get();
  const characterLevels = Object.fromEntries(
    expedition.partyIds.map((id) => [id, permanent.characterProgress[id]?.level || 1])
  );
  const fight = Combat.startCombat({ monsterId, partyIds: expedition.partyIds, bag: expedition.bag, characterLevels });
  const codex = permanent.monsterCodex.includes(monsterId)
    ? permanent.monsterCodex
    : permanent.monsterCodex.concat(monsterId);
  store.update({ fight, permanent: { ...permanent, monsterCodex: codex } });
}

function combatPush() {
  const state = store.get();
  const { fight: updatedFight, result } = Combat.push(state.fight);

  // 'choose' (e.g. Paladin's Divine Guidance) is rendered INLINE in the
  // battle overlay's center zone (see combat-ui.js) — this is the one
  // legitimate standalone update in this flow (finishPush isn't reached
  // yet, since no die has actually resolved).
  if (result.type === 'choose') {
    store.update({ fight: updatedFight, expedition: { ...state.expedition, bag: updatedFight.bag } });
    return;
  }

  finishPush(updatedFight, result);
}

/** Resolves a pending Paladin-style choose-a-die prompt. Called by the UI when the player taps one of the offered dice. */
function combatResolveChoice(instanceId) {
  const state = store.get();
  const { fight: resolvedFight, result } = Combat.resolvePush(state.fight, instanceId);
  finishPush(resolvedFight, result);
}

function finishPush(fight, result) {
  let nextFight = fight;
  let updatedExpedition = store.get().expedition;

  if (result.type === 'heal' && result.healAmount) {
    updatedExpedition = applyPartyHeal(updatedExpedition, result.healAmount);
  }
  if (result.type === 'bust') {
    const { fight: advancedFight, effects } = Combat.advanceMonster(nextFight);
    nextFight = advancedFight;
    if (effects.partyDamage > 0) updatedExpedition = applyPartyDamage(updatedExpedition, effects.partyDamage);
  }
  // A single store.update() for the whole action: the corridor scene
  // remounts on every render, so multiple sequential updates for one
  // user action would let a later render's remount wipe out FX elements
  // (floating damage numbers, bursts) that an earlier render just added.
  store.update({ fight: nextFight, expedition: { ...updatedExpedition, bag: nextFight.bag } });
  checkPartyWipe();
}

function combatRelease() {
  const state = store.get();
  const { fight: releasedFight, result } = Combat.release(state.fight);
  trackBestAttack(result.damage);

  if (result.type === 'victory') {
    handleVictory(releasedFight);
    return;
  }

  const { fight: advancedFight, effects } = Combat.advanceMonster(releasedFight);
  let updatedExpedition = { ...state.expedition, bag: advancedFight.bag };
  if (effects.partyDamage > 0) updatedExpedition = applyPartyDamage(updatedExpedition, effects.partyDamage);
  if (result.droppedDie) {
    const targetCharacterId = state.expedition.partyIds[Math.floor(Math.random() * state.expedition.partyIds.length)];
    updatedExpedition = {
      ...updatedExpedition,
      unbanked: { ...updatedExpedition.unbanked, dice: updatedExpedition.unbanked.dice.concat({ dieId: result.droppedDie, targetCharacterId }) },
    };
  }
  store.update({ fight: advancedFight, expedition: updatedExpedition });
  checkPartyWipe();
}

function trackBestAttack(damage) {
  if (!damage) return;
  const { permanent } = store.get();
  if (damage > permanent.stats.bestAttackDamage) {
    store.update({ permanent: { ...permanent, stats: { ...permanent.stats, bestAttackDamage: damage } } });
  }
}

function combatFlee() {
  const state = store.get();
  const fled = Combat.fleeCombat(state.fight);
  store.update({ fight: null });
  showModal({
    title: 'Fled the fight', icon: '🏃',
    bodyHtml: `<p>You break off and retreat. ${fled.monster.name} is still out there.</p>`,
    buttons: [{ label: 'Continue', onClick: closeModal }],
  });
}
function handleVictory(fight) {
  const monsterDef = getMonsterDef(fight.monster.id);
  const { expedition, dungeon, permanent } = store.get();
  let updatedExpedition = { ...expedition };
  let rewardText = [];

  if (Math.random() < monsterDef.rewards.diceChance) {
    const dieId = monsterDef.rewards.diceOptions[Math.floor(Math.random() * monsterDef.rewards.diceOptions.length)];
    const targetCharacterId = expedition.partyIds[Math.floor(Math.random() * expedition.partyIds.length)];
    updatedExpedition.bag = DiceEngine.addDie(updatedExpedition.bag, dieId);
    updatedExpedition.unbanked = {
      ...updatedExpedition.unbanked,
      dice: updatedExpedition.unbanked.dice.concat({ dieId, targetCharacterId }),
    };
    rewardText.push(`+1 ${getDieDef(dieId).name} (for ${getCharacterDef(targetCharacterId).name})`);
  }
  const [minGold, maxGold] = monsterDef.rewards.gold;
  const gold = minGold + Math.floor(Math.random() * (maxGold - minGold + 1));
  updatedExpedition.unbanked = { ...updatedExpedition.unbanked, gold: updatedExpedition.unbanked.gold + gold };
  rewardText.push(`+${gold} gold`);

  const updatedDungeon = Dungeon.markRoomResolved(dungeon);

  const xpAmount = (BALANCE.leveling.xpByMonsterTier[monsterDef.tier] || 10) + (monsterDef.boss ? BALANCE.leveling.xpBossBonus : 0);
  const { permanent: xpPermanent, levelUps } = Progression.grantPartyXp(permanent, expedition.partyIds, xpAmount);
  const updatedPermanent = { ...xpPermanent, stats: { ...xpPermanent.stats, monstersDefeated: xpPermanent.stats.monstersDefeated + 1 } };

  store.update({ expedition: updatedExpedition, dungeon: updatedDungeon, fight: null, permanent: updatedPermanent });
  saveGame();

  const levelUpHtml = levelUps.map((lu) => {
    const c = getCharacterDef(lu.characterId);
    const unlock = c.levelUnlocks.find((u) => u.level === lu.newLevel);
    return `<p class="level-up-line">⭐ <strong>${c.name}</strong> reached level ${lu.newLevel}!${unlock?.unlockName ? ` Unlocked <strong>${unlock.unlockName}</strong> — ${unlock.unlockDesc}` : ''}</p>`;
  }).join('');

  showModal({
    title: 'Victory!', icon: '🏆',
    bodyHtml: `<p>${monsterDef.name} is defeated.</p><p>${rewardText.join(' · ')} · +${xpAmount} XP</p>${levelUpHtml}`,
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
  goToTavern();
  store.update({ expedition: null, dungeon: null, fight: null });
}
function debugClearSave() {
  clearSave();
  store.update({ screen: 'title' });
}

// ---------------------------------------------------------------
// ACTIONS BUNDLE (passed to UI layer)
// ---------------------------------------------------------------

const actions = {
  enterGame, goToTavern, backToTitle, startNewExpeditionFromTitle, goToPartySelect, backToTavernFromPartySelect,
  toggleCharacterSelect, confirmParty, startExpeditionFromTavern,
  showCharacterInfo, showMonsterCodex, showDiceLibrary, showStats, toggleMap,
  goDirection, interact, openDiceBag, openExtractPrompt, descendFloor,
  combatPush, combatRelease, combatFlee, combatResolveChoice,
  toggleDebugPanel, closeDebugPanel, debugAddDie, debugSetOvercharge, debugDamageParty,
  debugHealParty, debugKillMonster, debugSkipFloor, debugResetExpedition, debugClearSave,
};

export function initGame() {
  UI.initUI();
  if (hasSave()) loadGame();
  store.subscribe(rerender);
  rerender();
}
