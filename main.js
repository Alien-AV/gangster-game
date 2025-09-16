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
});
