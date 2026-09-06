// ============================================================
// MONSTER-INTENT.JS — monsters never roll dice. Each round they
// telegraph one intent from their intentPattern (looping), which
// resolves at the end of the player's phase.
// ============================================================

export function currentIntent(monsterState) {
  const pattern = monsterState.intentPattern;
  const idx = monsterState.intentIndex % pattern.length;
  const intent = pattern[idx];

  if (intent.kind === 'inferno') {
    const roundsLeft = monsterState.infernoCharge ?? intent.chargeRounds;
    if (roundsLeft > 0) {
      return { ...intent, kind: 'charging', roundsLeft, label: intent.label || 'Charging' };
    }
    return { ...intent, kind: 'inferno', label: intent.label || 'Inferno' };
  }

  return intent;
}

export function describeIntent(intent) {
  switch (intent.kind) {
    case 'attack': return { text: intent.label || 'Attack', detail: `${intent.value} DAMAGE`, danger: true };
    case 'guard': return { text: 'Guard', detail: `-${intent.value}% dmg taken`, danger: false };
    case 'curse': return { text: 'Curse', detail: 'Adds a cursed die', danger: false };
    case 'web': return { text: 'Web', detail: 'Next push is riskier', danger: false };
    case 'steal': return { text: 'Steal', detail: 'Removes a die', danger: false };
    case 'charging': return { text: intent.label, detail: `Charging (${intent.roundsLeft} left)`, danger: false };
    case 'inferno': return { text: intent.label, detail: `${intent.value} DAMAGE TO PARTY`, danger: true };
    default: return { text: 'Unknown', detail: '', danger: false };
  }
}

/**
 * Resolves the monster's current intent. Returns an effects object
 * describing what happened; combat.js applies it to shared state.
 */
export function resolveIntent(monsterState) {
  const pattern = monsterState.intentPattern;
  const idx = monsterState.intentIndex % pattern.length;
  const intent = pattern[idx];
  const effects = { partyDamage: 0, guardPercent: 0, addCursedDie: false, removeDie: false, webActive: false, log: [] };

  if (intent.kind === 'inferno') {
    const roundsLeft = (monsterState.infernoCharge ?? intent.chargeRounds) - 1;
    if (roundsLeft > 0) {
      monsterState.infernoCharge = roundsLeft;
      effects.log.push(`${monsterState.name} is charging ${intent.label}... (${roundsLeft} rounds left)`);
    } else {
      effects.partyDamage += intent.value;
      effects.log.push(`${monsterState.name} unleashes ${intent.label} for ${intent.value} damage!`);
      monsterState.infernoCharge = intent.chargeRounds; // reset for next cycle
      monsterState.intentIndex++;
    }
    return effects;
  }

  switch (intent.kind) {
    case 'attack':
      effects.partyDamage += intent.value;
      effects.log.push(`${monsterState.name} uses ${intent.label || 'an attack'} for ${intent.value} damage.`);
      break;
    case 'guard':
      effects.guardPercent = intent.value;
      effects.log.push(`${monsterState.name} guards, reducing the next hit by ${intent.value}%.`);
      break;
    case 'curse':
      effects.addCursedDie = true;
      effects.log.push(`${monsterState.name} curses your dice bag!`);
      break;
    case 'web':
      effects.webActive = true;
      effects.log.push(`${monsterState.name} webs your next push, making it riskier.`);
      break;
    case 'steal':
      effects.removeDie = true;
      effects.log.push(`${monsterState.name} steals a die from your bag!`);
      break;
    default:
      break;
  }

  monsterState.intentIndex++;
  return effects;
}

export function createMonsterState(monsterDef) {
  return {
    ...monsterDef,
    currentHp: monsterDef.hp,
    intentIndex: 0,
    infernoCharge: null,
  };
}
