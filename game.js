// JavaScript for Gangster Game moved from index.html
import { ACTIONS } from './actions.js';
import { makeCard, makeGangsterCard, CARD_BEHAVIORS, renderWorldCard, getCardInfo, computeCardDynamic } from './card.js';
import { Deck } from './deck.js';
import { startTimer, startCountdown } from './progress-ring.js';

// behaviors and renderer moved to card.js

export class Game {
  constructor() {
    this.state = {
      time: 0,
      cleanMoney: 100,
      dirtyMoney: 0,
      patrol: 0,
      extortedBusinesses: 0,
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
      table: null,
      // Placeholder flow stats per minute (clean): we'll compute presentation only for now
      flow: {
        perMinuteTotal: 0,
        breakdown: [], // e.g., [{label:'+100 from protection', value: 100}, {label:'-50 from gangsters', value:-50}]
      },
    };
    // Chance that an extortion attempt results in a disagreeable owner (used by actions.js)
    this.DISAGREEABLE_CHANCE = 0.25;
    this.SALARY_PER_10S = { face: 50, fist: 50, brain: 70 };

    

    // Removed Pay Cops button wiring
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
    // Ensure Boss exists as a normal gangster with special stats/name
    if (!this.state.gangsters.some(g => g.type === 'boss')) {
      const bossGang = { id: this.state.nextGangId++, type: 'boss', name: 'Boss', busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } };
      this.state.gangsters.unshift(bossGang);
    }

    // Initialize message UI
    this.initCardUI();
    this._initLog();
    this.interval = setInterval(() => this.tick(), 1000);

    // Queued selection managers to avoid overlapping popups
    this._gangsterSelect = { queue: [], active: false };
    this._illicitSelect = { queue: [], active: false };
    this._equipSelect = { queue: [], active: false };
    this._actionSelect = { queue: [], active: false };

