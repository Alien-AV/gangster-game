// JavaScript for Gangster Game moved from index.html
import { ACTIONS } from './actions.js';

export class Game {
  constructor() {
    this.state = {
      time: 0,
      cleanMoney: 0,
      dirtyMoney: 0,
      patrol: 0,
      territory: 0,
      heat: 0,
      heatProgress: 0,
      disagreeableOwners: 0,
      fear: 0,
      respect: 0,
      businesses: 0,
      unlockedEnforcer: false,
      unlockedGangster: false,
      unlockedBusiness: false,
      illicitCounts: { counterfeiting: 0, drugs: 0, gambling: 0, fencing: 0 },
      illicit: 0,
      illicitProgress: 0,
      unlockedIllicit: false,
      gangsters: [],
      nextGangId: 1,
      salaryTick: 0,
    };
    this.DISAGREEABLE_CHANCE = 0.2;
    this.SALARY_PER_10S = { face: 5, fist: 5, brain: 7 };

    this.darkToggle = document.getElementById('darkToggle');
    const storedDark = localStorage.getItem('dark') === '1';
    this.darkToggle.checked = storedDark;
    document.body.classList.toggle('dark-mode', storedDark);
    this.darkToggle.addEventListener('change', e => {
      document.body.classList.toggle('dark-mode', e.target.checked);
      localStorage.setItem('dark', e.target.checked ? '1' : '0');
    });

    document.getElementById('payCops').onclick = () => this.payCops();
    document.getElementById('resetGame').onclick = () => {
      localStorage.removeItem('gameState');
      location.reload();
    };

    // Save/Load slot buttons
    const byId = id => document.getElementById(id);
    const hookSlot = (n) => {
      const sId = `saveSlot${n}`;
      const lId = `loadSlot${n}`;
      const sBtn = byId(sId);
      const lBtn = byId(lId);
      if (sBtn) sBtn.onclick = () => this.saveToSlot(n);
      if (lBtn) lBtn.onclick = () => this.loadFromSlot(n);
    };
    hookSlot(1); hookSlot(2); hookSlot(3);

    this.loadState();
    // Ensure legacy saves have stats on gangsters
    (this.state.gangsters || []).forEach(g => this._ensureGangsterStats(g));
    // Ensure Boss exists as a normal gangster with special stats/name
    if (!this.state.gangsters.some(g => g.type === 'boss')) {
      const bossGang = { id: this.state.nextGangId++, type: 'boss', name: 'Boss', busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } };
      this.state.gangsters.unshift(bossGang);
    }
    // Initialize card UI prototype
    this.initCardUI();
    this.interval = setInterval(() => this.tick(), 1000);

