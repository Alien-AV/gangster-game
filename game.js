// JavaScript for Gangster Game moved from index.html
import { ACTIONS } from './actions.js';
import { makeCard, makeGangsterCard } from './card.js';
import { Deck } from './deck.js';

export class Game {
  constructor() {
    this.state = {
      time: 0,
      cleanMoney: 10,
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
      inventory: [], // equipment items available to equip
      nextGangId: 1,
      nextEquipId: 1,
      salaryTick: 0,
      discovery: null,
    };
    // Chance that an extortion attempt results in a disagreeable owner (used by actions.js)
    this.DISAGREEABLE_CHANCE = 0.25;
    this.SALARY_PER_10S = { face: 5, fist: 5, brain: 7 };

    this.darkToggle = document.getElementById('darkToggle');
    const storedDark = localStorage.getItem('dark') === '1';
    this.darkToggle.checked = storedDark;
    document.body.classList.toggle('dark-mode', storedDark);
    this.darkToggle.addEventListener('change', e => {
      document.body.classList.toggle('dark-mode', e.target.checked);
      localStorage.setItem('dark', e.target.checked ? '1' : '0');
    });

    // Removed Pay Cops legacy button wiring
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
    (this.state.gangsters || []).forEach(g => { this._ensureGangsterStats(g); if (!Array.isArray(g.equipped)) g.equipped = []; });
    if (!Array.isArray(this.state.inventory)) this.state.inventory = [];
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
    this._equipSelect = { queue: [], active: false };

    // Initialize discovery/deck system
    this.initDiscovery();
    // Initial world paint
    this.renderWorld();

    // Global drag state to prevent world re-render flicker while hovering over droppables
    const self = this;
    document.addEventListener('dragstart', function onAnyDragStart() {
      self._dragCount = (self._dragCount || 0) + 1;
      self._isDragging = true;
    });
    document.addEventListener('dragend', function onAnyDragEnd() {
      self._dragCount = Math.max(0, (self._dragCount || 1) - 1);
      if (!self._dragCount) {
        self._isDragging = false;
        // No special scheduling; renders are immediate elsewhere
      }
    });
  }

  // Actions panel removed; world is the single panel

  // Equipment selection (Procure Equipment)
  showEquipmentSelection(callback) {
    this._equipSelect.queue.push(callback);
    if (!this._equipSelect.active) this._processEquipSelection();
  }

