import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  // Bootstrap the game
  const game = new Game();
  // Expose for quick debugging in console
  window.game = game;
});
