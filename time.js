// Global time scaling utilities for playtesting
// timeScale = 1 → real-time, 10 → 10x faster (durations are divided by 10)

let _timeScale = 1;

export function getTimeScale() {
  return _timeScale;
}

export function setTimeScale(scale) {
  const n = Number(scale);
  _timeScale = (isFinite(n) && n > 0) ? n : 1;
  return _timeScale;
}

export function scaleDurationMs(ms) {
  const n = Number(ms) || 0;
  const s = getTimeScale();
  if (s <= 0) return Math.max(0, Math.floor(n));
  return Math.max(0, Math.floor(n / s));
}

export function scaledTimeout(fn, ms, ...args) {
  return setTimeout(fn, scaleDurationMs(ms), ...args);
}

export function scaledInterval(fn, ms, ...args) {
  return setInterval(fn, scaleDurationMs(ms), ...args);
}

export function enableFastMode10x() {
  return setTimeScale(10);
}

export function disableFastMode() {
  return setTimeScale(1);
}


