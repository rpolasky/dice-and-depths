// ============================================================
// SPRITE-FX.JS — plays horizontal filmstrip sprite sheets by
// stepping background-position on an interval (frame counts
// vary per sheet, so plain CSS @keyframes with fixed percentage
// stops don't generalize — this does).
// ============================================================

/**
 * Mounts a looping idle animation on an element and returns a
 * stop() function. Call stop() before the element is discarded
 * (or just let a fresh renderBattlePanel/renderDungeon call replace it —
 * intervals are cleared explicitly by callers that track them).
 */
export function playSpriteLoop(el, sprite, fps = 6) {
  el.style.backgroundImage = `url(${sprite.file})`;
  el.style.backgroundSize = `${sprite.frames * 100}% 100%`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';

  let frame = 0;
  const set = () => {
    el.style.backgroundPosition = `${(frame / (sprite.frames - 1)) * 100}% 0`;
  };
  set();
  const id = setInterval(() => {
    frame = (frame + 1) % sprite.frames;
    set();
  }, 1000 / fps);

  return () => clearInterval(id);
}

/**
 * Plays a sprite sheet through once as an absolutely-positioned
 * overlay appended to `container`, then removes itself. Fire-and-forget.
 */
export function playSpriteOnce(container, sprite, { fps = 14, scale = 3, className = '' } = {}) {
  if (!container) return;
  const el = document.createElement('div');
  el.className = `fx-burst ${className}`;
  el.style.width = `${sprite.frameW * scale}px`;
  el.style.height = `${sprite.frameH * scale}px`;
  el.style.backgroundImage = `url(${sprite.file})`;
  el.style.backgroundSize = `${sprite.frames * 100}% 100%`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';
  container.appendChild(el);

  let frame = 0;
  const total = sprite.frames;
  const id = setInterval(() => {
    frame++;
    if (frame >= total) {
      clearInterval(id);
      el.remove();
      return;
    }
    el.style.backgroundPosition = `${(frame / (total - 1)) * 100}% 0`;
  }, 1000 / fps);
}

export function vibrate(pattern, settings) {
  if (!settings || settings.haptics === false) return;
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* ignore unsupported */ }
  }
}