    // Initialize world table / deck system
    this.initTable();
    // DOM caches for reconciliation and initial world paint
    this._dom = { cardByUid: new Map(), gangsterById: new Map(), exploreWrap: null };
    this.reconcileWorld && this.reconcileWorld();

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
    // Progress rings are managed per-item; no global animator
  }

  // Actions panel removed; world is the single panel

  saveState() {
    const data = this.serializeState();
    localStorage.setItem('gameState', JSON.stringify(data));
  }

  scheduleSave(delayMs = 1500) {
    // Coalesce frequent UI saves; write at most every delayMs
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      try { this.saveState(); } catch(e){}
    }, delayMs);
  }

  serializeState() {
    const s = this.state;
    return {
      time: s.time,
      cleanMoney: s.cleanMoney,
      dirtyMoney: s.dirtyMoney,
      patrol: s.patrol,
      extortedBusinesses: s.extortedBusinesses,
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
      salaryTick: s.salaryTick,
      table: s.table || null,
      // Persist deck states (neighborhood only for now)
      decks: (() => {
        const res = {};
        const d = this._decks || {};
        const n = d.neighborhood;
        if (n) {
          res.neighborhood = {
            start: Array.isArray(n._start) ? n._start.slice() : [],
            middle: Array.isArray(n._middle) ? n._middle.slice() : [],
            end: Array.isArray(n._end) ? n._end.slice() : [],
          };
        }
        return res;
      })(),
    };
  }

  slotKey(n) { return `gameState_slot${n}`; }

  saveToSlot(n) {
    try {
      const data = this.serializeState();
      localStorage.setItem(this.slotKey(n), JSON.stringify(data));
      this._cardMsg(`Saved to slot ${n}`);
    } catch (e) {
      console.error('Save failed', e);
      this._cardMsg('Save failed');
    }
  }

  loadFromSlot(n) {
    const raw = localStorage.getItem(this.slotKey(n));
    if (!raw) {
      this._cardMsg(`No save found in slot ${n}`);
      return;
    }
    try {
      const data = JSON.parse(raw);
      console.debug('[LoadSlot] parsed data', data);
      Object.assign(this.state, data);
      // Back-compat: migrate legacy 'territory' to 'extortedBusinesses'
      if (this.state.extortedBusinesses == null && typeof data.territory === 'number') {
        this.state.extortedBusinesses = data.territory;
        delete this.state.territory;
      }
      this.state.gangsters = (data.gangsters || []).map(g => ({ id: g.id, type: g.type, name: g.name, busy: false, personalHeat: g.personalHeat || 0, stats: g.stats || this.defaultStatsForType(g.type), equipped: Array.isArray(g.equipped) ? g.equipped : [] }));
      // Ensure Boss exists
      if (!this.state.gangsters.some(x => x.type === 'boss')) {
        const bossGang = { id: this.state.nextGangId++, type: 'boss', name: 'Boss', busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } };
        this.state.gangsters.unshift(bossGang);
      }
      // Reset modal queues and refresh UI
      this._gangsterSelect = { queue: [], active: false };
      this._illicitSelect = { queue: [], active: false };
      this._equipSelect = { queue: [], active: false };
      console.debug('[LoadSlot] state:', this.state);
      // Ensure table/deck and UI refresh after load
      // Force rebuild decks from saved snapshot
      this._decks = {};
      this.initTable();
      this.renderWorld();
      this.updateUI();
      this._cardMsg(`Loaded slot ${n}`);
    } catch (e) {
      console.error('Load failed', e);
      this._cardMsg('Load failed');
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
    // Removed actions panel
    // Ensure Boss exists as a normal gangster with special stats/name
    if (!this.state.gangsters.some(g => g.type === 'boss')) {
      const bossGang = { id: this.state.nextGangId++, type: 'boss', name: 'Boss', busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } };
      this.state.gangsters.unshift(bossGang);
    }
    // Ensure table exists
    this.initTable();
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
    return Math.max(10, 50 - level * 10);
  }

  enforcerSalaryPer10s() { return 0; }

  gangsterCost() {
    const level = this.fearLevel();
    return Math.max(50, 200 - level * 20);
  }

  businessCost() {
    const base = 1000;
    const discount = this.fearLevel() * 50; // $50 off per fear level
    return Math.max(500, base - discount);
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
    const timeEl = document.getElementById('time'); if (timeEl) timeEl.textContent = s.time;
    const cmEl = document.getElementById('cleanMoney'); if (cmEl) cmEl.textContent = s.cleanMoney;
    const dmEl = document.getElementById('dirtyMoney'); if (dmEl) dmEl.textContent = s.dirtyMoney;
    const patrolEl = document.getElementById('patrol'); if (patrolEl) patrolEl.textContent = s.patrol;
    const extEl = document.getElementById('extortedBusinesses'); if (extEl) extEl.textContent = s.extortedBusinesses;
    const heatEl = document.getElementById('heat'); if (heatEl) heatEl.textContent = s.heat;
    const heatBar = document.getElementById('heatProgressBar'); if (heatBar) heatBar.style.width = (s.heatProgress * 10) + '%';
    const disEl = document.getElementById('disagreeableOwners'); if (disEl) disEl.textContent = s.disagreeableOwners;
    const fearEl = document.getElementById('fear'); if (fearEl) fearEl.textContent = s.fear;
    const rl = this.fearLevel();
    const bCost = this.businessCost();
    const respEl = document.getElementById('respect'); if (respEl) respEl.textContent = s.respect;
    const fearBonusEl = document.getElementById('fearBonus');
    if (fearBonusEl) fearBonusEl.textContent = rl > 0 ? `Business cost $${bCost}` : 'None';
    const rL = this.respectLevel();
    const respectBonusEl = document.getElementById('respectBonus');
    if (respectBonusEl) respectBonusEl.textContent = rL > 0 ? `Fronts +$${rL * 10} clean/s each; Laundering +${rL * 10}% yield` : 'None';
    const busEl = document.getElementById('businesses'); if (busEl) busEl.textContent = s.businesses;
    const availFronts = Math.max(0, (s.businesses || 0) - (s.illicit || 0));
    const afEl = document.getElementById('availableFronts');
    if (afEl) afEl.textContent = availFronts;
    const faces = s.gangsters.filter(g => g.type === 'face').length;
    const fists = s.gangsters.filter(g => g.type === 'fist').length;
    const brains = s.gangsters.filter(g => g.type === 'brain').length;
    const facesEl = document.getElementById('faces'); if (facesEl) facesEl.textContent = faces;
    const fistsEl = document.getElementById('fists'); if (fistsEl) fistsEl.textContent = fists;
    const brainsEl = document.getElementById('brains'); if (brainsEl) brainsEl.textContent = brains;
    const illEl = document.getElementById('illicit'); if (illEl) illEl.textContent = s.illicit;
    const cEl = document.getElementById('counterfeitingCount'); if (cEl) cEl.textContent = s.illicitCounts.counterfeiting;
    const dEl = document.getElementById('drugCount'); if (dEl) dEl.textContent = s.illicitCounts.drugs;
    const gEl = document.getElementById('gamblingCount'); if (gEl) gEl.textContent = s.illicitCounts.gambling;
    const fEl = document.getElementById('fencingCount'); if (fEl) fEl.textContent = s.illicitCounts.fencing;

    // Flow display (placeholder math; real data later)
    this._updateFlowDisplay();

    // Attach rich tooltips for Respect and Fear (bind once, compute on hover)
    const respectElForTip = document.getElementById('respect');
    if (respectElForTip && respectElForTip.parentElement) {
      this.showTooltip(respectElForTip.parentElement, () => this.buildRespectTooltip());
    }
    const fearElForTip = document.getElementById('fear');
    if (fearElForTip && fearElForTip.parentElement) {
      this.showTooltip(fearElForTip.parentElement, () => this.buildFearTooltip());
    }
    // All UI renders via world/table now; throttle persistence
    this.scheduleSave();
  }

  runProgress(container, duration, callback) {
    if (!container) {
      console.warn('[runProgress] missing container');
      if (typeof callback === 'function') callback();
      this.updateUI();
      return;
    }
    // For ring-only mode, we skip creating/using a bottom progress bar
    const isCard = container.classList && container.classList.contains('world-card');
    const isWrap = container.classList && container.classList.contains('ring-wrap');
    const stacked = !isCard && container.classList.contains('progress-stack');
    let bar = null;
    if (!isCard && !isWrap) {
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
    }
    startTimer(container, {
      durationMs: duration,
      mode: 'action',
      showBadge: true,
      onTick: (p) => { if (bar) { try { bar.style.width = (p * 100) + '%'; } catch(e){} } },
      onDone: () => {
        if (bar) {
          if (stacked) {
            try { bar.remove(); } catch(e){}
          } else {
            try { container.classList.add('hidden'); } catch(e){}
            try { bar.style.width = '100%'; } catch(e){}
          }
        }
        try { callback && callback(); } finally { this.updateUI(); }
      }
    });
  }

  // Generic small tooltip builder
  buildSimpleTooltip(title, rows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const body = safeRows.map(([label, val]) => `<div class=\"tip-row\"><div>${label}</div><div>${val}</div></div>`).join('');
    return `<h4>${title}</h4>${body}`;
  }

  buildRespectTooltip() {
    const lvl = this.respectLevel();
    const perFrontPerSec = lvl * 10;
    const launderingBoostPct = lvl * 10;
    return this.buildSimpleTooltip('Respect Effects', [
      ['Level', String(lvl)],
      ['Fronts', `+${perFrontPerSec}$/s each`],
      ['Laundering', `+${launderingBoostPct}% yield`],
    ]);
  }

  buildFearTooltip() {
    const lvl = this.fearLevel();
    const businessPrice = this.businessCost();
    const enforcerPrice = this.enforcerCost();
    const speedPct = Math.min(50, lvl * 10);
    return this.buildSimpleTooltip('Fear Effects', [
      ['Level', String(lvl)],
      ['Business cost', `$${businessPrice}`],
      ['Enforcer cost', `$${enforcerPrice}`],
      ['Action speed', `${speedPct}% faster (extort/raid)`],
    ]);
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

  showActionSelection(options, callback) {
    this._actionSelect.queue.push({ options, callback });
    if (!this._actionSelect.active) this._processActionSelection();
  }

  _processActionSelection() {
    const mgr = this._actionSelect;
    if (mgr.active) return;
    const item = mgr.queue.shift();
    if (!item) return;
    mgr.active = true;
    const container = document.getElementById('actionChoice');
    const buttonsHost = document.getElementById('actionChoiceButtons');
    // Clear previous dynamic buttons
    buttonsHost.innerHTML = '';
    const cleanup = () => {
      container.classList.add('hidden');
      // Remove all listeners by replacing content
      buttonsHost.innerHTML = '';
      mgr.active = false;
      if (mgr.queue.length) this._processActionSelection();
    };
    const onChoose = (choiceId) => {
      cleanup();
      try { item.callback(choiceId); } finally { this.updateUI(); }
    };
    // Build a button per option
    (item.options || []).forEach(opt => {
      const b = document.createElement('button');
      b.textContent = opt.label || opt.id;
      b.addEventListener('click', () => onChoose(opt.id));
      buttonsHost.appendChild(b);
    });
    container.classList.remove('hidden');
  }

  // Initialize card UI prototype
  initCardUI() {
    this.cardEls = {
      msg: document.getElementById('cardMessages'),
    };
  }

  _initLog() {
    const msgEl = document.getElementById('cardMessages');
    if (!msgEl) return;
    // Ensure it's a list container
    if (!msgEl.classList.contains('log-window')) {
      msgEl.classList.add('log-window');
    }
  }

  // ----- World Table / Deck System -----
  initTable() {
    if (!this.state.table || !Array.isArray(this.state.table.cards)) {
      this.state.table = { cards: [] };
    }
    // Build runtime deck objects (not saved directly)
    this._decks = this._decks || {};
    if (!this._decks.neighborhood) {
      const snap = (this.state.decks && this.state.decks.neighborhood) || null;
      if (snap) {
        const d = new Deck({});
        d._start = Array.isArray(snap.start) ? snap.start.slice() : [];
        d._middle = Array.isArray(snap.middle) ? snap.middle.slice() : [];
        d._end = Array.isArray(snap.end) ? snap.end.slice() : [];
        this._decks.neighborhood = d;
      } else {
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
  }

  // ---- Targeted DOM ops (incremental) ----
  _worldContainer() {
    return document.getElementById('worldArea');
  }

  _ensureExploreWrap() {
    if (this._dom.exploreWrap) return this._dom.exploreWrap;
    const wrap = document.createElement('div'); wrap.className = 'ring-wrap';
    const exploreCard = document.createElement('div'); exploreCard.className = 'card world-card';
    exploreCard.innerHTML = `
      <div class="world-card-title">Neighborhood</div>
      <div class="world-card-art">
        <img class="world-card-artImg" src="images/neighborhood.png" alt="Neighborhood">
        <div class="world-card-artEmoji hidden">🏙️</div>
      </div>
      <div class="world-card-desc"><p class="world-card-descText">Your turf. Discover rackets, marks, and useful connections.</p></div>
    `;
    exploreCard.removeAttribute('title');
    const img = exploreCard.querySelector('.world-card-artImg');
    const emojiEl = exploreCard.querySelector('.world-card-artEmoji');
    if (img) img.addEventListener('error', () => { if (emojiEl) emojiEl.classList.remove('hidden'); img.remove(); });
    const ndeck = (this._decks || {}).neighborhood; const disabled = !ndeck || !ndeck.hasMore();
    if (window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      exploreCard.addEventListener('mouseenter', () => this._showInfoPanel({ title: 'Neighborhood', stats: '', desc: 'Your turf. Discover rackets, marks, and useful connections.', hint: disabled ? 'Deck exhausted' : 'Drop a gangster to explore' }));
      exploreCard.addEventListener('mouseleave', () => this._hideInfoPanel());
    }
    exploreCard.addEventListener('click', () => this._showInfoPanel({ title: 'Neighborhood', stats: '', desc: 'Your turf. Discover rackets, marks, and useful connections.', hint: disabled ? 'Deck exhausted' : 'Drop a gangster to explore' }));
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
      const ok = this.executeAction(act, g, exploreCard, dur);
      if (!ok) this._cardMsg('Cannot explore.');
    });
    wrap.appendChild(exploreCard);
    this._dom.exploreWrap = wrap;
    return wrap;
  }

  ensureGangsterNode(g) {
    const container = this._worldContainer();
    if (!container) return null;
    let wrap = this._dom.gangsterById.get(g.id);
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.className = 'ring-wrap';
    const gc = document.createElement('div');
    gc.className = 'card world-card';
    gc.dataset.gid = String(g.id);
    const gCard = makeGangsterCard({ ...g, stats: { face: this.effectiveStat(g,'face'), fist: this.effectiveStat(g,'fist'), brain: this.effectiveStat(g,'brain') } });
    const artEmoji = g.type === 'boss' ? '👑' : (g.type === 'face' ? '🗣️' : (g.type === 'fist' ? '🥊' : '🧠'));
    const artImg = g.type === 'boss' ? 'images/boss.png' : (g.type === 'face' ? 'images/face.png' : (g.type === 'fist' ? 'images/fist.png' : (g.type === 'brain' ? 'images/brain.png' : null)));
    const gDesc = (
      g.type === 'boss' ? 'Crew leader. Calls the shots and keeps heat manageable.' :
      g.type === 'face' ? 'Smooth talker. Negotiates, distracts, and greases palms.' :
      g.type === 'fist' ? 'Bruiser. Raids and intimidates when needed.' :
      g.type === 'brain' ? 'A planner who knows the angles.' :
      ''
    );
    gc.innerHTML = `
      <div class="world-card-title">${gCard.name}</div>
      <div class="world-card-art">
        ${artImg ? `<img class=\"world-card-artImg\" src=\"${artImg}\" alt=\"${gCard.name}\">` : ''}
        <div class="world-card-artEmoji${artImg ? ' hidden' : ''}">${artEmoji}</div>
      </div>
      <div class="world-card-desc"><p class="world-card-descText">${gDesc || '&nbsp;'}</p></div>
    `;
    gc.removeAttribute('title');
    if (artImg) {
      const img = gc.querySelector('.world-card-artImg');
      const emojiEl = gc.querySelector('.world-card-artEmoji');
      if (img) img.addEventListener('error', () => { if (emojiEl) emojiEl.classList.remove('hidden'); img.remove(); });
    }
    gc.addEventListener('dragstart', ev => {
      if (g.busy) { ev.preventDefault(); return; }
      ev.dataTransfer.setData('text/plain', String(g.id));
      ev.dataTransfer.effectAllowed = 'move';
    });
    gc.addEventListener('mousedown', (ev) => {
      const target = ev.target;
      if (target && target.closest && target.closest('.world-card-art')) {
        gc.setAttribute('draggable', g.busy ? 'false' : 'true');
      }
    });
    const showGangInfo = () => this._showInfoPanel({
      title: gCard.name,
      stats: `Fist:${g.stats.fist} Face:${g.stats.face} Brain:${g.stats.brain} Meat:${g.stats.meat ?? 1}`,
      desc: gDesc,
      hint: g.busy ? 'Busy' : 'Drag onto table cards',
    });
    if (window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      gc.addEventListener('mouseenter', showGangInfo);
      gc.addEventListener('mouseleave', () => this._hideInfoPanel());
    }
    gc.addEventListener('click', showGangInfo);
    if (g.busy) gc.classList.add('busy');
    wrap.appendChild(gc);
    this._dom.gangsterById.set(g.id, wrap);
    // Insert before explore + table cards
    const offset = (this.state.gangsters || []).findIndex(x => x.id === g.id);
    const node = container.childNodes[offset] || null;
    container.insertBefore(wrap, node);
    return wrap;
  }

  replaceCard(oldItem, newItem, index) {
    if (oldItem && oldItem.uid) this.removeCardByUid(oldItem.uid);
    return this.ensureCardNode(newItem, index);
  }

  ensureCardNode(item, index) {
    if (!item.uid) item.uid = 'c_' + Math.random().toString(36).slice(2);
    let wrap = this._dom.cardByUid.get(item.uid);
    if (!wrap) {
      const rendered = renderWorldCard(this, item);
      wrap = rendered.wrap;
      const card = rendered.card;
      const behavior = CARD_BEHAVIORS[item.type];
      card.addEventListener('dragover', ev => { ev.preventDefault(); card.classList.add('highlight'); });
      card.addEventListener('dragleave', () => card.classList.remove('highlight'));
      card.addEventListener('drop', ev => {
        ev.preventDefault(); card.classList.remove('highlight');
        const idStr = ev.dataTransfer.getData('text/plain');
        const gid = parseInt(idStr, 10);
        const g = this.state.gangsters.find(x => x.id === gid);
        if (!g || g.busy) return;
        const handler = (behavior && typeof behavior.onDrop === 'function') ? (gg => behavior.onDrop(this, item, gg, card)) : (gg => this._handleGenericOnDrop(item, gg, card));
        handler(g);
      });
      const buildInfo = () => getCardInfo(this, item);
      if (window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
        card.addEventListener('mouseenter', () => this._showInfoPanel(buildInfo()));
        card.addEventListener('mouseleave', () => this._hideInfoPanel());
      }
      card.addEventListener('click', () => this._showInfoPanel(buildInfo()));
      this._dom.cardByUid.set(item.uid, wrap);
      // Apply onCreate hook and then activate timers for items created now
      this._applyOnCreate(item);
      this._activateTimersForItem(item, wrap);
    }
    // Update dynamic text if available
    try {
      if (item._dynEl) item._dynEl.textContent = computeCardDynamic(this, item) || '';
      else {
        const dyn = wrap.querySelector('.world-card-descDyn');
        if (dyn) dyn.textContent = computeCardDynamic(this, item) || '';
      }
    } catch(e){}
    // Insert/reposition at appropriate position: [gangsters][explore][cards]
    const container = this._worldContainer();
    if (!container) return wrap;
    this._ensureExploreWrap();
    if (typeof index === 'number') {
      const offset = (this.state.gangsters || []).length + 1; // +1 explore
      const desiredPosition = offset + index;
      const current = container.childNodes[desiredPosition];
      if (container.childNodes[desiredPosition] !== wrap) {
        container.insertBefore(wrap, current || null);
      }
    }
    return wrap;
  }

  removeCardByUid(uid) {
    const wrap = this._dom.cardByUid.get(uid);
    if (wrap) {
      try { wrap.remove(); } catch(e){}
      this._dom.cardByUid.delete(uid);
    }
  }

  updateCardDynamic(item) {
    try {
      if (item && item._dynEl) {
        item._dynEl.textContent = computeCardDynamic(this, item) || '';
        return;
      }
      if (item && item.uid) {
        const wrap = this._dom.cardByUid.get(item.uid);
        if (wrap) {
          const dyn = wrap.querySelector('.world-card-descDyn');
          if (dyn) dyn.textContent = computeCardDynamic(this, item) || '';
        }
      }
    } catch(e){}
  }

  // Incremental reconciler for world and gangster cards
  reconcileWorld() {
    const container = document.getElementById('worldArea');
    if (!container) return;
    const desiredNodes = [];

    // 1) Reconcile gangster cards
    const gangsterIds = new Set();
    (this.state.gangsters || []).forEach(g => {
      gangsterIds.add(g.id);
      let wrap = this._dom.gangsterById.get(g.id);
      if (!wrap) {
        wrap = document.createElement('div');
      wrap.className = 'ring-wrap';
      const gc = document.createElement('div');
        gc.className = 'card world-card';
      gc.dataset.gid = String(g.id);
      const gCard = makeGangsterCard({ ...g, stats: { face: this.effectiveStat(g,'face'), fist: this.effectiveStat(g,'fist'), brain: this.effectiveStat(g,'brain') } });
      const artEmoji = g.type === 'boss' ? '👑' : (g.type === 'face' ? '🗣️' : (g.type === 'fist' ? '🥊' : '🧠'));
        const artImg = g.type === 'boss' ? 'images/boss.png' : (g.type === 'face' ? 'images/face.png' : (g.type === 'fist' ? 'images/fist.png' : (g.type === 'brain' ? 'images/brain.png' : null)));
      const gDesc = (
        g.type === 'boss' ? 'Crew leader. Calls the shots and keeps heat manageable.' :
        g.type === 'face' ? 'Smooth talker. Negotiates, distracts, and greases palms.' :
        g.type === 'fist' ? 'Bruiser. Raids and intimidates when needed.' :
        g.type === 'brain' ? 'A planner who knows the angles.' :
        ''
      );
      gc.innerHTML = `
        <div class="world-card-title">${gCard.name}</div>
        <div class="world-card-art">
          ${artImg ? `<img class="world-card-artImg" src="${artImg}" alt="${gCard.name}">` : ''}
          <div class="world-card-artEmoji${artImg ? ' hidden' : ''}">${artEmoji}</div>
        </div>
        <div class="world-card-desc"><p class="world-card-descText">${gDesc || '&nbsp;'}</p></div>
      `;
      gc.removeAttribute('title');
      if (artImg) {
        const img = gc.querySelector('.world-card-artImg');
        const emojiEl = gc.querySelector('.world-card-artEmoji');
        if (img) img.addEventListener('error', () => { if (emojiEl) emojiEl.classList.remove('hidden'); img.remove(); });
      }
      gc.addEventListener('dragstart', ev => {
        if (g.busy) { ev.preventDefault(); return; }
        ev.dataTransfer.setData('text/plain', String(g.id));
        ev.dataTransfer.effectAllowed = 'move';
      });
      gc.addEventListener('mousedown', (ev) => {
        const target = ev.target;
        if (target && target.closest && target.closest('.world-card-art')) {
          gc.setAttribute('draggable', g.busy ? 'false' : 'true');
        }
      });
        const showGangInfo = () => this._showInfoPanel({
          title: gCard.name,
          stats: `Fist:${g.stats.fist} Face:${g.stats.face} Brain:${g.stats.brain} Meat:${g.stats.meat ?? 1}`,
          desc: gDesc,
          hint: g.busy ? 'Busy' : 'Drag onto table cards',
        });
        if (window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
          gc.addEventListener('mouseenter', showGangInfo);
        gc.addEventListener('mouseleave', () => this._hideInfoPanel());
      }
        gc.addEventListener('click', showGangInfo);
        if (g.busy) gc.classList.add('busy'); else gc.classList.remove('busy');
      wrap.appendChild(gc);
        this._dom.gangsterById.set(g.id, wrap);
      } else {
        const gc = wrap.querySelector('.world-card');
        if (gc) {
          if (g.busy) gc.classList.add('busy'); else gc.classList.remove('busy');
        }
      }
      desiredNodes.push(this._dom.gangsterById.get(g.id));
    });
    for (const [gid, wrap] of Array.from(this._dom.gangsterById.entries())) {
      if (!gangsterIds.has(gid)) {
        try { wrap.remove(); } catch(e){}
        this._dom.gangsterById.delete(gid);
      }
    }

    // 2) Ensure Neighborhood explore card exists and updated
    const ndeck = (this._decks || {}).neighborhood;
    const disabled = !ndeck || !ndeck.hasMore();
    if (!this._dom.exploreWrap) {
      const wrap = document.createElement('div'); wrap.className = 'ring-wrap';
      const exploreCard = document.createElement('div'); exploreCard.className = 'card world-card';
    exploreCard.innerHTML = `
      <div class="world-card-title">Neighborhood</div>
      <div class="world-card-art">
          <img class="world-card-artImg" src="images/neighborhood.png" alt="Neighborhood">
        <div class="world-card-artEmoji hidden">🏙️</div>
      </div>
      <div class="world-card-desc"><p class="world-card-descText">Your turf. Discover rackets, marks, and useful connections.</p></div>
    `;
    exploreCard.removeAttribute('title');
      const img = exploreCard.querySelector('.world-card-artImg');
      const emojiEl = exploreCard.querySelector('.world-card-artEmoji');
      if (img) img.addEventListener('error', () => { if (emojiEl) emojiEl.classList.remove('hidden'); img.remove(); });
    if (window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
        exploreCard.addEventListener('mouseenter', () => this._showInfoPanel({ title: 'Neighborhood', stats: '', desc: 'Your turf. Discover rackets, marks, and useful connections.', hint: disabled ? 'Deck exhausted' : 'Drop a gangster to explore' }));
      exploreCard.addEventListener('mouseleave', () => this._hideInfoPanel());
    }
      exploreCard.addEventListener('click', () => this._showInfoPanel({ title: 'Neighborhood', stats: '', desc: 'Your turf. Discover rackets, marks, and useful connections.', hint: disabled ? 'Deck exhausted' : 'Drop a gangster to explore' }));
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
      const ok = this.executeAction(act, g, exploreCard, dur);
      if (!ok) this._cardMsg('Cannot explore.');
    });
      wrap.appendChild(exploreCard);
      this._dom.exploreWrap = wrap;
    }
    const exploreCard = this._dom.exploreWrap.querySelector('.world-card');
    if (exploreCard) exploreCard.style.opacity = disabled ? '0.5' : '1.0';
    desiredNodes.push(this._dom.exploreWrap);

    // 3) Reconcile discovered table cards
    const attachDrop = (cardEl, onDrop, prog) => {
      if (cardEl._dropBound) return;
      cardEl.addEventListener('dragover', ev => { ev.preventDefault(); cardEl.classList.add('highlight'); });
      cardEl.addEventListener('dragleave', () => cardEl.classList.remove('highlight'));
      cardEl.addEventListener('drop', ev => {
        ev.preventDefault();
        cardEl.classList.remove('highlight');
        const idStr = ev.dataTransfer.getData('text/plain');
        const gid = parseInt(idStr, 10);
        const g = this.state.gangsters.find(x => x.id === gid);
        if (!g || g.busy) return;
        onDrop(g, prog, cardEl);
      });
      cardEl._dropBound = true;
    };

    const disc = (this.state.table && this.state.table.cards) || [];
    const keepUids = new Set();
    disc.forEach(item => {
      if (!item.uid) { item.uid = 'c_' + Math.random().toString(36).slice(2); }
      keepUids.add(item.uid);
      if (item.used && !item.reusable) { return; }
      let wrap = this._dom.cardByUid.get(item.uid);
      if (!wrap) {
        const rendered = renderWorldCard(this, item);
        wrap = rendered.wrap;
        const card = rendered.card;
      const behavior = CARD_BEHAVIORS[item.type];
      attachDrop(card, (g, _prog, cardEl) => {
        if (!g || g.busy) return;
        if (behavior && typeof behavior.onDrop === 'function') return behavior.onDrop(this, item, g, cardEl);
        return this._handleGenericOnDrop(item, g, cardEl);
      }, card);
      const buildInfo = () => getCardInfo(this, item);
      if (window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
        card.addEventListener('mouseenter', () => this._showInfoPanel(buildInfo()));
        card.addEventListener('mouseleave', () => this._hideInfoPanel());
      }
      card.addEventListener('click', () => this._showInfoPanel(buildInfo()));
        this._dom.cardByUid.set(item.uid, wrap);
        // Apply onCreate hook and then activate timers for items created now
        this._applyOnCreate(item);
        this._activateTimersForItem(item, wrap);
      }
      desiredNodes.push(wrap);
    });
    for (const [uid, wrap] of Array.from(this._dom.cardByUid.entries())) {
      if (!keepUids.has(uid)) {
        try { wrap.remove(); } catch(e){}
        this._dom.cardByUid.delete(uid);
      }
    }

    // 4) Attach/reorder without clearing container
    for (let i = 0; i < desiredNodes.length; i++) {
      const node = desiredNodes[i];
      const current = container.childNodes[i];
      if (current !== node) {
        container.insertBefore(node, current || null);
      }
    }
    while (container.childNodes.length > desiredNodes.length) {
      container.removeChild(container.lastChild);
    }
  }
  drawFromDeck(deckId) {
    const table = this.state.table;
    if (!table) return;
    const deck = (this._decks || {})[deckId];
    if (!deck) return;
    if (!deck.hasMore()) return;
    const batch = deck.draw(); // array of ids (grouped multi-pull) or null
    if (!batch || !batch.length) return;
    batch.forEach((id, i) => {
      const card = makeCard(id);
      table.cards.push(card);
      // Create DOM incrementally for just-drawn cards
      this.ensureCardNode(card, (table.cards.length - 1));
    });
    this.updateUI();
  }

  renderWorld() { if (this.reconcileWorld) this.reconcileWorld(); }

  _cardMsg(txt) {
    const host = this.cardEls && this.cardEls.msg ? this.cardEls.msg : null;
    if (!host) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry log-flash';
    entry.textContent = txt;
    host.appendChild(entry);
    // Keep to last 200 messages
    while (host.childNodes.length > 200) { host.removeChild(host.firstChild); }
    // Scroll to bottom
    host.scrollTop = host.scrollHeight;
    // Remove flash class after animation
    setTimeout(() => { try { entry.classList.remove('log-flash'); } catch(e){} }, 700);
  }

  _updateFlowDisplay() {
    const el = document.getElementById('moneyFlowValue');
    if (!el) return;
    const s = this.state;
    const breakdown = this._computeFlowBreakdown();
    const providedBreakdown = (s.flow && Array.isArray(s.flow.breakdown)) ? s.flow.breakdown : [];
    const providedTotal = (s.flow && typeof s.flow.perMinuteTotal === 'number') ? s.flow.perMinuteTotal : null;
    const computedTotal = breakdown.reduce((sum, row) => sum + (row && typeof row.value === 'number' ? row.value : 0), 0);
    // Prefer provided total only when an explicit breakdown is provided; otherwise use computed
    const total = (providedBreakdown.length > 0 && providedTotal != null) ? providedTotal : computedTotal;
    const sign = (total || 0) >= 0 ? '+' : '-';
    el.textContent = `${sign}$${Math.abs(total || 0)}/m`;
    // Bind tooltip with lazy content computation so it reflects latest state at hover time
    const anchor = (el.parentElement) ? el.parentElement : el;
    this.showTooltip(anchor, () => this.buildFlowTooltip(this._computeFlowBreakdown()));
  }

  // Returns HTML string for the money flow tooltip
  buildFlowTooltip(breakdown) {
    const lines = Array.isArray(breakdown) ? breakdown : [];
    if (!lines.length) {
      return '<h4>Cash Flow</h4><div class="tip-row"><div>No data</div></div>';
    }
    const rows = lines.map(({ label, value }) => {
      const cls = value >= 0 ? 'pos' : 'neg';
      const sign = value >= 0 ? '+' : '-';
      return `<div class=\"tip-row\"><div>${label}</div><div class=\"${cls}\">${sign}$${Math.abs(value)}</div></div>`;
    }).join('');
    const sum = lines.reduce((a,b)=>a+b.value,0);
    const sgn = sum >= 0 ? '+' : '-';
    return `<h4>Cash Flow</h4>${rows}<hr/><div class=\"tip-row\"><div>Total</div><div>${sgn}$${Math.abs(sum)}/m</div></div>`;
  }

  // Compute current per-minute flow breakdown from state or fallback heuristics
  _computeFlowBreakdown() {
    const s = this.state;
    if (s && s.flow && Array.isArray(s.flow.breakdown) && s.flow.breakdown.length) {
      return s.flow.breakdown.slice();
    }
    const cleanPerSec = (s.businesses * 20) + (s.businesses * (this.respectLevel() * 10));
    const dirtyPerSec = (s.extortedBusinesses * 10) + (s.illicit * 50);
    const salaryPer10 = (s.gangsters || []).reduce((sum, g) => sum + (this.SALARY_PER_10S[g.type] || 0), 0);
    const salaryPerSec = salaryPer10 / 10;
    const arr = [];
    if (cleanPerSec) arr.push({ label: 'Fronts', value: Math.round(cleanPerSec * 60) });
    if (dirtyPerSec) arr.push({ label: 'Rackets', value: Math.round(dirtyPerSec * 60) });
    if (salaryPerSec) arr.push({ label: 'Salaries', value: -Math.round(salaryPerSec * 60) });
    return arr;
  }

  // Unified tooltip show helper: positions tooltip near the anchor and updates on hover
  showTooltip(anchorEl, htmlContent) {
    if (!anchorEl) return;
    let tip = anchorEl._uiTip;
    const getHtml = (typeof htmlContent === 'function') ? htmlContent : () => htmlContent;
    const ensure = () => {
      if (!tip) {
        tip = document.createElement('div');
        tip.className = 'ui-tooltip';
        document.body.appendChild(tip);
        anchorEl._uiTip = tip;
      }
    };
    const place = () => {
      const rect = anchorEl.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 16, rect.left + rect.width + 10);
      const y = Math.max(10, rect.top + window.scrollY);
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
    };
    const show = () => { tip.classList.add('show'); };
    const hide = () => { tip.classList.remove('show'); };
    // Attach listeners once
    if (!anchorEl._tipBound) {
      anchorEl.addEventListener('mouseenter', () => { ensure(); try { tip.innerHTML = getHtml(); } catch(e) { tip.innerHTML = ''; } place(); show(); });
      anchorEl.addEventListener('mouseleave', () => { hide(); });
      anchorEl.addEventListener('mousemove', () => { if (tip) place(); });
      anchorEl._tipBound = true;
    }
  }

  

  _startCardWork(g, progEl, durMs, onDone) {
    g.busy = true;
    this._markGangsterBusy(g, true);
    // Suspend world re-render so progress elements persist during work
    this._suspendWorldRender = (this._suspendWorldRender || 0) + 1;
    // Ensure the busy state applies even if the progress container is not the gangster card
    this.runProgress(progEl || document.querySelector('.world-card[data-gid="' + String(g.id) + '"]'), durMs, () => {
      try {
        onDone && onDone();
      } finally {
        g.busy = false;
        this._markGangsterBusy(g, false);
        // Resume world render if this is the last active work
        this._suspendWorldRender = Math.max(0, (this._suspendWorldRender || 1) - 1);
        this.renderWorld();
        this.updateUI();
      }
    });
    return true;
  }

  _markGangsterBusy(g, isBusy) {
    try {
      const card = document.querySelector('.world-card[data-gid="' + String(g.id) + '"]');
      if (!card) return;
      if (isBusy) {
        card.classList.add('busy');
        let badge = card.querySelector('.world-card-center-badge.badge-busy');
        if (!badge) {
          badge = document.createElement('div');
          badge.className = 'world-card-center-badge badge-busy';
          badge.textContent = 'Busy';
          card.appendChild(badge);
        }
      } else {
        card.classList.remove('busy');
        const badge = card.querySelector('.world-card-center-badge.badge-busy');
        if (badge) { try { badge.remove(); } catch(e){} }
      }
    } catch(e) { /* no-op */ }
  }

  defaultStatsForType(type) {
    if (type === 'face') return { face: 3, fist: 1, brain: 1, meat: 1 };
    if (type === 'brain') return { face: 1, fist: 1, brain: 3, meat: 1 };
    if (type === 'fist') return { face: 1, fist: 3, brain: 1, meat: 1 };
    if (type === 'boss') return { face: 2, fist: 2, brain: 2, meat: 1 };
    return { face: 1, fist: 1, brain: 1, meat: 1 };
  }


  effectiveStat(g, key) {
    const base = (g.stats && typeof g.stats[key] === 'number') ? g.stats[key] : 0;
    const bonus = 0; // equipment removed
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
    s.dirtyMoney += (s.extortedBusinesses || 0) * 10;
    s.cleanMoney += s.businesses * 20;
    // Respect increases front legitimacy: +$respectLevel per business per tick
    s.cleanMoney += s.businesses * (this.respectLevel() * 10);
    s.dirtyMoney += s.illicit * 50;
    let heatTick = s.disagreeableOwners;
    const unpatrolled = (s.extortedBusinesses || 0) - s.patrol;
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
    // Heat/cooldown visuals handled by progress-ring per item
    // Update cooldown badges in-place
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

  _showInfoPanel({ title = '', stats = '', desc = '', hint = '', dynamic = '' } = {}) {
    const panel = document.getElementById('infoPanel');
    if (!panel) return;
    const t = document.getElementById('infoPanelTitle');
    const s = document.getElementById('infoPanelStats');
    const d = document.getElementById('infoPanelDesc');
    const h = document.getElementById('infoPanelHint');
    if (t) t.textContent = title;
    if (s) s.textContent = stats;
    if (d) d.textContent = desc;
    if (h) h.textContent = [hint, dynamic].filter(Boolean).join('\n');
    panel.classList.remove('hidden');
  }

  _hideInfoPanel() {
    // Do not hide; reset to default placeholder
    const t = document.getElementById('infoPanelTitle');
    const s = document.getElementById('infoPanelStats');
    const d = document.getElementById('infoPanelDesc');
    const h = document.getElementById('infoPanelHint');
    if (t) t.textContent = 'Hover card for info';
    if (s) s.textContent = '';
    if (d) d.textContent = '';
    if (h) h.textContent = '';
  }

  _ensureCooldownAnimator() {
    // No-op: kept for backward compatibility
  }

  _activateTimersForItem(item, wrap) {
    if (!item || !wrap) return;
    // Resume business cooldown
    if (item.type === 'business' && item.cooldownEndMs && Date.now() < item.cooldownEndMs) {
      startCountdown(wrap, {
        startMs: item.cooldownStartMs || (Date.now() - 1),
        endMs: item.cooldownEndMs,
        mode: 'cooldown',
        showBadge: false,
        onTick: (_p, remaining) => {
          if (item._dynEl) {
            const sec = Math.max(0, Math.ceil(remaining / 1000));
            try { item._dynEl.textContent = sec > 0 ? `Recovers in ${sec}s` : ''; } catch(e){}
          }
        },
        onDone: () => {
          try {
            wrap.classList.remove('cooldown-active');
            wrap.style.removeProperty('--p');
            const card = wrap.querySelector && wrap.querySelector('.world-card');
            const banner = card ? card.querySelector('.world-card-center-badge.badge-recover') : null;
            if (banner) { try { banner.remove(); } catch(e){} }
          } catch(e) {}
          item.cooldownUntil = 0;
          item.cooldownStartMs = 0;
          item.cooldownEndMs = 0;
          this.updateCardDynamic(item);
        }
      });
      return;
    }
    // Resume heat countdown (supports legacy seconds-based data)
    if (item.type === 'heat') {
      if (!item.heatEndMs && item.data && typeof item.data.expiresAt === 'number') {
        const remainSec = Math.max(0, (item.data.expiresAt - (this.state.time || 0)));
        item.heatStartMs = Date.now();
        item.heatEndMs = Date.now() + (remainSec * 1000);
        try { delete item.data.expiresAt; } catch(e){}
      }
      if (item.heatEndMs && Date.now() < item.heatEndMs) {
        startCountdown(wrap, {
          startMs: item.heatStartMs || (Date.now() - 1),
          endMs: item.heatEndMs,
          mode: 'heat',
          showBadge: true,
          onDone: () => {
            const disc = (this.state.table && this.state.table.cards) || [];
            const idx = disc.indexOf(item);
            if (idx >= 0) disc.splice(idx, 1);
            if (item.uid) { try { this.removeCardByUid(item.uid); } catch(e){} }
            this._cardMsg('You got arrested');
          }
        });
      }
    }
  }

  // Called to refresh only dynamic lines on cards without rebuilding the whole world
  refreshCardDynamics() {
    const disc = (this.state.table && this.state.table.cards) || [];
    for (const item of disc) {
      if (!item || !item._dynEl) continue;
      try {
        const text = computeCardDynamic(this, item);
        item._dynEl.textContent = text || '';
      } catch(e) {}
    }
  }

  showInlineActionChoice(anchorEl, options, onChoose) {
    // Remove any existing chooser first
    this._destroyInlineChoice();
    const chooser = document.createElement('div');
    chooser.className = 'inline-choice';
    // Add heading directly into chooser UI
    const heading = document.createElement('div');
    heading.className = 'inline-choice-title';
    heading.textContent = 'Choose Action';
    chooser.appendChild(heading);
    (options || []).forEach(opt => {
      const b = document.createElement('button');
      b.textContent = opt.label || opt.id;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this._destroyInlineChoice();
        onChoose && onChoose(opt.id);
      });
      chooser.appendChild(b);
    });
    // Close chooser if clicking elsewhere
    const onDoc = (e) => {
      if (!chooser.contains(e.target) && !anchorEl.contains(e.target)) {
        this._destroyInlineChoice();
      }
    };
    document.addEventListener('click', onDoc, { once: true });
    // Attach to anchor card
    anchorEl.style.position = anchorEl.style.position || 'relative';
    anchorEl.appendChild(chooser);
    this._activeInlineChoice = chooser;
  }

  _destroyInlineChoice() {
    if (this._activeInlineChoice && this._activeInlineChoice.remove) {
      try { this._activeInlineChoice.remove(); } catch(e){}
    }
    this._activeInlineChoice = null;
  }

}
// Generic onDrop handler that uses ACTIONS and recipes as a single source of truth
Game.prototype._handleGenericOnDrop = function(targetItem, gangster, cardEl) {
  // Today we don’t have full multi-card stacks wired. We scaffold: choose an action from available ACTIONS by target type/verbs.
  const verbs = Array.isArray(targetItem.verbs) ? targetItem.verbs : [];
  const candidates = [];
  // Map simple verbs to action ids
  const verbToAction = {
    extort_or_raid: ['actExtort', 'actRaid'],
    launder: ['actLaunder'],
    procure_equipment: ['actProcureEquipment'],
    promo: ['actPromo'],
    pay_cops: ['actPayCops'],
    donate: ['actDonate'],
    hire_recruit: ['actHireGangster'],
  };
  verbs.forEach(v => { (verbToAction[v] || []).forEach(id => candidates.push(id)); });
  // Fallback by target type when verbs are absent
  if (!candidates.length) {
    if (targetItem.type === 'business') candidates.push('actExtort', 'actRaid');
    if (targetItem.type === 'bookmaker') candidates.push('actLaunder');
    if (targetItem.type === 'cop') candidates.push('actPayCops');
    if (targetItem.type === 'priest') candidates.push('actDonate');
    if (targetItem.type === 'recruit') candidates.push('actHireGangster');
  }
  const baseActions = (ACTIONS || []).filter(a => candidates.includes(a.id));
  if (!baseActions.length) return;
  // If one candidate → execute; if multiple → chooser
  const runAction = (baseAct) => {
    const dur = this.durationWithStat(baseAct.base, baseAct.stat, gangster);
    this.executeAction(baseAct, gangster, cardEl, dur);
  };
  if (baseActions.length === 1) {
    runAction(baseActions[0]);
    return;
  }
  const options = baseActions.map(a => ({ id: a.id, label: a.label || a.id }));
  this.showInlineActionChoice(cardEl, options, (choiceId) => {
    const chosen = baseActions.find(a => a.id === choiceId);
    if (!chosen) return;
    runAction(chosen);
  });
};

// Hook runner for card creation behaviors
Game.prototype._applyOnCreate = function(item) {
  try {
    const behavior = (CARD_BEHAVIORS && item) ? CARD_BEHAVIORS[item.type] : null;
    if (behavior && typeof behavior.onCreate === 'function') {
      behavior.onCreate(this, item);
    }
  } catch(e){}
};

// Convenience spawner for table cards; returns the created card
Game.prototype.spawnTableCard = function(idOrCard) {
  const table = this.state.table;
  if (!table || !Array.isArray(table.cards)) return null;
  const card = (typeof idOrCard === 'string') ? makeCard(idOrCard) : (idOrCard || null);
  if (!card) return null;
  table.cards.push(card);
  const idx = table.cards.length - 1;
  this.ensureCardNode(card, idx);
  this.updateUI();
  return card;
};

