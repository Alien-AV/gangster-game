// JavaScript for Gangster Game moved from index.html
import { ACTIONS } from './actions.js';
import { makeCard, CARD_DEFS,CARD_BEHAVIORS, renderWorldCard, getCardInfo, computeCardDynamic } from './card.js';
import { Deck } from './deck.js';
import { startTimer, startCountdown } from './progress-ring.js';
import { clearRing } from './progress-ring.js';
import { RecipeEngine, registerDefaultRecipes } from './recipe.js';

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
    this._illicitSelect = { queue: [], active: false };
    this._equipSelect = { queue: [], active: false };
    this._actionSelect = { queue: [], active: false };

    // DOM caches for reconciliation and initial world paint
    this._dom = { cardByUid: new Map() };
    // Initialize world table / deck system
    this.initTable();
    // Initialize recipe engine with simple single-card mappings (scaffolding)
    this._recipes = new RecipeEngine();
    // Default recipes
    this._recipes.addRecipe(['business','gangster'], ['actExtort','actRaid']);
    this._recipes.addRecipe(['bookmaker','gangster'], ['actLaunder']);
    this._recipes.addRecipe(['priest','gangster'], ['actDonate']);
    this._recipes.addRecipe(['recruit','gangster'], ['actRecruitFromCard']);
    registerDefaultRecipes(this._recipes);
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
      illicitCounts: s.illicitCounts,
      illicit: s.illicit,
      illicitProgress: s.illicitProgress,
      unlockedIllicit: s.unlockedIllicit,
      gangsters: (s.gangsters || []).map(g => ({ id: g.id, type: g.type, busy: false, personalHeat: g.personalHeat || 0, stats: g.stats || this.defaultStatsForType(g.type), name: g.name, equipped: Array.isArray(g.equipped) ? g.equipped : [] })),
      nextGangId: s.nextGangId,
      salaryTick: s.salaryTick,
      table: s.table || null,
      // Persist deck states (all decks)
      decks: (() => {
        const res = {};
        const d = this._decks || {};
        for (const key of Object.keys(d)) {
          const deck = d[key];
          if (!deck) continue;
          res[key] = {
            start: Array.isArray(deck._start) ? deck._start.slice() : [],
            middle: Array.isArray(deck._middle) ? deck._middle.slice() : [],
            end: Array.isArray(deck._end) ? deck._end.slice() : [],
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
      // Hard reset world/table/DOM before applying loaded state
      this._resetWorld();
      Object.assign(this.state, data);
      this.state.gangsters = (data.gangsters || []).map(g => ({ id: g.id, type: g.type, name: g.name, busy: false, personalHeat: g.personalHeat || 0, stats: g.stats || this.defaultStatsForType(g.type), equipped: Array.isArray(g.equipped) ? g.equipped : [] }));
      // Ensure Boss exists
      if (!this.state.gangsters.some(x => x.type === 'boss')) {
        const bossGang = { id: this.state.nextGangId++, type: 'boss', name: 'Boss', busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } };
        this.state.gangsters.unshift(bossGang);
      }
      // Reset modal queues and refresh UI
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
      // Hard reset world/table/DOM before applying loaded state
      this._resetWorld();
      Object.assign(this.state, data);
      this.state.gangsters = (data.gangsters || []).map(g => ({ id: g.id, type: g.type, name: g.name, busy: false, personalHeat: g.personalHeat || 0, stats: g.stats || this.defaultStatsForType(g.type) }));
    } catch (e) {
      console.error('Failed to load saved state', e);
    }
    this.updateUI();
    // Ensure table exists
    this._decks = {};
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

  // Removed legacy gangster selection UI

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
    // Spawn the Neighborhood card at game start
    this.spawnTableCard('neighborhood');
    // Build runtime deck objects (not saved directly)
    this._decks = this._decks || {};
    // Build decks from declarative card defs (any card with data.deck)
    const deckIds = CARD_DEFS.filter(c => c && c.data && c.data.deck === true).map(c => c.id);
    for (const id of deckIds) {
      if (this._decks[id]) continue;
      const snap = (this.state.decks && this.state.decks[id]) || null;
      if (snap) {
        const d = new Deck({});
        d._start = Array.isArray(snap.start) ? snap.start.slice() : [];
        d._middle = Array.isArray(snap.middle) ? snap.middle.slice() : [];
        d._end = Array.isArray(snap.end) ? snap.end.slice() : [];
        this._decks[id] = d;
      } else {
        const def = CARD_DEFS.find(c => c.id === id);
        const start = (def && def.data && Array.isArray(def.data.deckStart)) ? def.data.deckStart.slice() : [];
        const pool = (def && def.data && Array.isArray(def.data.exploreIds)) ? def.data.exploreIds.slice() : [];
        const end = (def && def.data && Array.isArray(def.data.deckEnd)) ? def.data.deckEnd.slice() : [];
        this._decks[id] = new Deck({ start, pool, end });
      }
    }
  }

  // ---- Targeted DOM ops (incremental) ----
  _worldContainer() {
    return document.getElementById('worldArea');
  }

  // Completely remove all world card DOM and reset table state
  _resetWorld() {
    try {
      const map = this._dom && this._dom.cardByUid ? this._dom.cardByUid : new Map();
      for (const [, wrap] of Array.from(map.entries())) {
        try { wrap.remove(); } catch(e){}
      }
      if (this._dom && this._dom.cardByUid) this._dom.cardByUid.clear();
    } catch(e){}
    this.state.table = { cards: [] };
  }

  // Removed neighborhood-specific explore wrapper

  ensureGangsterNode(g) {
    // Deprecated: kept temporarily for back-compat; use ensureCardNode with uid 'g_<gid>' instead
    const uid = 'g_' + String(g.id);
    const defId = (g.type === 'boss') ? 'boss' : (`gangster_${g.type}`);
    const model = makeCard(defId);
    model.data = Object.assign({}, model.data, { gid: g.id, type: g.type });
    model.uid = uid;
    return this.ensureCardNode(model, undefined);
  }

  spawnTableCard(idOrCard) {
    const table = this.state.table;
    if (!table || !Array.isArray(table.cards)) return null;
    const card = (typeof idOrCard === 'string') ? makeCard(idOrCard) : idOrCard;
    table.cards.push(card);
    this.ensureCardNode(card, table.cards.length - 1);
    return card;
  }

  replaceCard(oldItem, newItem, index) {
    if (oldItem && oldItem.uid) this.removeCardByUid(oldItem.uid);
    return this.ensureCardNode(newItem, index);
  }

  ensureCardNode(item, index) {
    if (!item.uid) item.uid = 'c_' + Math.random().toString(36).slice(2);
    // Auto-initialize gangster cards without a linked entity
    try {
      if (item.type === 'gangster') {
        const hasGid = item.data && typeof item.data.gid === 'number';
        if (!hasGid) {
          let gtype = 'face';
          if (item.id === 'boss') gtype = 'boss';
          else if (typeof item.id === 'string' && item.id.indexOf('gangster_') === 0) {
            gtype = item.id.slice('gangster_'.length) || 'face';
          }
          const g = { id: this.state.nextGangId++, type: gtype, name: gtype === 'boss' ? 'Boss' : undefined, busy: false, personalHeat: 0, stats: this.defaultStatsForType(gtype) };
          this.state.gangsters.push(g);
          item.data = Object.assign({}, item.data, { gid: g.id, type: gtype });
        }
      }
    } catch(e){}
    let wrap = this._dom.cardByUid.get(item.uid);
    if (!wrap) {
      const rendered = renderWorldCard(this, item);
      wrap = rendered.wrap;
      const card = rendered.card;
      const behavior = CARD_BEHAVIORS[item.type];
      // Attach drop only for non-gangster cards
      if (item.type !== 'gangster') {
        card.addEventListener('dragover', ev => { ev.preventDefault(); card.classList.add('highlight'); });
        card.addEventListener('dragleave', () => card.classList.remove('highlight'));
        card.addEventListener('drop', ev => {
          ev.preventDefault(); card.classList.remove('highlight');
          const payload = ev.dataTransfer.getData('text/plain');
          if (payload && payload.startsWith('uid:')) {
            const uid = payload.slice(4);
            const tableCards = (this.state.table && this.state.table.cards) || [];
            const sourceItem = tableCards.find(x => x && x.uid === uid);
            if (!sourceItem) return;
            this._handleCardOnCardDrop(item, sourceItem, card);
            return;
          }
          const gid = parseInt(payload, 10);
          const g = this.state.gangsters.find(x => x.id === gid);
          if (!g || g.busy) return;
          const handler = (behavior && typeof behavior.onDrop === 'function') ? (gg => behavior.onDrop(this, item, gg, card)) : (gg => this._handleGenericOnDrop(item, gg, card));
          handler(g);
        });
      }
      const buildInfo = () => getCardInfo(this, item);
      this._bindInfoPanel(card, buildInfo);
      // Apply generic draggable when declared
      const isBusyFn = () => {
        if (item.type === 'gangster' && item.data && typeof item.data.gid === 'number') {
          const g = (this.state.gangsters || []).find(x => x.id === item.data.gid);
          return !!(g && g.busy);
        }
        return false;
      };
      this._applyDraggable(card, item, isBusyFn);
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
    // Insert/reposition at appropriate position: [gangsters][cards]
    const container = this._worldContainer();
    if (!container) return wrap;
    if (item.type === 'gangster') {
      // No special section: append naturally
      if (wrap.parentElement !== container) container.appendChild(wrap);
    } else if (typeof index === 'number') {
      const offset = (this.state.gangsters || []).length;
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
    (this.state.gangsters || []).forEach(g => {
      const uid = 'g_' + String(g.id);
      const defId = (g.type === 'boss') ? 'boss' : (`gangster_${g.type}`);
      const model = makeCard(defId);
      model.data = Object.assign({}, model.data, { gid: g.id, type: g.type });
      model.uid = uid;
      const wrap = this.ensureCardNode(model, undefined);
      desiredNodes.push(wrap);
    });

    // 2) Reconcile discovered table cards (including any deck cards)
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
      // Dim any deck card that is exhausted
      try {
        if (item && item.data && item.data.deck === true) {
          const d = (this._decks || {})[item.id];
          const exhausted = !d || !d.hasMore();
          const cardEl = wrap.querySelector && wrap.querySelector('.world-card');
          if (cardEl) cardEl.style.opacity = exhausted ? '0.5' : '1.0';
        }
      } catch(e){}
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
    this.runProgress(progEl || document.querySelector('.world-card[data-uid="' + 'g_' + String(g.id) + '"]'), durMs, () => {
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
      const card = document.querySelector('.world-card[data-uid="' + 'g_' + String(g.id) + '"]');
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
    if (!g || !g.stats) return 0;
    const hasKey = (typeof key === 'string') && (typeof g.stats[key] === 'number');
    return hasKey ? g.stats[key] : 0;
  }

  durationWithStat(baseMs, statKey, g) {
    const s = this.effectiveStat(g, statKey) || 0;
    const scale = 1 + 0.1 * s; // 10% faster per point
    return Math.max(500, Math.floor(baseMs / scale));
  }

  // Uniform requirements checker for actions
  // Supports:
  // - function(game, gangster, ctx) → boolean | string (reason)
  // - object { stat: 'fist'|'face'|'brain'|'meat', min: number }
  // - array of the above (all must pass)
  checkRequirements(action, gangster, ctx) {
    const req = action && action.requires;
    if (!req) return { ok: true };
    const evalOne = (r) => {
      if (!r) return { ok: true };
      if (typeof r === 'function') {
        const out = r(this, gangster, ctx);
        if (out === true) return { ok: true };
        if (out === false) return { ok: false, reason: 'Requirements not met' };
        if (typeof out === 'string') return { ok: false, reason: out };
        return { ok: !!out };
      }
      if (typeof r === 'object') {
        if (r.stat && typeof r.min === 'number') {
          const val = this.effectiveStat(gangster, r.stat) || 0;
          if (val >= r.min) return { ok: true };
          return { ok: false, reason: `${r.stat[0].toUpperCase()}${r.stat.slice(1)} ${r.min} required` };
        }
      }
      return { ok: true };
    };
    if (Array.isArray(req)) {
      for (const r of req) {
        const res = evalOne(r);
        if (!res.ok) return res;
      }
      return { ok: true };
    }
    return evalOne(req);
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

    // Stat/other requirements
    if (action && action.requires) {
      const ctx = this._pendingAction && this._pendingAction.targetItem ? this._pendingAction.targetItem : null;
      const res = this.checkRequirements(action, g, ctx);
      if (!res.ok) { this._cardMsg(res.reason || 'Requirements not met'); return false; }
    }

    // Costs
    if (action && action.cost) {
      if (typeof action.cost === 'function') {
        const ok = action.cost(this, g);
        if (!ok) { this._cardMsg('Not enough money'); return false; }
      } else if (typeof action.cost === 'object') {
        if (action.cost.money) {
          if (this.totalMoney() < action.cost.money) { this._cardMsg('Not enough money'); return false; }
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

    // Start timed work and apply effect (capture context now to avoid race with concurrent actions)
    const capturedCtx = this._pendingAction || {};
    this._pendingAction = null;
    return this._startCardWork(g, progEl, durMs, () => {
      if (action && typeof action.effect === 'function') {
        action.effect(this, g, capturedCtx.targetEl, capturedCtx.targetItem);
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
      if (opt && opt.title) b.title = opt.title;
      if (opt && opt.disabled) b.disabled = true;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (b.disabled) return;
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
    // Position chooser centered over the anchor card using viewport coordinates
    const rect = anchorEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    chooser.style.left = cx + 'px';
    chooser.style.top = cy + 'px';
    document.body.appendChild(chooser);
    this._activeInlineChoice = chooser;
  }

  _destroyInlineChoice() {
    if (this._activeInlineChoice && this._activeInlineChoice.remove) {
      try { this._activeInlineChoice.remove(); } catch(e){}
    }
    this._activeInlineChoice = null;
  }

}
// Generic info panel binder used for all cards
Game.prototype._bindInfoPanel = function(cardEl, buildInfoFn) {
  const show = () => this._showInfoPanel(buildInfoFn());
  if (window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    cardEl.addEventListener('mouseenter', show);
    cardEl.addEventListener('mouseleave', () => this._hideInfoPanel());
  }
  cardEl.addEventListener('click', show);
};

// Generic draggable applier
Game.prototype._applyDraggable = function(cardEl, itemLike, isBusyFn) {
  if (!cardEl || !itemLike || !itemLike.draggable) return;
  const getGid = () => (itemLike.data && typeof itemLike.data.gid === 'number') ? String(itemLike.data.gid) : null;
  const isBusy = () => (typeof isBusyFn === 'function') ? !!isBusyFn() : false;
  // Make the whole card draggable (we guard in dragstart if busy)
  cardEl.setAttribute('draggable', 'true');
  cardEl.addEventListener('dragstart', (ev) => {
    if (isBusy()) { ev.preventDefault(); return; }
    const gid = getGid();
    if (gid) {
      ev.dataTransfer.setData('text/plain', gid);
    } else if (itemLike && itemLike.uid) {
      ev.dataTransfer.setData('text/plain', 'uid:' + itemLike.uid);
    } else {
      ev.preventDefault(); return;
    }
    ev.dataTransfer.effectAllowed = 'move';
  });
};

// Generic onDrop handler that uses ACTIONS and recipes as a single source of truth
Game.prototype._handleGenericOnDrop = function(targetItem, gangster, cardEl) {
  // Scaffolding for recipe usage: match by types present in the interaction
  // If target is a declarative deck card and it's exhausted, do nothing
  try {
    if (targetItem && targetItem.data && targetItem.data.deck === true) {
      const d = (this._decks || {})[targetItem.id];
      if (!d || !d.hasMore()) return;
    }
  } catch(e){}
  const stackTypes = [targetItem.type, 'gangster'];
  const actionOrOps = this._recipes.matchAll(stackTypes, { game: this, target: targetItem, gangster });
  // Support special ops from recipes: spawnCardId, consumeTarget
  const ops = actionOrOps.filter(x => typeof x === 'object');
  const actionIds = actionOrOps.filter(x => typeof x === 'string');
  // Apply ops first
  if (ops.length) {
    const table = this.state.table;
    const tableCards = table && table.cards ? table.cards : [];
    for (const op of ops) {
      if (op.spawnGangsterType) {
        const type = op.spawnGangsterType;
        const stats = this.defaultStatsForType ? this.defaultStatsForType(type) : (type === 'face' ? { face: 3, fist: 1, brain: 1, meat: 1 } : type === 'fist' ? { face: 1, fist: 3, brain: 1, meat: 1 } : { face: 1, fist: 1, brain: 3, meat: 1 });
        const g = { id: this.state.nextGangId++, type, name: undefined, busy: false, personalHeat: 0, stats };
        this.state.gangsters.push(g);
        this.reconcileWorld();
        this.updateUI();
      } else if (op.spawnCardId) {
        this.spawnTableCard(op.spawnCardId);
      }
      if (op.consumeTarget) {
        const idx = tableCards.indexOf(targetItem);
        if (idx >= 0) {
          // Stop any heat countdown on the target before removal
          if (targetItem && targetItem.type === 'heat') {
            const wrap = this._dom.cardByUid.get(targetItem.uid);
            if (wrap) { try { clearRing(wrap, 'heat'); } catch(e){} }
          }
          tableCards.splice(idx, 1);
          if (targetItem.uid) this.removeCardByUid(targetItem.uid);
        }
      }
    }
    // After ops, we’re done for this interaction
    return;
  }
  const baseActions = (ACTIONS || []).filter(a => actionIds.includes(a.id));
  if (!baseActions.length) return;
  // If one candidate → execute; if multiple → chooser
  const runAction = (baseAct) => {
    const dur = this.durationWithStat(baseAct.base, baseAct.stat, gangster);
    // Stash context for actions that need the drop target/item (e.g., explore deck)
    this._pendingAction = { targetEl: cardEl, targetItem };
    const ok = this.executeAction(baseAct, gangster, cardEl, dur);
    if (!ok) this._pendingAction = null;
  };
  if (baseActions.length === 1) {
    runAction(baseActions[0]);
    return;
  }
  const options = baseActions.map(a => {
    const res = (typeof this.checkRequirements === 'function') ? this.checkRequirements(a, gangster, targetItem) : { ok: true };
    const baseLabel = a.label || a.id;
    const label = res && !res.ok && res.reason ? `${baseLabel} (${res.reason})` : baseLabel;
    return { id: a.id, label, disabled: res && !res.ok, title: res && !res.ok ? res.reason : '' };
  });
  this.showInlineActionChoice(cardEl, options, (choiceId) => {
    const chosen = baseActions.find(a => a.id === choiceId);
    if (!chosen) return;
    runAction(chosen);
  });
};

// Card-on-card recipe application
Game.prototype._handleCardOnCardDrop = function(targetItem, sourceItem, cardEl) {
  // Match by types of both cards
  const types = [targetItem.type, sourceItem.type];
  const actionOrOps = this._recipes.matchAll(types, { game: this, target: targetItem, source: sourceItem });
  const ops = actionOrOps.filter(x => typeof x === 'object');
  const actionIds = actionOrOps.filter(x => typeof x === 'string');
  const table = this.state.table; const tableCards = table && table.cards ? table.cards : [];
  if (ops.length) {
    for (const op of ops) {
      if (op.spawnCardId) this.spawnTableCard(op.spawnCardId);
      if (op.consumeTarget) {
        const idx = tableCards.indexOf(targetItem);
        if (idx >= 0) {
          if (targetItem && targetItem.type === 'heat') {
            const tw = this._dom.cardByUid.get(targetItem.uid);
            if (tw) { try { clearRing(tw, 'heat'); } catch(e){} }
          }
          tableCards.splice(idx, 1);
          if (targetItem.uid) this.removeCardByUid(targetItem.uid);
        }
      }
      if (op.consumeSource) {
        const sidx = tableCards.indexOf(sourceItem);
        if (sidx >= 0) {
          if (sourceItem && sourceItem.type === 'heat') {
            const sw = this._dom.cardByUid.get(sourceItem.uid);
            if (sw) { try { clearRing(sw, 'heat'); } catch(e){} }
          }
          tableCards.splice(sidx, 1);
          if (sourceItem.uid) this.removeCardByUid(sourceItem.uid);
        }
      }
    }
    this.updateUI();
    return;
  }
  if (actionIds.length) {
    // Run the first matched action as a timed action targeting the drop target
    const baseAct = (ACTIONS || []).find(a => a && a.id === actionIds[0]);
    if (!baseAct) return;
    const dur = this.durationWithStat(baseAct.base, baseAct.stat, null);
    this._pendingAction = { targetEl: cardEl, targetItem: targetItem };
    const ok = this.executeAction(baseAct, { stats: { face:1, fist:1, brain:1, meat:1 } }, cardEl, dur);
    if (!ok) this._pendingAction = null;
    return;
  }
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