  _processEquipSelection() {
    const mgr = this._equipSelect;
    if (mgr.active) return;
    const next = mgr.queue.shift();
    if (!next) return;
    mgr.active = true;
    const container = document.getElementById('equipChoice');
    const pBtn = document.getElementById('choosePistol');
    const sBtn = document.getElementById('chooseSuitcase');
    const tBtn = document.getElementById('chooseSilkTie');
    const eBtn = document.getElementById('chooseEquipEnforcer');
    const cleanup = () => {
      container.classList.add('hidden');
      pBtn.removeEventListener('click', onP);
      sBtn.removeEventListener('click', onS);
      tBtn.removeEventListener('click', onT);
      eBtn.removeEventListener('click', onE);
      mgr.active = false;
      if (mgr.queue.length) this._processEquipSelection();
    };
    const onChoose = type => { try { next(type); } finally { this.updateUI(); } cleanup(); };
    const onP = () => onChoose('pistol');
    const onS = () => onChoose('suitcase');
    const onT = () => onChoose('silk_tie');
    const onE = () => onChoose('enforcer');
    pBtn.addEventListener('click', onP);
    sBtn.addEventListener('click', onS);
    tBtn.addEventListener('click', onT);
    eBtn.addEventListener('click', onE);
    container.classList.remove('hidden');
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
      gangsters: (s.gangsters || []).map(g => ({ id: g.id, type: g.type, busy: false, personalHeat: g.personalHeat || 0, stats: g.stats || this.defaultStatsForType(g.type), name: g.name, equipped: Array.isArray(g.equipped) ? g.equipped : [] })),
      nextGangId: s.nextGangId,
      inventory: s.inventory || [],
      nextEquipId: s.nextEquipId || 1,
      salaryTick: s.salaryTick,
      discovery: s.discovery || null,
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
      this.state.gangsters = (data.gangsters || []).map(g => ({ id: g.id, type: g.type, name: g.name, busy: false, personalHeat: g.personalHeat || 0, stats: g.stats || this.defaultStatsForType(g.type), equipped: Array.isArray(g.equipped) ? g.equipped : [] }));
      if (!Array.isArray(this.state.inventory)) this.state.inventory = data.inventory || [];
      if (typeof this.state.nextEquipId !== 'number') this.state.nextEquipId = data.nextEquipId || 1;
      // Ensure Boss exists
      if (!this.state.gangsters.some(x => x.type === 'boss')) {
        const bossGang = { id: this.state.nextGangId++, type: 'boss', name: 'Boss', busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } };
        this.state.gangsters.unshift(bossGang);
      }
      // Reset modal queues and refresh UI
      this._gangsterSelect = { queue: [], active: false };
      this._illicitSelect = { queue: [], active: false };
      this._equipSelect = { queue: [], active: false };
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
    // Removed actions panel
    // Ensure Boss exists as a normal gangster with special stats/name
    if (!this.state.gangsters.some(g => g.type === 'boss')) {
      const bossGang = { id: this.state.nextGangId++, type: 'boss', name: 'Boss', busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } };
      this.state.gangsters.unshift(bossGang);
    }
    // Ensure discovery exists
    this.initDiscovery();
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
    const availFronts = Math.max(0, (s.businesses || 0) - (s.illicit || 0));
    const afEl = document.getElementById('availableFronts');
    if (afEl) afEl.textContent = availFronts;
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
    // Card UI only for inventory; gangsters now live in world
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

  // Initialize card UI prototype
  initCardUI() {
    this.cardEls = {
      cardsArea: document.getElementById('cardsArea'),
      msg: document.getElementById('cardMessages'),
    };
    if (!this.cardEls.cardsArea) return;
    this.renderCards();
  }

  // ----- Discovery / Deck System -----
  initDiscovery() {
    if (!this.state.discovery) {
      this.state.discovery = { discovered: [] };
    }
    // Build runtime deck objects (not saved directly)
    this._decks = this._decks || {};
    if (!this._decks.neighborhood) {
      this._decks.neighborhood = new Deck({
        // Guaranteed groups at the start: first the three recruits together, second the local crooks
        start: [ ['recruit_face', 'recruit_fist', 'recruit_brain'], 'small_crooks' ],
        // Shuffled middle content (exclude small_crooks to avoid duplicate instances)
        pool: [
          'corrupt_cop', 'priest',
          'hot_dog_stand', 'bakery', 'diner', 'laundromat', 'pawn_shop', 'newspaper', 'bookmaker',
        ],
        // Guaranteed end
        end: ['city_entrance'],
      });
    }
  }

  drawFromDeck(deckId) {
    const disc = this.state.discovery;
    if (!disc) return;
    const deck = (this._decks || {})[deckId];
    if (!deck) return;
    if (!deck.hasMore()) return;
    const batch = deck.draw(); // array of ids (grouped multi-pull) or null
    if (!batch || !batch.length) return;
    batch.forEach(id => {
      const card = makeCard(id);
      disc.discovered.push(card);
    });
    // Reflect immediately
    this.renderWorld();
    this.updateUI();
  }

  // discoveryMeta replaced by Card registry (makeCard)

  renderWorld() {
    const el = document.getElementById('worldArea');
    if (!el) return;
    el.innerHTML = '';
    // Render all gangsters as normal world cards (no separate zone)
    (this.state.gangsters || []).forEach(g => {
      this._ensureGangsterStats(g);
      const gc = document.createElement('div');
      gc.className = 'card world-card' + (g.busy ? ' busy' : '');
      gc.setAttribute('draggable', g.busy ? 'false' : 'true');
      gc.dataset.gid = String(g.id);
      const gCard = makeGangsterCard({ ...g, stats: { face: this.effectiveStat(g,'face'), fist: this.effectiveStat(g,'fist'), brain: this.effectiveStat(g,'brain') } });
      gc.innerHTML = `<div><strong>${gCard.name}</strong></div>`+
        `<div>${gCard.desc}</div>`+
        `<div>${g.busy ? 'Busy' : 'Drag onto world cards'}</div>`;
      gc.addEventListener('dragstart', ev => {
        if (g.busy) { ev.preventDefault(); return; }
        ev.dataTransfer.setData('text/plain', String(g.id));
        ev.dataTransfer.effectAllowed = 'move';
      });
      el.appendChild(gc);
    });
    // Neighborhood explore card (drop gangster to explore)
    const exploreCard = document.createElement('div');
    exploreCard.className = 'card world-card';
    const d = this.state.discovery;
    const ndeck = (this._decks || {}).neighborhood;
    const disabled = !ndeck || !ndeck.hasMore();
    exploreCard.style.opacity = disabled ? '0.5' : '1.0';
    exploreCard.innerHTML = '<div><strong>Neighborhood</strong></div>' +
      (disabled ? '<div>Deck exhausted</div>' : '<div>Drop a gangster to explore</div>');
    const exploreProg = document.createElement('div');
    exploreProg.className = 'progress';
    exploreCard.appendChild(exploreProg);
    exploreCard.addEventListener('dragover', ev => { if (disabled) return; ev.preventDefault(); exploreCard.classList.add('highlight'); });
    exploreCard.addEventListener('dragleave', () => exploreCard.classList.remove('highlight'));
    exploreCard.addEventListener('drop', ev => {
      if (disabled) return;
      ev.preventDefault();
      exploreCard.classList.remove('highlight');
      const idStr = ev.dataTransfer.getData('text/plain');
      const gid = parseInt(idStr, 10);
      const g = this.state.gangsters.find(x => x.id === gid);
      if (!g || g.busy) return;
      const act = (ACTIONS || []).find(a => a.id === 'actExploreNeighborhood');
      if (!act) return;
      const dur = this.durationWithStat(act.base, act.stat, g);
      const ok = this.executeAction(act, g, exploreProg, dur);
      if (!ok) this._cardMsg('Cannot explore.');
    });
    el.appendChild(exploreCard);

    // Discovered cards list
    const disc = (this.state.discovery && this.state.discovery.discovered) || [];
    disc.forEach(item => {
      if (item.used && !item.reusable) return;
      const c = document.createElement('div');
      c.className = 'card world-card';
      let body = `<div><strong>${item.name || item.title || item.id}</strong></div><div>${item.desc || ''}</div>`;
      // Type-based behaviors to remove per-id duplication
      if (item.type === 'recruit' && !item.used) {
        const price = this.gangsterCost();
        body += `<div style="margin-top:6px;color:#888">Drop any gangster here to hire for $${price}</div>`;
        c.addEventListener('dragover', ev => { ev.preventDefault(); c.classList.add('highlight'); });
        c.addEventListener('dragleave', () => c.classList.remove('highlight'));
        c.addEventListener('drop', ev => {
          ev.preventDefault();
          c.classList.remove('highlight');
          const idStr = ev.dataTransfer.getData('text/plain');
          const gid = parseInt(idStr, 10);
          const src = this.state.gangsters.find(x => x.id === gid);
          if (!src || src.busy) return;
          const costFn = (game) => {
            const cst = game.gangsterCost ? game.gangsterCost() : 0;
            if (game.totalMoney() < cst) return false;
            game.spendMoney(cst);
            return true;
          };
          const act = { id: 'actHireFromDiscovery', label: 'Hire Gangster', stat: 'face', base: 3000,
            cost: costFn,
            effect: (game) => {
              const t = item.data && item.data.type ? item.data.type : 'face';
              const newG = { id: game.state.nextGangId++, type: t, name: undefined, busy: false, personalHeat: 0, stats: game.defaultStatsForType(t) };
              game.state.gangsters.push(newG);
              item.used = true;
            }
          };
          const dur = this.durationWithStat(act.base, act.stat, src);
          const ok = this.executeAction(act, src, prog, dur);
          if (!ok) this._cardMsg('Cannot hire.');
        });
      }
      // Priest: drop to donate (repeatable)
      if (item.type === 'priest') {
        body += `<div style=\"margin-top:6px;color:#888\">Drop a gangster here to Donate</div>`;
        c.addEventListener('dragover', ev => { ev.preventDefault(); c.classList.add('highlight'); });
        c.addEventListener('dragleave', () => c.classList.remove('highlight'));
        c.addEventListener('drop', ev => {
          ev.preventDefault();
          c.classList.remove('highlight');
          const idStr = ev.dataTransfer.getData('text/plain');
          const gid = parseInt(idStr, 10);
          const g = this.state.gangsters.find(x => x.id === gid);
          if (!g || g.busy) return;
          const baseAct = (ACTIONS || []).find(a => a.id === 'actDonate');
          if (!baseAct) return;
          const act = { ...baseAct };
          const dur = this.durationWithStat(act.base, act.stat, g);
          const ok = this.executeAction(act, g, prog, dur);
          if (!ok) this._cardMsg('Cannot donate.');
        });
      }
      // Crooks: recruit into enforcers (Face-based, repeatable)
      if (item.type === 'crooks') {
        body += `<div style=\"margin-top:6px;color:#888\">Drop a Face to recruit local crooks as Enforcers</div>`;
        c.addEventListener('dragover', ev => { ev.preventDefault(); c.classList.add('highlight'); });
        c.addEventListener('dragleave', () => c.classList.remove('highlight'));
        c.addEventListener('drop', ev => {
          ev.preventDefault();
          c.classList.remove('highlight');
          const idStr = ev.dataTransfer.getData('text/plain');
          const gid = parseInt(idStr, 10);
          const g = this.state.gangsters.find(x => x.id === gid);
          if (!g || g.busy) return;
          const baseAct = (ACTIONS || []).find(a => a.id === 'actRecruitEnforcer');
          if (!baseAct) return;
          const act = { ...baseAct, id:'actRecruitCrooks', label:'Recruit Local Crooks', stat:'face',
            effect: (game, gg) => {
              baseAct.effect(game, gg);
              const discArr = (game.state.discovery && game.state.discovery.discovered) || [];
              let ef = discArr.find(x => x.id === 'enforcers');
              if (!ef) { ef = makeCard('enforcers'); discArr.push(ef); }
              ef.data = ef.data || {}; ef.data.count = (ef.data.count || 0) + 1;
            }
          };
          const dur = this.durationWithStat(act.base, act.stat, g);
          const ok = this.executeAction(act, g, prog, dur);
          if (!ok) this._cardMsg('Cannot recruit.');
        });
      }
      // Cop: pay cops (repeatable)
      if (item.type === 'cop') {
        body += `<div style=\"margin-top:6px;color:#888\">Drop a gangster to Pay Off Cops</div>`;
        c.addEventListener('dragover', ev => { ev.preventDefault(); c.classList.add('highlight'); });
        c.addEventListener('dragleave', () => c.classList.remove('highlight'));
        c.addEventListener('drop', ev => {
          ev.preventDefault();
          c.classList.remove('highlight');
          const idStr = ev.dataTransfer.getData('text/plain');
          const gid = parseInt(idStr, 10);
          const g = this.state.gangsters.find(x => x.id === gid);
          if (!g || g.busy) return;
          const baseAct = (ACTIONS || []).find(a => a.id === 'actPayCops');
          if (!baseAct) return;
          const act = { ...baseAct };
          const dur = this.durationWithStat(act.base, act.stat, g);
          const ok = this.executeAction(act, g, prog, dur);
          if (!ok) this._cardMsg('Cannot pay cops.');
        });
      }
      // Businesses: Extort or Raid. After Extort: disable permanently. After Raid: long cooldown.
      if (['hot_dog_stand', 'bakery', 'diner', 'laundromat'].includes(item.id)) {
        body += `<div style="margin-top:6px;color:#888">Drop a gangster to Extort or Raid</div>`;
        c.addEventListener('dragover', ev => { ev.preventDefault(); c.classList.add('highlight'); });
        c.addEventListener('dragleave', () => c.classList.remove('highlight'));
        c.addEventListener('drop', ev => {
          ev.preventDefault();
          c.classList.remove('highlight');
          const idStr = ev.dataTransfer.getData('text/plain');
          const gid = parseInt(idStr, 10);
          const g = this.state.gangsters.find(x => x.id === gid);
          if (!g || g.busy) return;
          const now = this.state.time || 0;
          if (item.extorted) { this._cardMsg('This business has already been extorted.'); return; }
          if (item.cooldownUntil && now < item.cooldownUntil) { this._cardMsg('Business is recovering after a raid.'); return; }
          const face = this.effectiveStat(g, 'face');
          const brain = this.effectiveStat(g, 'brain');
          const fist = this.effectiveStat(g, 'fist');
          const canRaid = !!(this.state.unlockedActions && this.state.unlockedActions.raid);
          const preferRaid = canRaid && (fist >= Math.max(face, brain));
          const actId = preferRaid ? 'actRaid' : 'actExtort';
          const baseAct = (ACTIONS || []).find(a => a.id === actId);
          if (!baseAct) return;
          const act = { ...baseAct, effect: (game, gg) => {
            baseAct.effect(game, gg);
            if (actId === 'actExtort') {
              // Replace this business with the Extorted Businesses counter card in-place
              const discArr = (game.state.discovery && game.state.discovery.discovered) || [];
              const idx = discArr.indexOf(item);
              let xb = discArr.find(x => x.id === 'extorted_business');
              if (!xb) {
                xb = makeCard('extorted_business');
                xb.data = xb.data || {}; xb.data.count = 1;
                if (idx >= 0) discArr.splice(idx, 1, xb); else discArr.push(xb);
              } else {
                // Increment and move the existing counter card to this position
                xb.data = xb.data || {}; xb.data.count = (xb.data.count || 0) + 1;
                if (idx >= 0) {
                  // Remove the business at idx
                  discArr.splice(idx, 1);
                  const oldIdx = discArr.indexOf(xb);
                  if (oldIdx >= 0) {
                    // Remove xb and insert at the original business index
                    discArr.splice(oldIdx, 1);
                    discArr.splice(idx, 0, xb);
                  }
                }
              }
            }
            if (actId === 'actRaid')  { item.cooldownUntil = (game.state.time || 0) + 60; }
          } };
          const dur = this.durationWithStat(act.base, act.stat, g);
          const ok = this.executeAction(act, g, prog, dur);
          if (!ok) this._cardMsg('Cannot act on business.');
        });
      }
      // Counter cards: Enforcers and Extorted Businesses (display counts)
      if (item.id === 'enforcers') {
        const count = (item.data && item.data.count) || 0;
        body = `<div><strong>${item.name}</strong></div><div>Count: ${count}</div>`;
      }
      if (item.id === 'extorted_business') {
        const count = (item.data && item.data.count) || 0;
        body = `<div><strong>${item.name}</strong></div><div>Protection owed: ${count}</div>`;
      }
      // Newspaper: promotional campaign (repeatable)
      if (item.id === 'newspaper') {
        body += `<div style=\"margin-top:6px;color:#888\">Drop a gangster to run a Promo Campaign</div>`;
        c.addEventListener('dragover', ev => { ev.preventDefault(); c.classList.add('highlight'); });
        c.addEventListener('dragleave', () => c.classList.remove('highlight'));
        c.addEventListener('drop', ev => {
          ev.preventDefault();
          c.classList.remove('highlight');
          const idStr = ev.dataTransfer.getData('text/plain');
          const gid = parseInt(idStr, 10);
          const g = this.state.gangsters.find(x => x.id === gid);
          if (!g || g.busy) return;
          const baseAct = (ACTIONS || []).find(a => a.id === 'actPromo');
          if (!baseAct) return;
          const act = { ...baseAct };
          const dur = this.durationWithStat(act.base, act.stat, g);
          const ok = this.executeAction(act, g, prog, dur);
          if (!ok) this._cardMsg('Cannot run promo.');
        });
      }
      // Pawn Shop: procure equipment (repeatable)
      if (item.id === 'pawn_shop') {
        body += `<div style=\"margin-top:6px;color:#888\">Drop a gangster to Procure Equipment</div>`;
        c.addEventListener('dragover', ev => { ev.preventDefault(); c.classList.add('highlight'); });
        c.addEventListener('dragleave', () => c.classList.remove('highlight'));
        c.addEventListener('drop', ev => {
          ev.preventDefault();
          c.classList.remove('highlight');
          const idStr = ev.dataTransfer.getData('text/plain');
          const gid = parseInt(idStr, 10);
          const g = this.state.gangsters.find(x => x.id === gid);
          if (!g || g.busy) return;
          const baseAct = (ACTIONS || []).find(a => a.id === 'actProcureEquipment');
          if (!baseAct) return;
          const act = { ...baseAct };
          const dur = this.durationWithStat(act.base, act.stat, g);
          const ok = this.executeAction(act, g, prog, dur);
          if (!ok) this._cardMsg('Cannot procure equipment.');
        });
      }
      // Bookmaker: launder money (repeatable)
      if (item.id === 'bookmaker') {
        body += `<div style=\"margin-top:6px;color:#888\">Drop a Brain to Launder $100</div>`;
        c.addEventListener('dragover', ev => { ev.preventDefault(); c.classList.add('highlight'); });
        c.addEventListener('dragleave', () => c.classList.remove('highlight'));
        c.addEventListener('drop', ev => {
          ev.preventDefault();
          c.classList.remove('highlight');
          const idStr = ev.dataTransfer.getData('text/plain');
          const gid = parseInt(idStr, 10);
          const g = this.state.gangsters.find(x => x.id === gid);
          if (!g || g.busy) return;
          const baseAct = (ACTIONS || []).find(a => a.id === 'actLaunder');
          if (!baseAct) return;
          const act = { ...baseAct };
          const dur = this.durationWithStat(act.base, act.stat, g);
          const ok = this.executeAction(act, g, prog, dur);
          if (!ok) this._cardMsg('Cannot launder.');
        });
      }
      c.innerHTML = body;
      // Per-card progress bar
      const prog = document.createElement('div');
      prog.className = 'progress';
      c.appendChild(prog);
      // Show disabled/cooldown state
      if (['hot_dog_stand','bakery','diner','laundromat'].includes(item.id)) {
        const now = this.state.time || 0;
        if (item.extorted) {
          const badge = document.createElement('div'); badge.style.color = '#f88'; badge.textContent = 'Disabled after extortion'; c.appendChild(badge);
          item._badgeEl = badge;
        } else if (item.cooldownUntil && now < item.cooldownUntil) {
          const remain = item.cooldownUntil - now;
          const badge = document.createElement('div'); badge.style.color = '#ff8'; badge.textContent = `Recovering (${remain}s)`; c.appendChild(badge);
          item._badgeEl = badge;
        }
      }
      el.appendChild(c);
    });
  }

  renderCards() {
    const area = this.cardEls && this.cardEls.cardsArea;
    if (!area) return;
    const s = this.state;
    area.innerHTML = '';
    // Do not render gangsters here; they live in the world panel now

    // Render equipment inventory as cards
    (s.inventory || []).forEach(it => {
      const el = document.createElement('div');
      el.className = 'card equip-card';
      el.setAttribute('draggable', 'true');
      el.dataset.eid = String(it.id);
      const bonus = this._equipBonusFor(it);
      const bonusTxt = `+F:${bonus.fist} +Fa:${bonus.face} +Br:${bonus.brain} +M:${bonus.meat}`;
      const label = ({pistol:'Pistol', suitcase:'Suitcase', silk_tie:'Silk Tie', enforcer:'Enforcer'})[it.type] || it.type;
      el.innerHTML = `<div><strong>${label}</strong></div><div>${bonusTxt}</div><div>Drag onto gangster to equip</div>`;
      el.addEventListener('dragstart', ev => {
        ev.dataTransfer.setData('text/plain', 'equip:' + String(it.id));
        ev.dataTransfer.effectAllowed = 'move';
      });
      area.appendChild(el);
    });
  }

  // Actions panel removed

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
    // Suspend world re-render so progress elements persist during work
    this._suspendWorldRender = (this._suspendWorldRender || 0) + 1;
    this.renderCards();
    this.runProgress(progEl, durMs, () => {
      try {
        onDone && onDone();
      } finally {
        g.busy = false;
        // Resume world render if this is the last active work
        this._suspendWorldRender = Math.max(0, (this._suspendWorldRender || 1) - 1);
        this.renderCards();
        this.renderWorld();
        this.updateUI();
      }
    });
    return true;
  }

  defaultStatsForType(type) {
    if (type === 'face') return { face: 2, fist: 1, brain: 1, meat: 0 };
    if (type === 'brain') return { face: 1, fist: 1, brain: 2, meat: 0 };
    if (type === 'fist') return { face: 1, fist: 2, brain: 1, meat: 0 };
    if (type === 'boss') return { face: 2, fist: 2, brain: 2, meat: 0 };
    return { face: 1, fist: 1, brain: 1, meat: 0 };
  }

  _ensureGangsterStats(g) {
    if (!g.stats) g.stats = this.defaultStatsForType(g.type);
    ['face','fist','brain','meat'].forEach(k => { if (typeof g.stats[k] !== 'number') g.stats[k] = (k==='meat'?0:1); });
    if (!Array.isArray(g.equipped)) g.equipped = [];
  }

  _equipBonusFor(item) {
    // Returns {face,fist,brain,meat} bonus for an equipment item
    switch (item.type) {
      case 'pistol': return { face: 0, fist: 1, brain: 0, meat: 0 };
      case 'suitcase': return { face: 0, fist: 0, brain: 1, meat: 0 };
      case 'silk_tie': return { face: 1, fist: 0, brain: 0, meat: 0 };
      case 'enforcer': return { face: 0, fist: 0, brain: 0, meat: 1 };
      default: return { face: 0, fist: 0, brain: 0, meat: 0 };
    }
  }

  effectiveStat(g, key) {
    this._ensureGangsterStats(g);
    const base = (g.stats && typeof g.stats[key] === 'number') ? g.stats[key] : 0;
    const bonus = (g.equipped || []).reduce((acc, it) => acc + (this._equipBonusFor(it)[key] || 0), 0);
    return base + bonus;
  }

  durationWithStat(baseMs, statKey, g) {
    const s = this.effectiveStat(g, statKey) || 0;
    const scale = 1 + 0.1 * s; // 10% faster per point
    return Math.max(500, Math.floor(baseMs / scale));
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
    // Update cooldown badges in-place to avoid full world re-render flicker
    const disc = (this.state.discovery && this.state.discovery.discovered) || [];
    const now = s.time || 0;
    disc.forEach(item => {
      if (!['hot_dog_stand','bakery','diner','laundromat'].includes(item.id)) return;
      if (item.extorted) return; // permanently disabled; static badge
      if (item.cooldownUntil && now < item.cooldownUntil) {
        const remain = item.cooldownUntil - now;
        if (item._badgeEl) item._badgeEl.textContent = `Recovering (${remain}s)`;
      } else if (item.cooldownUntil && now >= item.cooldownUntil) {
        // Cooldown ended; remove badge and mark world dirty for a clean state
        item.cooldownUntil = 0;
        if (item._badgeEl) { try { item._badgeEl.remove(); } catch(e){} item._badgeEl = null; }
        this.renderWorld();
      }
    });
    this.updateUI();
  }
  
  executeAction(action, g, progEl, durMs) {
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

}
