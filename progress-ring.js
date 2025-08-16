// Reusable progress ring controller
// Modes: 'action' → ring-active, 'cooldown' → cooldown-active, 'heat' → heat-active

function clamp01(v) {
  return Math.min(1, Math.max(0, v || 0));
}

function resolveWrap(el) {
  if (!el) return null;
  if (el.classList && el.classList.contains('ring-wrap')) return el;
  if (el.classList && el.classList.contains('world-card')) {
    const p = el.parentElement;
    return (p && p.classList && p.classList.contains('ring-wrap')) ? p : null;
  }
  if (typeof el.closest === 'function') {
    return el.closest('.ring-wrap');
  }
  return null;
}

function classForMode(mode) {
  if (mode === 'cooldown') return 'cooldown-active';
  if (mode === 'heat') return 'heat-active';
  return 'ring-active';
}

function ensureTimersBag(wrap) {
  if (!wrap._ringTimers) wrap._ringTimers = {};
  return wrap._ringTimers;
}

function ensureLeftBadge(wrap) {
  if (!wrap) return null;
  const card = wrap.querySelector && wrap.querySelector('.world-card');
  if (!card) return null;
  let badge = card.querySelector('.world-card-badge.left');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'world-card-badge left';
    card.appendChild(badge);
  }
  return badge;
}

function removeLeftBadge(wrap) {
  const card = wrap && wrap.querySelector ? wrap.querySelector('.world-card') : null;
  if (!card) return;
  const badge = card.querySelector('.world-card-badge.left');
  if (badge) { try { badge.remove(); } catch(e){} }
}

export function setRing(el, mode, progress) {
  const wrap = resolveWrap(el);
  if (!wrap) return;
  const cls = classForMode(mode);
  try { wrap.classList.add(cls); } catch(e){}
  try { wrap.style.setProperty('--p', String(clamp01(progress))); } catch(e){}
}

export function clearRing(el, mode) {
  const wrap = resolveWrap(el);
  if (!wrap) return;
  const cls = classForMode(mode);
  try { wrap.classList.remove(cls); } catch(e){}
  try { wrap.style.removeProperty('--p'); } catch(e){}
  // Also clear controller if any
  const timers = ensureTimersBag(wrap);
  const t = timers[mode];
  if (t && t.rafId) cancelAnimationFrame(t.rafId);
  timers[mode] = null;
}

export function startTimer(el, { durationMs, mode = 'action', showBadge = true, onTick, onDone } = {}) {
  const wrap = resolveWrap(el);
  if (!wrap || !durationMs || durationMs <= 0) {
    if (typeof onTick === 'function') onTick(1, 0);
    if (typeof onDone === 'function') onDone();
    return;
  }
  const timers = ensureTimersBag(wrap);
  // Cancel existing
  const existing = timers[mode];
  if (existing && existing.rafId) cancelAnimationFrame(existing.rafId);
  const cls = classForMode(mode);
  try { wrap.classList.add(cls); } catch(e){}
  const badge = showBadge ? ensureLeftBadge(wrap) : null;
  const start = performance.now();
  const controller = { rafId: 0 };
  const step = (now) => {
    const elapsed = now - start;
    const remaining = Math.max(0, durationMs - elapsed);
    const p = clamp01(elapsed / durationMs);
    try { wrap.style.setProperty('--p', String(p)); } catch(e){}
    if (badge) badge.textContent = `${Math.ceil(remaining / 1000)}s`;
    if (typeof onTick === 'function') onTick(p, remaining);
    if (elapsed >= durationMs) {
      if (typeof onDone === 'function') onDone();
      // Clear only for action rings by default
      if (mode === 'action') {
        try { wrap.classList.remove(cls); } catch(e){}
        try { wrap.style.removeProperty('--p'); } catch(e){}
      }
      removeLeftBadge(wrap);
      timers[mode] = null;
      return;
    }
    controller.rafId = requestAnimationFrame(step);
  };
  controller.rafId = requestAnimationFrame(step);
  timers[mode] = controller;
}

export function startCountdown(el, { startMs, endMs, mode = 'cooldown', showBadge = false, onTick, onDone } = {}) {
  const wrap = resolveWrap(el);
  if (!wrap) {
    if (typeof onDone === 'function' && endMs <= Date.now()) onDone();
    return;
  }
  const timers = ensureTimersBag(wrap);
  // Ignore if already running this mode
  if (timers[mode] && timers[mode].rafId) return;
  const cls = classForMode(mode);
  try { wrap.classList.add(cls); } catch(e){}
  const badge = showBadge ? ensureLeftBadge(wrap) : null;
  const total = Math.max(1, (endMs || 0) - (startMs || 0));
  const start = startMs || Date.now();
  const controller = { rafId: 0 };
  const step = () => {
    const now = Date.now();
    const elapsed = Math.max(0, now - start);
    const remaining = Math.max(0, (endMs || now) - now);
    let p = clamp01(elapsed / total);
    if (mode === 'cooldown' || mode === 'heat') {
      p = 1 - p; // cooldown rings show remaining fraction
    }
    try { wrap.style.setProperty('--p', String(p)); } catch(e){}
    if (badge) badge.textContent = `${Math.ceil(remaining / 1000)}s`;
    if (typeof onTick === 'function') onTick(p, remaining);
    if (now >= (endMs || now)) {
      if (typeof onDone === 'function') onDone();
      try { wrap.classList.remove(cls); } catch(e){}
      try { wrap.style.removeProperty('--p'); } catch(e){}
      removeLeftBadge(wrap);
      timers[mode] = null;
      return;
    }
    controller.rafId = requestAnimationFrame(step);
  };
  // If already expired, end immediately
  if ((endMs || 0) <= Date.now()) {
    if (typeof onDone === 'function') onDone();
    try { wrap.classList.remove(cls); } catch(e){}
    try { wrap.style.removeProperty('--p'); } catch(e){}
    removeLeftBadge(wrap);
    timers[mode] = null;
    return;
  }
  controller.rafId = requestAnimationFrame(step);
  timers[mode] = controller;
}