    // Queued selection managers to avoid overlapping popups
    this._gangsterSelect = { queue: [], active: false };
    this._illicitSelect = { queue: [], active: false };
  }

  saveState() {
    const data = this.serializeState();
    localStorage.setItem('gameState', JSON.stringify(data));
  }

  serializeState() {
    const s = this.state;
    return {
      time: s.time,
      cleanMoney: s.cleanMoney,
      dirtyMoney: s.dirtyMoney,
      patrol: s.patrol,
      territory: s.territory,
      heat: s.heat,
      heatProgress: s.heatProgress,
      disagreeableOwners: s.disagreeableOwners,
      fear: s.fear,
      respect: s.respect,
      businesses: s.businesses,
      unlockedEnforcer: s.unlockedEnforcer,
      unlockedGangster: s.unlockedGangster,
      unlockedBusiness: s.unlockedBusiness,
      illicitCounts: s.illicitCounts,
      illicit: s.illicit,
      illicitProgress: s.illicitProgress,
      unlockedIllicit: s.unlockedIllicit,
      gangsters: (s.gangsters || []).map(g => ({ id: g.id, type: g.type, busy: false, personalHeat: g.personalHeat || 0, stats: g.stats || this.defaultStatsForType(g.type), name: g.name })),
      nextGangId: s.nextGangId,
      salaryTick: s.salaryTick,
    };
  }

  slotKey(n) { return `gameState_slot${n}`; }

  saveToSlot(n) {
    try {
      const data = this.serializeState();
      localStorage.setItem(this.slotKey(n), JSON.stringify(data));
      alert(`Saved to slot ${n}`);
    } catch (e) {
      console.error('Save failed', e);
      alert('Save failed');
    }
  }

  loadFromSlot(n) {
    const raw = localStorage.getItem(this.slotKey(n));
    if (!raw) {
      alert(`No save found in slot ${n}`);
      return;
    }
    try {
      const data = JSON.parse(raw);
      console.debug('[LoadSlot] parsed data', data);
      Object.assign(this.state, data);
      this.state.gangsters = (data.gangsters || []).map(g => ({ id: g.id, type: g.type, name: g.name, busy: false, personalHeat: g.personalHeat || 0, stats: g.stats || this.defaultStatsForType(g.type) }));
      // Ensure Boss exists
      if (!this.state.gangsters.some(x => x.type === 'boss')) {
        const bossGang = { id: this.state.nextGangId++, type: 'boss', name: 'Boss', busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } };
        this.state.gangsters.unshift(bossGang);
      }
      // Reset modal queues and refresh UI
      this._gangsterSelect = { queue: [], active: false };
      this._illicitSelect = { queue: [], active: false };
      this.renderCards();
      console.debug('[LoadSlot] after renderCards, state:', this.state);
      this.updateUI();
      alert(`Loaded slot ${n}`);
    } catch (e) {
      console.error('Load failed', e);
      alert('Load failed');
    }
  }

  loadState() {
    const raw = localStorage.getItem('gameState');
    if (!raw) {
      this.updateUI();
      return;
    }
    try {
      const data = JSON.parse(raw);
      Object.assign(this.state, data);
      this.state.gangsters = (data.gangsters || []).map(g => ({ id: g.id, type: g.type, name: g.name, busy: false, personalHeat: g.personalHeat || 0, stats: g.stats || this.defaultStatsForType(g.type) }));
    } catch (e) {
      console.error('Failed to load saved state', e);
    }
    this.updateUI();
    // Keep card UI in sync
    this.renderCards();
    // Ensure Boss exists as a normal gangster with special stats/name
    if (!this.state.gangsters.some(g => g.type === 'boss')) {
      const bossGang = { id: this.state.nextGangId++, type: 'boss', name: 'Boss', busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } };
      this.state.gangsters.unshift(bossGang);
    }
  }

  totalMoney() {
    return this.state.cleanMoney + this.state.dirtyMoney;
  }

  fearLevel() {
    return Math.floor(this.state.fear / 5);
  }

  respectLevel() {
    return Math.floor((this.state.respect || 0) / 5);
  }

  extortDuration(base) {
    const level = this.fearLevel();
    const factor = Math.max(0.5, 1 - level * 0.1);
    return base * factor;
  }

  enforcerCost() {
    const level = this.fearLevel();
    return Math.max(1, 5 - level);
  }

  gangsterCost() {
    const level = this.fearLevel();
    return Math.max(5, 20 - level * 2);
  }

  businessCost() {
    const base = 100;
    const discount = this.fearLevel() * 5; // $5 off per fear level
    return Math.max(50, base - discount);
  }

  paySalaries() {
    const s = this.state;
    const due = s.gangsters.reduce((sum, g) => sum + (this.SALARY_PER_10S[g.type] || 0), 0);
    if (due > 0) this.spendMoney(due);
  }

  spendMoney(amount) {
    const s = this.state;
    if (s.dirtyMoney >= amount) {
      s.dirtyMoney -= amount;
    } else {
      const remaining = amount - s.dirtyMoney;
      s.dirtyMoney = 0;
      s.cleanMoney = Math.max(0, s.cleanMoney - remaining);
    }
  }

  updateUI() {
    const s = this.state;
    document.getElementById('time').textContent = s.time;
    document.getElementById('cleanMoney').textContent = s.cleanMoney;
    document.getElementById('dirtyMoney').textContent = s.dirtyMoney;
    document.getElementById('patrol').textContent = s.patrol;
    document.getElementById('territory').textContent = s.territory;
    document.getElementById('heat').textContent = s.heat;
    const heatBar = document.getElementById('heatProgressBar');
    heatBar.style.width = (s.heatProgress * 10) + '%';
    document.getElementById('disagreeableOwners').textContent = s.disagreeableOwners;
    document.getElementById('fear').textContent = s.fear;
    const rl = this.fearLevel();
    const bCost = this.businessCost();
    document.getElementById('respect').textContent = s.respect;
    const fearBonusEl = document.getElementById('fearBonus');
    if (fearBonusEl) fearBonusEl.textContent = rl > 0 ? `Business cost $${bCost}` : 'None';
    const rL = this.respectLevel();
    const respectBonusEl = document.getElementById('respectBonus');
    if (respectBonusEl) respectBonusEl.textContent = rL > 0 ? `Fronts +$${rL} clean/s each; Laundering +${rL * 10}% yield` : 'None';
    document.getElementById('businesses').textContent = s.businesses;
    const faces = s.gangsters.filter(g => g.type === 'face').length;
    const fists = s.gangsters.filter(g => g.type === 'fist').length;
    const brains = s.gangsters.filter(g => g.type === 'brain').length;
    document.getElementById('faces').textContent = faces;
    document.getElementById('fists').textContent = fists;
    document.getElementById('brains').textContent = brains;
    document.getElementById('illicit').textContent = s.illicit;
    document.getElementById('counterfeitingCount').textContent = s.illicitCounts.counterfeiting;
    document.getElementById('drugCount').textContent = s.illicitCounts.drugs;
    document.getElementById('gamblingCount').textContent = s.illicitCounts.gambling;
    document.getElementById('fencingCount').textContent = s.illicitCounts.fencing;
    if (s.heat > 0) document.getElementById('payCops').classList.remove('hidden');
    // Card UI only; avoid rendering legacy button UI
    this.renderCards();
    this.saveState();
  }

  runProgress(container, duration, callback) {
    if (!container) {
      console.warn('[runProgress] missing container');
      if (typeof callback === 'function') callback();
      this.updateUI();
      return;
    }
    const stacked = container.classList.contains('progress-stack');
    let bar = null;
    if (stacked) {
      bar = document.createElement('div');
      bar.className = 'progress-bar';
      bar.style.height = '6px';
      bar.style.background = '#4caf50';
      bar.style.width = '0%';
      container.appendChild(bar);
    } else {
      bar = container.querySelector('.progress-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'progress-bar';
        container.appendChild(bar);
      }
      bar.style.width = '0%';
    }
    container.classList.remove('hidden');
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const percent = Math.min((elapsed / duration) * 100, 100);
      bar.style.width = percent + '%';
      if (elapsed >= duration) {
        clearInterval(interval);
        if (stacked) {
          // remove only this bar; keep container visible for other bars
          bar.remove();
        } else {
          container.classList.add('hidden');
          bar.style.width = '100%';
        }
        callback();
        this.updateUI();
      }
    }, 50);
  }

  showGangsterTypeSelection(callback) {
    // Enqueue the request and process if idle
    this._gangsterSelect.queue.push(callback);
    if (!this._gangsterSelect.active) this._processGangsterSelection();
  }

  _processGangsterSelection() {
    const mgr = this._gangsterSelect;
    if (mgr.active) return;
    const next = mgr.queue.shift();
    if (!next) return;
    mgr.active = true;
    const container = document.getElementById('gangsterChoice');
    const faceBtn = document.getElementById('chooseFace');
    const fistBtn = document.getElementById('chooseFist');
    const brainBtn = document.getElementById('chooseBrain');
    const cleanup = () => {
      container.classList.add('hidden');
      faceBtn.removeEventListener('click', onFace);
      fistBtn.removeEventListener('click', onFist);
      brainBtn.removeEventListener('click', onBrain);
      mgr.active = false;
      if (mgr.queue.length) this._processGangsterSelection();
    };
    const onChoose = type => {
      // Clean up modal and listeners BEFORE updating UI to prevent DOM churn issues
      cleanup();
      try { next(type); } finally { this.updateUI(); }
    };
    const onFace = () => onChoose('face');
    const onFist = () => onChoose('fist');
    const onBrain = () => onChoose('brain');
    faceBtn.addEventListener('click', onFace);
    fistBtn.addEventListener('click', onFist);
    brainBtn.addEventListener('click', onBrain);
    container.classList.remove('hidden');
  }

  showIllicitBusinessSelection(callback) {
    this._illicitSelect.queue.push(callback);
    if (!this._illicitSelect.active) this._processIllicitSelection();
  }

  _processIllicitSelection() {
    const mgr = this._illicitSelect;
    if (mgr.active) return;
    const next = mgr.queue.shift();
    if (!next) return;
    mgr.active = true;
    const container = document.getElementById('illicitChoice');
    const cBtn = document.getElementById('chooseCounterfeiting');
    const dBtn = document.getElementById('chooseDrugs');
    const gBtn = document.getElementById('chooseGambling');
    const fBtn = document.getElementById('chooseFencing');
    const cleanup = () => {
      container.classList.add('hidden');
      cBtn.removeEventListener('click', onC);
      dBtn.removeEventListener('click', onD);
      gBtn.removeEventListener('click', onG);
      fBtn.removeEventListener('click', onF);
      mgr.active = false;
      if (mgr.queue.length) this._processIllicitSelection();
    };
    const onChoose = type => {
      try { next(type); } finally { this.updateUI(); }
      cleanup();
    };
    const onC = () => onChoose('counterfeiting');
    const onD = () => onChoose('drugs');
    const onG = () => onChoose('gambling');
    const onF = () => onChoose('fencing');
    cBtn.addEventListener('click', onC);
    dBtn.addEventListener('click', onD);
    gBtn.addEventListener('click', onG);
    fBtn.addEventListener('click', onF);
    container.classList.remove('hidden');
  }

  
  tick() {
    const s = this.state;
    s.time += 1;
    s.dirtyMoney += s.territory;
    s.cleanMoney += s.businesses * 2;
    // Respect increases front legitimacy: +$respectLevel per business per tick
    s.cleanMoney += s.businesses * this.respectLevel();
    s.dirtyMoney += s.illicit * 5;
    let heatTick = s.disagreeableOwners;
    const unpatrolled = s.territory - s.patrol;
    if (unpatrolled > 0) heatTick += unpatrolled;
    if (heatTick > 0) {
      s.heatProgress += heatTick;
      while (s.heatProgress >= 10) {
        s.heat += 1;
        s.heatProgress -= 10;
      }
    } else {
      s.heatProgress = 0;
    }
    // Salaries every 10 seconds
    s.salaryTick = (s.salaryTick || 0) + 1;
    if (s.salaryTick >= 10) {
      s.salaryTick = 0;
      this.paySalaries();
    }
    this.updateUI();
  }

