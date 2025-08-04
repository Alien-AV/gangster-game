const assert = require('assert');

function createElement(hidden=true) {
  return {
    classList: {
      classes: new Set(hidden ? ['hidden'] : []),
      add(cls){this.classes.add(cls);},
      remove(cls){this.classes.delete(cls);},
      contains(cls){return this.classes.has(cls);}
    },
    onclick: null
  };
}

const elements = {
  gangsterChoice: createElement(),
  chooseFace: createElement(false),
  chooseFist: createElement(false),
  chooseBrain: createElement(false)
};

global.document = {
  getElementById(id) {
    if (!elements[id]) elements[id] = createElement(false);
    return elements[id];
  }
};

global.alert = () => {};
global.window = { addEventListener: () => {} };

const Game = require('../game.js');
const game = Object.create(Game.prototype);
game.recruitQueue = [];
game.updateUI = () => {};

describe('recruit queue', () => {
  it('processes multiple recruiters sequentially', () => {
    const g1 = {busy: true};
    const g2 = {busy: true};
    game.showGangsterTypeSelection(type => { g1.busy = false; });
    game.showGangsterTypeSelection(type => { g2.busy = false; });
    const container = elements.gangsterChoice;
    assert(!container.classList.contains('hidden'));
    elements.chooseFace.onclick();
    assert.strictEqual(g1.busy, false);
    assert.strictEqual(g2.busy, true);
    assert(!container.classList.contains('hidden'));
    elements.chooseBrain.onclick();
    assert.strictEqual(g2.busy, false);
    assert(container.classList.contains('hidden'));
  });

  it('handles recruiters added while popup open', () => {
    game.recruitQueue = [];
    elements.gangsterChoice.classList.add('hidden');
    const container = elements.gangsterChoice;
    const g1 = {busy: true};
    const g2 = {busy: true};
    const g3 = {busy: true};
    game.showGangsterTypeSelection(() => { g1.busy = false; });
    assert(!container.classList.contains('hidden'));
    game.showGangsterTypeSelection(() => { g2.busy = false; });
    elements.chooseFist.onclick();
    assert.strictEqual(g1.busy, false);
    assert.strictEqual(g2.busy, true);
    assert(!container.classList.contains('hidden'));
    game.showGangsterTypeSelection(() => { g3.busy = false; });
    elements.chooseBrain.onclick();
    assert.strictEqual(g2.busy, false);
    assert(!container.classList.contains('hidden'));
    elements.chooseFace.onclick();
    assert.strictEqual(g3.busy, false);
    assert(container.classList.contains('hidden'));
  });
});

// simple test runner
function describe(name, fn){
  console.log(name);
  fn();
}
function it(name, fn){
  try {
    fn();
    console.log(' ✓', name);
  } catch (e) {
    console.error(' ✗', name);
    console.error(e);
    process.exit(1);
  }
}
