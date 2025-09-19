import { Game } from './game.js';
import { enableFastMode10x, disableFastMode, setTimeScale, getTimeScale } from './time.js';
import { setUiScale, getUiScale, increaseUiScale, decreaseUiScale } from './ui-scale.js';

window.addEventListener('DOMContentLoaded', () => {
  // Bootstrap the game
  const game = new Game();
  // Expose for quick debugging in console
  window.game = game;
  // Debug time helpers for playtesting
  window.enableFastMode10x = enableFastMode10x;
  window.disableFastMode = disableFastMode;
  window.setTimeScale = setTimeScale;
  window.getTimeScale = getTimeScale;
  // UI scale helpers
  window.setUiScale = setUiScale;
  window.getUiScale = getUiScale;
  window.increaseUiScale = increaseUiScale;
  window.decreaseUiScale = decreaseUiScale;

  // Bind UI zoom controls
  const zoomValEl = document.getElementById('zoomValue');
  const applyZoomLabel = () => { if (zoomValEl) { const p = Math.round(getUiScale() * 100); zoomValEl.textContent = p + '%'; } };
  applyZoomLabel();
  const zi = document.getElementById('zoomInBtn');
  const zo = document.getElementById('zoomOutBtn');
  const zr = document.getElementById('zoomResetBtn');
  if (zi) zi.addEventListener('click', () => { increaseUiScale(0.1); applyZoomLabel(); });
  if (zo) zo.addEventListener('click', () => { decreaseUiScale(0.1); applyZoomLabel(); });
  if (zr) zr.addEventListener('click', () => { setUiScale(1); applyZoomLabel(); });

  // Alt + wheel to zoom
  const worldArea = document.getElementById('worldArea');
  const onWheel = (ev) => {
    if (!ev.altKey) return;
    ev.preventDefault();
    const dy = ev.deltaY || 0;
    if (dy > 0) decreaseUiScale(0.05); else increaseUiScale(0.05);
    applyZoomLabel();
  };
  if (worldArea) {
    worldArea.addEventListener('wheel', onWheel, { passive: false });
  }
});