// ---- Card UI Prototype Methods ----
defaultStatsForType(type) {
if (type === 'face') return { face: 2, fist: 1, brain: 1 };
if (type === 'brain') return { face: 1, fist: 1, brain: 2 };
if (type === 'fist') return { face: 1, fist: 2, brain: 1 };
return { face: 1, fist: 1, brain: 1 };
}

_ensureGangsterStats(g) {
if (!g.stats) g.stats = this.defaultStatsForType(g.type);
['face','fist','brain'].forEach(k => { if (typeof g.stats[k] !== 'number') g.stats[k] = 1; });
}

durationWithStat(baseMs, statKey, g) {
const s = (g.stats && g.stats[statKey]) || 0;
const scale = 1 + 0.1 * s; // 10% faster per point
return Math.max(500, Math.floor(baseMs / scale));
}

initCardUI() {
this.cardEls = {
  cardsArea: document.getElementById('cardsArea'),
  actionsArea: document.getElementById('actionsArea'),
  msg: document.getElementById('cardMessages'),
};
if (!this.cardEls.cardsArea || !this.cardEls.actionsArea) return;
this.renderActionBlocks();
this.renderCards();
}

renderCards() {
const area = this.cardEls && this.cardEls.cardsArea;
if (!area) return;
const s = this.state;
area.innerHTML = '';
// Render all gangsters uniformly
s.gangsters.forEach(g => {
  this._ensureGangsterStats(g);
  const el = document.createElement('div');
  el.className = 'card' + (g.busy ? ' busy' : '');
  el.setAttribute('draggable', g.busy ? 'false' : 'true');
  el.dataset.gid = String(g.id);
  const stats = g.stats || { face: 1, fist: 1, brain: 1 };
  const title = g.name ? g.name : `${g.type.toUpperCase()} #${g.id}`;
  el.innerHTML = `<div><strong>${title}</strong></div>
    <div>Heat: ${g.personalHeat || 0}</div>
    <div>F:${stats.fist} Fa:${stats.face} Br:${stats.brain}</div>`;
  el.addEventListener('dragstart', ev => {
    if (g.busy) { ev.preventDefault(); return; }
    ev.dataTransfer.setData('text/plain', String(g.id));
    ev.dataTransfer.effectAllowed = 'move';
  });
  area.appendChild(el);
});
}

