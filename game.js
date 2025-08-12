// JavaScript for Gangster Game moved from index.html
import { ACTIONS } from './actions.js';
import { makeCard, makeGangsterCard } from './card.js';
import { Deck } from './deck.js';

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
    };
    // Chance that an extortion attempt results in a disagreeable owner (used by actions.js)
    this.DISAGREEABLE_CHANCE = 0.25;
    this.SALARY_PER_10S = { face: 50, fist: 50, brain: 70 };

    this.darkToggle = document.getElementById('darkToggle');
    const storedDark = localStorage.getItem('dark') === '1';
    this.darkToggle.checked = storedDark;
    document.body.classList.toggle('dark-mode', storedDark);
    this.darkToggle.addEventListener('change', e => {
      document.body.classList.toggle('dark-mode', e.target.checked);
      localStorage.setItem('dark', e.target.checked ? '1' : '0');
    });

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
    // Ensure gangster objects are normalized
    (this.state.gangsters || []).forEach(g => { this._ensureGangsterStats(g); if (!Array.isArray(g.equipped)) g.equipped = []; });
    // Ensure Boss exists as a normal gangster with special stats/name
    if (!this.state.gangsters.some(g => g.type === 'boss')) {
      const bossGang = { id: this.state.nextGangId++, type: 'boss', name: 'Boss', busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } };
      this.state.gangsters.unshift(bossGang);
    }

    // Initialize message UI
    this.initCardUI();
    this.interval = setInterval(() => this.tick(), 1000);

    // Queued selection managers to avoid overlapping popups
    this._gangsterSelect = { queue: [], active: false };
    this._illicitSelect = { queue: [], active: false };
    this._equipSelect = { queue: [], active: false };
    this._actionSelect = { queue: [], active: false };

    // Initialize world table / deck system
    this.initTable();
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
    document.getElementById('time').textContent = s.time;
    document.getElementById('cleanMoney').textContent = s.cleanMoney;
    document.getElementById('dirtyMoney').textContent = s.dirtyMoney;
    document.getElementById('patrol').textContent = s.patrol;
    const extEl = document.getElementById('extortedBusinesses');
    if (extEl) extEl.textContent = s.extortedBusinesses;
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
    if (respectBonusEl) respectBonusEl.textContent = rL > 0 ? `Fronts +$${rL * 10} clean/s each; Laundering +${rL * 10}% yield` : 'None';
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
    // All UI renders via world/table now
    this.saveState();
  }

  runProgress(container, duration, callback) {
    if (!container) {
      console.warn('[runProgress] missing container');
      if (typeof callback === 'function') callback();
      this.updateUI();
      return;
    }
    // Detect ring-only mode: container can be the card itself
    const isCard = container.classList && container.classList.contains('world-card');
    // Find the card element to toggle ring animation and update --p
    let cardEl = isCard ? container : (container.closest && container.closest('.world-card'));
    const ringWrap = cardEl ? cardEl.parentElement : null;
    if (ringWrap && ringWrap.classList.contains('ring-wrap')) {
      try { ringWrap.classList.add('ring-active'); } catch(e){}
      // Add a left badge for remaining seconds
      let leftBadge = cardEl.querySelector('.world-card-badge.left');
      if (!leftBadge) {
        leftBadge = document.createElement('div');
        leftBadge.className = 'world-card-badge left';
        cardEl.appendChild(leftBadge);
      }
      leftBadge.textContent = `${Math.ceil(duration/1000)}s`;
    }
    // For ring-only mode, we skip creating/using a bottom progress bar
    const stacked = !isCard && container.classList.contains('progress-stack');
    let bar = null;
    if (!isCard) {
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
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const percent = Math.min((elapsed / duration) * 100, 100);
      if (bar) bar.style.width = percent + '%';
      if (ringWrap) {
        const cyc = Math.min(Math.max(elapsed / duration, 0), 1);
        try { ringWrap.style.setProperty('--p', `${cyc}`); } catch(e){}
        const leftBadge = cardEl.querySelector('.world-card-badge.left');
        if (leftBadge) leftBadge.textContent = `${Math.max(0, Math.ceil((duration - elapsed)/1000))}s`;
      }
      if (elapsed >= duration) {
        clearInterval(interval);
        if (bar) {
          if (stacked) {
            // remove only this bar; keep container visible for other bars
            bar.remove();
          } else {
            container.classList.add('hidden');
            bar.style.width = '100%';
          }
        }
        callback();
        if (ringWrap) {
          try { ringWrap.classList.remove('ring-active'); ringWrap.style.removeProperty('--p'); } catch(e){}
          const leftBadge = cardEl.querySelector('.world-card-badge.left');
          if (leftBadge) { try { leftBadge.remove(); } catch(e){} }
        }
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

  drawFromDeck(deckId) {
    const table = this.state.table;
    if (!table) return;
    const deck = (this._decks || {})[deckId];
    if (!deck) return;
    if (!deck.hasMore()) return;
    const batch = deck.draw(); // array of ids (grouped multi-pull) or null
    if (!batch || !batch.length) return;
    batch.forEach(id => {
      const card = makeCard(id);
      table.cards.push(card);
    });
    // Reflect immediately
    this.renderWorld();
    this.updateUI();
  }

  

  renderWorld() {
    const el = document.getElementById('worldArea');
    if (!el) return;
    el.innerHTML = '';
    // Render all gangsters as normal world cards (no separate zone)
    (this.state.gangsters || []).forEach(g => {
      this._ensureGangsterStats(g);
      const wrap = document.createElement('div');
      wrap.className = 'ring-wrap';
      const gc = document.createElement('div');
      gc.className = 'card world-card' + (g.busy ? ' busy' : '');
      gc.setAttribute('draggable', g.busy ? 'false' : 'true');
      gc.dataset.gid = String(g.id);
      const gCard = makeGangsterCard({ ...g, stats: { face: this.effectiveStat(g,'face'), fist: this.effectiveStat(g,'fist'), brain: this.effectiveStat(g,'brain') } });
      const artEmoji = g.type === 'boss' ? '👑' : (g.type === 'face' ? '🗣️' : (g.type === 'fist' ? '🥊' : '🧠'));
      const artImg = g.type === 'boss' ? 'boss.png' : (g.type === 'face' ? 'face.png' : (g.type === 'fist' ? 'fist.png' : (g.type === 'brain' ? 'brain.png' : null)));
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
      // No native tooltip
      gc.removeAttribute('title');
      // Fallback if image fails
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
      // Ensure image doesn't steal the drag; start drag on image by proxying mousedown
      gc.addEventListener('mousedown', (ev) => {
        const target = ev.target;
        if (target && target.closest && target.closest('.world-card-art')) {
          // Allow drag to start from the card container itself
          gc.setAttribute('draggable', g.busy ? 'false' : 'true');
        }
      });
      // Desktop-only popover for gangster cards
      if (window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
        // Show info in top-right panel on hover
        gc.addEventListener('mouseenter', () => this._showInfoPanel({
          title: gCard.name,
          stats: `F:${g.stats.fist} Fa:${g.stats.face} Br:${g.stats.brain}`,
          desc: gDesc,
          hint: g.busy ? 'Busy' : 'Drag onto world cards',
        }));
        gc.addEventListener('mouseleave', () => this._hideInfoPanel());
      }
      // Also show on click (mobile or desktop)
      gc.addEventListener('click', () => this._showInfoPanel({
        title: gCard.name,
        stats: `F:${g.stats.fist} Fa:${g.stats.face} Br:${g.stats.brain}`,
        desc: gDesc,
        hint: g.busy ? 'Busy' : 'Drag onto world cards',
      }));
      wrap.appendChild(gc);
      el.appendChild(wrap);
    });
    // Neighborhood explore card (drop gangster to explore)
    const exploreWrap = document.createElement('div');
    exploreWrap.className = 'ring-wrap';
    const exploreCard = document.createElement('div');
    exploreCard.className = 'card world-card';
    const ndeck = (this._decks || {}).neighborhood;
    const disabled = !ndeck || !ndeck.hasMore();
    exploreCard.style.opacity = disabled ? '0.5' : '1.0';
    exploreCard.innerHTML = `
      <div class="world-card-title">Neighborhood</div>
      <div class="world-card-art">
        <img class="world-card-artImg" src="neighborhood.png" alt="Neighborhood">
        <div class="world-card-artEmoji hidden">🏙️</div>
      </div>
      <div class="world-card-desc"><p class="world-card-descText">Your turf. Discover rackets, marks, and useful connections.</p></div>
    `;
    // No native tooltip
    exploreCard.removeAttribute('title');
    {
      const img = exploreCard.querySelector('.world-card-artImg');
      const emojiEl = exploreCard.querySelector('.world-card-artEmoji');
      if (img) img.addEventListener('error', () => { if (emojiEl) emojiEl.classList.remove('hidden'); img.remove(); });
    }
    // Info panel on hover/click
    if (window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      exploreCard.addEventListener('mouseenter', () => this._showInfoPanel({
        title: 'Neighborhood', stats: '', desc: 'Your turf. Discover rackets, marks, and useful connections.', hint: disabled ? 'Deck exhausted' : 'Drop a gangster to explore'
      }));
      exploreCard.addEventListener('mouseleave', () => this._hideInfoPanel());
    }
    exploreCard.addEventListener('click', () => this._showInfoPanel({
      title: 'Neighborhood', stats: '', desc: 'Your turf. Discover rackets, marks, and useful connections.', hint: disabled ? 'Deck exhausted' : 'Drop a gangster to explore'
    }));
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
    exploreWrap.appendChild(exploreCard);
    el.appendChild(exploreWrap);

    // World cards list (table)
    const disc = (this.state.table && this.state.table.cards) || [];

    // Helper to attach standard DnD listeners
    const attachDrop = (cardEl, onDrop, prog) => {
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
    };

    // Declarative behaviors for discovered cards
    const getDropBehavior = (item) => {
      // Simple action by id helper
      const simple = (opts) => ({
        hint: opts.hint,
        handler: (g, prog, cardEl) => {
          const baseAct = (ACTIONS || []).find(a => a.id === opts.actId);
          if (!baseAct) return;
          const act = { ...baseAct, ...(opts.patch || {}) };
          const dur = this.durationWithStat(act.base, act.stat, g);
          const ok = this.executeAction(act, g, cardEl, dur);
          if (!ok) this._cardMsg(opts.failMsg || 'Cannot act.');
        }
      });
      // Map by item.type or id
      if (item.type === 'priest') return simple({ hint: `<div style="margin-top:6px;color:#888">Drop a gangster here to Donate</div>`, actId: 'actDonate', failMsg: 'Cannot donate.' });
      if (item.type === 'cop') return simple({ hint: `<div style="margin-top:6px;color:#888">Drop a gangster to Pay Off Cops</div>`, actId: 'actPayCops', failMsg: 'Cannot pay cops.' });
      if (item.type === 'recruit') return {
        hint: (() => {
          const price = (typeof this.gangsterCost === 'function') ? this.gangsterCost() : 200;
          return `<div style="margin-top:6px;color:#888">Drop a gangster to Hire this recruit (Costs $${price})</div>`;
        })(),
        handler: (g, prog, cardEl) => {
          const baseAct = (ACTIONS || []).find(a => a.id === 'actHireGangster');
          if (!baseAct) return;
          // Pre-check funds to avoid flashing an empty progress bar
          const price = (typeof this.gangsterCost === 'function') ? this.gangsterCost() : 200;
          if (this.totalMoney() < price) { this._cardMsg(`Need $${price} to hire.`); return; }
          const chosen = (item.data && item.data.type) || 'face';
          const act = { ...baseAct, label: `Hire ${chosen.charAt(0).toUpperCase()+chosen.slice(1)}`,
            effect: (game) => {
              const s = game.state;
              const newG = { id: s.nextGangId++, type: chosen, name: undefined, busy: false, personalHeat: 0, stats: game.defaultStatsForType(chosen) };
              s.gangsters.push(newG);
              // consume this recruit card
              item.used = true;
              game.updateUI();
            }
          };
          // Let executeAction manage showing progress; hide on failure for safety
          const dur = this.durationWithStat(act.base, act.stat, g);
          const ok = this.executeAction(act, g, cardEl, dur);
          if (!ok) { if (prog) { try { prog.classList.add('hidden'); } catch(e){} } this._cardMsg('Cannot hire.'); }
        }
      };
      if (item.type === 'crooks') return {
        hint: (() => {
          const price = (typeof this.enforcerCost === 'function') ? this.enforcerCost() : 50;
          return `<div style=\"margin-top:6px;color:#888\">Drop a Face to recruit local crooks as Enforcers (Costs $${price})</div>`;
        })(),
        handler: (g, prog, cardEl) => {
          const baseAct = (ACTIONS || []).find(a => a.id === 'actRecruitEnforcer');
          if (!baseAct) return;
          const act = { ...baseAct, id: 'actRecruitCrooks', label: 'Recruit Local Crooks', stat: 'face',
            effect: (game, gg) => {
              baseAct.effect(game, gg);
              const discArr = (game.state.table && game.state.table.cards) || [];
              let ef = discArr.find(x => x.id === 'enforcers');
              if (!ef) { ef = makeCard('enforcers'); discArr.push(ef); }
              ef.data = ef.data || {}; ef.data.count = (ef.data.count || 0) + 1;
            }
          };
          const dur = this.durationWithStat(act.base, act.stat, g);
          const ok = this.executeAction(act, g, cardEl, dur);
          if (!ok) this._cardMsg('Cannot recruit.');
        }
      };
      if ([
        'hot_dog_stand', 'bakery', 'diner', 'laundromat'
      ].includes(item.id)) return {
        hint: `<div style=\"margin-top:6px;color:#888\">Drop a gangster to Extort or Raid</div>`,
        handler: (g, prog, cardEl) => {
          const now = this.state.time || 0;
          if (item.cooldownUntil && now < item.cooldownUntil) { this._cardMsg('Business is recovering after a raid.'); return; }
          const options = [ { id: 'actExtort', label: 'Extort' }, { id: 'actRaid', label: 'Raid' } ];
          this.showInlineActionChoice(cardEl, options, (choiceId) => {
            const baseAct = (ACTIONS || []).find(a => a.id === choiceId);
            if (!baseAct) return;
            const act = { ...baseAct, effect: (game, gg) => {
              if (choiceId === 'actExtort') {
                this._extortAttemptCount = (this._extortAttemptCount || 0) + 1;
                const forceFail = (this._extortAttemptCount === 2);
                if (gg) gg.personalHeat = (gg.personalHeat || 0) + 1;
                const discArr = (game.state.table && game.state.table.cards) || [];
                const idx = discArr.indexOf(item);
                if (forceFail) {
                  let owner = makeCard('disagreeable_owner');
                  if (idx >= 0) discArr.splice(idx, 1, owner); else discArr.push(owner);
                  game.state.disagreeableOwners = (game.state.disagreeableOwners || 0) + 1;
                } else {
                  let xb = discArr.find(x => x.id === 'extorted_business');
                  if (!xb) {
                    xb = makeCard('extorted_business');
                    xb.data = xb.data || {}; xb.data.count = 1;
                    if (idx >= 0) discArr.splice(idx, 1, xb); else discArr.push(xb);
                  } else {
                    xb.data = xb.data || {}; xb.data.count = (xb.data.count || 0) + 1;
                    if (idx >= 0) {
                      discArr.splice(idx, 1);
                      const oldIdx = discArr.indexOf(xb);
                      if (oldIdx >= 0) { discArr.splice(oldIdx, 1); discArr.splice(idx, 0, xb); }
                    }
                  }
                  game.state.extortedBusinesses = (game.state.extortedBusinesses || 0) + 1;
                }
              }
              if (choiceId === 'actRaid')  { item.cooldownUntil = (game.state.time || 0) + 60; if (typeof baseAct.effect === 'function') baseAct.effect(game, gg); }
            } };
            const dur = this.durationWithStat(act.base, act.stat, g);
            const ok = this.executeAction(act, g, cardEl, dur);
            if (!ok) this._cardMsg('Cannot act on business.');
          });
        }
      };
      if (item.id === 'disagreeable_owner') return {
        hint: `<div style=\"margin-top:6px;color:#888\">Drop Face or Fist to pressure the owner</div>`,
        handler: (g, prog, cardEl) => {
          const face = this.effectiveStat(g, 'face');
          const fist = this.effectiveStat(g, 'fist');
          const useStat = (face >= fist) ? 'face' : 'fist';
          const baseMs = 3500;
          const act = { id: 'actConvinceOrThreaten', label: useStat === 'face' ? 'Convince Owner (Face)' : 'Threaten Owner (Fist)', stat: useStat, base: baseMs,
            effect: (game, gg) => {
              const discArr = (game.state.table && game.state.table.cards) || [];
              const idx = discArr.indexOf(item);
              let xb = discArr.find(x => x.id === 'extorted_business');
              if (!xb) {
                xb = makeCard('extorted_business');
                xb.data = xb.data || {}; xb.data.count = 1;
                if (idx >= 0) discArr.splice(idx, 1, xb); else discArr.push(xb);
              } else {
                xb.data = xb.data || {}; xb.data.count = (xb.data.count || 0) + 1;
                if (idx >= 0) {
                  discArr.splice(idx, 1);
                  const oldIdx = discArr.indexOf(xb);
                  if (oldIdx >= 0) { discArr.splice(oldIdx, 1); discArr.splice(idx, 0, xb); }
                }
              }
              // Update counters: resolved one owner, gained one extorted business
              if (game.state.disagreeableOwners > 0) game.state.disagreeableOwners -= 1;
              game.state.extortedBusinesses = (game.state.extortedBusinesses || 0) + 1;
            } };
          const dur = this.durationWithStat(act.base, act.stat, g);
          const ok = this.executeAction(act, g, cardEl, dur);
          if (!ok) this._cardMsg('Cannot pressure owner.');
        }
      };
      if (item.id === 'newspaper') return simple({ hint: `<div style=\"margin-top:6px;color:#888\">Drop a gangster to run a Promo Campaign</div>`, actId: 'actPromo', failMsg: 'Cannot run promo.' });
      if (item.id === 'pawn_shop') return simple({ hint: `<div style=\"margin-top:6px;color:#888\">Drop a gangster to Procure Equipment</div>`, actId: 'actProcureEquipment', failMsg: 'Cannot procure equipment.' });
      if (item.id === 'bookmaker') return simple({ hint: `<div style=\"margin-top:6px;color:#888\">Drop a Brain to Launder $1000</div>`, actId: 'actLaunder', failMsg: 'Cannot launder.' });
      return null;
    };

    disc.forEach(item => {
      if (item.used && !item.reusable) return;
      const wrap = document.createElement('div');
      wrap.className = 'ring-wrap';
      const c = document.createElement('div');
      c.className = 'card world-card' + (item.type === 'recruit' ? ' recruit' : '');
      const title = item.name || item.title || item.id;
      const artEmoji = (
        item.id === 'hot_dog_stand' ? '🌭' :
        item.id === 'bakery' ? '🥖' :
        item.id === 'diner' ? '🍽️' :
        item.id === 'laundromat' ? '🧺' :
        item.id === 'bookmaker' ? '🎲' :
        item.id === 'newspaper' ? '📰' :
        item.id === 'pawn_shop' ? '💼' :
        item.id === 'disagreeable_owner' ? '🙅' :
        item.id === 'extorted_business' ? '💵' :
        item.type === 'crooks' ? '🧍‍♂️' :
        item.type === 'cop' ? '👮' :
        item.type === 'priest' ? '⛪' :
        item.type === 'milestone' ? '🚪' :
        '🃏'
      );
      const artImg = (
        item.id === 'bakery' ? 'bakery.png' :
        item.type === 'cop' ? 'cop.png' :
        item.type === 'recruit' ? (item.data && item.data.type === 'face' ? 'face.png' : (item.data && item.data.type === 'fist' ? 'fist.png' : 'brain.png')) :
        null
      );
      let body = `
        <div class="world-card-title">${title}</div>
        <div class="world-card-art">
          ${artImg ? `<img class=\"world-card-artImg\" src=\"${artImg}\" alt=\"${title}\">` : ''}
          <div class="world-card-artEmoji${artImg ? ' hidden' : ''}">${artEmoji}</div>
        </div>
        <div class="world-card-desc"><p class="world-card-descText">${item.desc || '&nbsp;'}</p></div>
      `;
      // Type-based behaviors to remove per-id duplication
      // Attach declarative drop behavior, if any
      const behavior = getDropBehavior(item);
      // Do not merge hints into the card face; hints are shown only in the top-right info panel
      // Counter cards: Enforcers and Extorted Businesses (display counts)
      if (item.id === 'enforcers') {
        const count = (item.data && item.data.count) || 0;
        body = `
          <div class="world-card-title">${item.name}</div>
          <div class="world-card-art"><div class="world-card-artEmoji">🧍‍♂️</div></div>
          <div class="world-card-desc"><p class="world-card-descText">Count: ${count}</p></div>
        `;
      }
      if (item.id === 'extorted_business') {
        const count = (item.data && item.data.count) || 0;
        body = `
          <div class="world-card-title">${item.name}</div>
          <div class="world-card-art"><div class="world-card-artEmoji">💵</div></div>
          <div class="world-card-desc"><p class="world-card-descText">Protection owed: ${count}</p></div>
        `;
      }
      c.innerHTML = body;
      // No native tooltip
      c.removeAttribute('title');
      {
        const img = c.querySelector('.world-card-artImg');
        const emojiEl = c.querySelector('.world-card-artEmoji');
        if (img) img.addEventListener('error', () => { if (emojiEl) emojiEl.classList.remove('hidden'); img.remove(); });
      }
      // Apply grayscale for recruits
      if (item.type === 'recruit') {
        const imgEl = c.querySelector('.world-card-artImg');
        if (imgEl) imgEl.style.filter = 'grayscale(1) contrast(0.95)';
      }
      // Per-card progress bar
      // Attach declarative behavior listeners
      if (behavior) {
        attachDrop(c, behavior.handler, c);
      }
      // Show info in top-right panel on hover/click
      const infoData = (() => {
        const stats = '';
        const desc = item.desc || (item.type === 'cop' ? 'A familiar face on the beat. Can arrange favors for a price.' : (item.type === 'crooks' ? 'Can be swayed to patrol for you.' : (item.id === 'enforcers' ? 'Muscle on call.' : '')));
        const hint = (() => {
          // No hints on the card face; use only for info panel if needed
          if (behavior && behavior.hint) return behavior.hint.replace(/<[^>]*>/g,'');
          return '';
        })();
        return { title, stats, desc, hint };
      })();
      if (window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
        c.addEventListener('mouseenter', () => this._showInfoPanel(infoData));
        c.addEventListener('mouseleave', () => this._hideInfoPanel());
      }
      c.addEventListener('click', () => this._showInfoPanel(infoData));
      // Show disabled/cooldown state
      if ([
        'hot_dog_stand','bakery','diner','laundromat'
      ].includes(item.id)) {
        const now = this.state.time || 0;
        if (item.extorted) {
          const badge = document.createElement('div'); badge.className = 'world-card-badge'; badge.style.color = 'var(--badge-disabled)'; badge.textContent = 'Disabled after extortion'; c.appendChild(badge);
          item._badgeEl = badge;
        } else if (item.cooldownUntil && now < item.cooldownUntil) {
          const remain = item.cooldownUntil - now;
          const badge = document.createElement('div'); badge.className = 'world-card-badge'; badge.style.color = 'var(--badge-warn)'; badge.textContent = `Recovering (${remain}s)`; c.appendChild(badge);
          item._badgeEl = badge;
        }
      }
      wrap.appendChild(c);
      el.appendChild(wrap);
    });
  }

  _cardMsg(txt) { if (this.cardEls && this.cardEls.msg) this.cardEls.msg.textContent = txt; }

  executeAction(action, g, progEl, durMs) {
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
    this.runProgress(progEl, durMs, () => {
      try {
        onDone && onDone();
      } finally {
        g.busy = false;
        // Resume world render if this is the last active work
        this._suspendWorldRender = Math.max(0, (this._suspendWorldRender || 1) - 1);
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

  effectiveStat(g, key) {
    this._ensureGangsterStats(g);
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
    // Update cooldown badges in-place to avoid full world re-render flicker
    const disc = (this.state.table && this.state.table.cards) || [];
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

  _showInfoPanel({ title = '', stats = '', desc = '', hint = '' } = {}) {
    const panel = document.getElementById('infoPanel');
    if (!panel) return;
    const t = document.getElementById('infoPanelTitle');
    const s = document.getElementById('infoPanelStats');
    const d = document.getElementById('infoPanelDesc');
    const h = document.getElementById('infoPanelHint');
    if (t) t.textContent = title;
    if (s) s.textContent = stats;
    if (d) d.textContent = desc;
    if (h) h.textContent = hint;
    panel.classList.remove('hidden');
  }

  _hideInfoPanel() {
    const panel = document.getElementById('infoPanel');
    if (!panel) return;
    panel.classList.add('hidden');
  }

  showInlineActionChoice(anchorEl, options, onChoose) {
    // Remove any existing chooser first
    this._destroyInlineChoice();
    const chooser = document.createElement('div');
    chooser.className = 'inline-choice';
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
