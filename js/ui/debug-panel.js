// ============================================================
// DEBUG-PANEL.JS — dev-only tools for balancing. Not linked from
// normal gameplay UI; toggled by a small "DEV" tab and meant to
// be stripped or hidden behind a flag for a public build.
// ============================================================

export function renderDebugPanel(root, state, actions) {
  let panel = document.getElementById('debug-panel');
  if (!state.debugPanelOpen) {
    if (panel) panel.remove();
    return;
  }
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'debug-panel';
    document.body.appendChild(panel);
  }

  panel.innerHTML = `
    <div class="debug-panel">
      <div class="debug-header">
        <span>DEV PANEL</span>
        <button data-action="close">✕</button>
      </div>
      <div class="debug-grid">
        <button data-action="add-basic">+1 Basic Die</button>
        <button data-action="add-power">+1 Power Die</button>
        <button data-action="add-critical">+1 Critical Die</button>
        <button data-action="add-cursed">+1 Cursed Die</button>
        <button data-action="set-oc-80">Set OC=80</button>
        <button data-action="set-oc-0">Set OC=0</button>
        <button data-action="damage-party">-20 Party HP</button>
        <button data-action="heal-party">+20 Party HP</button>
        <button data-action="kill-monster">Kill Monster</button>
        <button data-action="skip-floor">Skip Floor</button>
        <button data-action="reset-expedition">Reset Expedition</button>
        <button data-action="clear-save">Clear Save</button>
      </div>
    </div>
  `;

  panel.querySelector('[data-action="close"]').addEventListener('click', actions.closeDebugPanel);
  panel.querySelector('[data-action="add-basic"]').addEventListener('click', () => actions.debugAddDie('basic_die'));
  panel.querySelector('[data-action="add-power"]').addEventListener('click', () => actions.debugAddDie('power_die'));
  panel.querySelector('[data-action="add-critical"]').addEventListener('click', () => actions.debugAddDie('critical_die'));
  panel.querySelector('[data-action="add-cursed"]').addEventListener('click', () => actions.debugAddDie('cursed_die'));
  panel.querySelector('[data-action="set-oc-80"]').addEventListener('click', () => actions.debugSetOvercharge(80));
  panel.querySelector('[data-action="set-oc-0"]').addEventListener('click', () => actions.debugSetOvercharge(0));
  panel.querySelector('[data-action="damage-party"]').addEventListener('click', () => actions.debugDamageParty(20));
  panel.querySelector('[data-action="heal-party"]').addEventListener('click', () => actions.debugHealParty(20));
  panel.querySelector('[data-action="kill-monster"]').addEventListener('click', actions.debugKillMonster);
  panel.querySelector('[data-action="skip-floor"]').addEventListener('click', actions.debugSkipFloor);
  panel.querySelector('[data-action="reset-expedition"]').addEventListener('click', actions.debugResetExpedition);
  panel.querySelector('[data-action="clear-save"]').addEventListener('click', actions.debugClearSave);
}