renderActionBlocks() {
  const area = this.cardEls && this.cardEls.actionsArea;
  if (!area) return;
  area.innerHTML = '';
  const blocks = ACTIONS;
  blocks.forEach(b => {
    const el = document.createElement('div');
    el.className = 'action-block';
    el.style.overflow = 'hidden';
    el.style.position = 'relative';
    const title = document.createElement('div');
    title.className = 'name';
    title.textContent = b.label;
    title.style.textAlign = 'center';
    title.style.fontWeight = '600';
    title.style.marginBottom = '6px';
    const prog = document.createElement('div');
    prog.className = 'progress progress-stack';
    prog.style.width = '100%';
    prog.style.position = 'relative';
    prog.style.display = 'flex';
    prog.style.flexDirection = 'column';
    prog.style.gap = '4px';
    el.appendChild(title);
    el.appendChild(prog);
    el.addEventListener('dragover', ev => { ev.preventDefault(); el.classList.add('highlight'); });
    el.addEventListener('dragleave', () => el.classList.remove('highlight'));
    el.addEventListener('drop', ev => {
      ev.preventDefault();
      el.classList.remove('highlight');
      const idStr = ev.dataTransfer.getData('text/plain');
      const gid = parseInt(idStr, 10);
      const g = this.state.gangsters.find(x => x.id === gid);
      if (!g || g.busy) return;
      const dur = this.durationWithStat(b.base, b.stat, g);
      const ok = this.executeAction(b, g, prog, dur);
      if (!ok) this._cardMsg('Cannot start action.');
    });
    area.appendChild(el);
  });
}

