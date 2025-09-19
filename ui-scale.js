// Runtime UI scale control for the world table.

const ROOT = () => document.documentElement;

export function getUiScale() {
  const v = getComputedStyle(ROOT()).getPropertyValue('--ui-scale');
  const n = parseFloat(v);
  return isFinite(n) && n > 0 ? n : 1;
}

export function setUiScale(scale) {
  const n = Number(scale);
  const s = (isFinite(n) && n > 0) ? n : 1;
  ROOT().style.setProperty('--ui-scale', String(s));
  return s;
}

export function increaseUiScale(step = 0.1) {
  const cur = getUiScale();
  return setUiScale(cur + step);
}

export function decreaseUiScale(step = 0.1) {
  const cur = getUiScale();
  return setUiScale(Math.max(0.1, cur - step));
}


