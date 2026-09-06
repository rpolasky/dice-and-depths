// ============================================================
// MODAL.JS — a single reusable modal used for treasure choices,
// puzzles, shrine events, story fragments, and confirmations.
// ============================================================

let rootEl = null;

export function initModal() {
  rootEl = document.getElementById('modal-root');
}

/**
 * show({ title, icon, bodyHtml, buttons: [{label, onClick, variant}] })
 */
export function showModal({ title, icon = '', bodyHtml = '', buttons = [], dismissible = true }) {
  if (!rootEl) return;
  rootEl.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-header">
          ${icon ? `<span class="modal-icon">${icon}</span>` : ''}
          <h2>${title}</h2>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-actions"></div>
      </div>
    </div>
  `;
  const actions = rootEl.querySelector('.modal-actions');
  buttons.forEach((btn, i) => {
    const b = document.createElement('button');
    b.className = `btn ${btn.variant ? 'btn--' + btn.variant : 'btn--primary'}`;
    b.textContent = btn.label;
    b.addEventListener('click', () => {
      if (btn.onClick) btn.onClick();
    });
    actions.appendChild(b);
  });
  if (dismissible) {
    rootEl.querySelector('.modal-backdrop').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) closeModal();
    });
  }
}

export function closeModal() {
  if (!rootEl) return;
  rootEl.innerHTML = '';
}