_cardMsg(txt) { if (this.cardEls && this.cardEls.msg) this.cardEls.msg.textContent = txt; }

executeAction(action, g, progEl, durMs) {
  // Pass-through for legacy handlers while we refactor
  if (action && typeof action.handler === 'function') {
    return action.handler(this, g, progEl, durMs);
  }

  // Prerequisites
  if (action && typeof action.prereq === 'function') {
    const ok = action.prereq(this, g);
    if (!ok) return false;
  }

  // Costs
  if (action && action.cost) {
    if (typeof action.cost === 'function') {
      const ok = action.cost(this, g);
      if (!ok) return false;
    } else if (typeof action.cost === 'object') {
      if (action.cost.money) {
        if (this.totalMoney() < action.cost.money) return false;
        this.spendMoney(action.cost.money);
      }
      if (action.cost.respect) {
        if ((this.state.respect || 0) < action.cost.respect) return false;
        this.state.respect -= action.cost.respect;
      }
      if (action.cost.heat) {
        if ((this.state.heat || 0) < action.cost.heat) return false;
        this.state.heat -= action.cost.heat;
      }
    }
  }

  // Start timed work and apply effect
  return this._startCardWork(g, progEl, durMs, () => {
    if (action && typeof action.effect === 'function') {
      action.effect(this, g);
    }
  });
}

_startCardWork(g, progEl, durMs, onDone) {
  g.busy = true;
  this.renderCards();
  this.runProgress(progEl, durMs, () => {
    try { onDone && onDone(); } finally { g.busy = false; this.renderCards(); this.updateUI(); }
  });
  return true;
}

}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
