// JavaScript for Gangster Game moved from index.html

class Game {
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
      boss: { busy: false },
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
      boss: s.boss ? { busy: false, personalHeat: s.boss.personalHeat || 0, stats: s.boss.stats || { face: 2, fist: 2, brain: 2 } } : { busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } },
      gangsters: (s.gangsters || []).map(g => ({ id: g.id, type: g.type, busy: false, personalHeat: g.personalHeat || 0, stats: g.stats || this.defaultStatsForType(g.type) })),
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
      this.state.boss = data.boss ? { busy: false, personalHeat: data.boss.personalHeat || 0, stats: data.boss.stats || { face: 2, fist: 2, brain: 2 } } : { busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } };
      this.state.gangsters = (data.gangsters || []).map(g => ({ id: g.id, type: g.type, busy: false, personalHeat: g.personalHeat || 0, stats: g.stats || this.defaultStatsForType(g.type) }));
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
      this.state.boss = data.boss ? { busy: false, personalHeat: data.boss.personalHeat || 0, stats: data.boss.stats || { face: 2, fist: 2, brain: 2 } } : { busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } };
      this.state.gangsters = (data.gangsters || []).map(g => ({ id: g.id, type: g.type, busy: false, personalHeat: g.personalHeat || 0, stats: g.stats || this.defaultStatsForType(g.type) }));
    } catch (e) {
      console.error('Failed to load saved state', e);
    }
    this.updateUI();
    // Keep card UI in sync
    this.renderCards();
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

  renderBoss() {
    const state = this.state;
    const container = document.getElementById('bossContainer');
    const boss = state.boss;
    if (!boss.element) {
      const row = document.createElement('div');
      row.className = 'action';

      const extortBtn = document.createElement('button');
      const extortProg = document.createElement('div');
      extortProg.className = 'progress hidden';
      extortProg.innerHTML = '<div class="progress-bar"></div>';

      const illicitBtn = document.createElement('button');
      const illicitProg = document.createElement('div');
      illicitProg.className = 'progress hidden';
      illicitProg.innerHTML = '<div class="progress-bar"></div>';

      const recruitBtn = document.createElement('button');
      const recruitProg = document.createElement('div');
      recruitProg.className = 'progress hidden';
      recruitProg.innerHTML = '<div class="progress-bar"></div>';

      const hireBtn = document.createElement('button');
      const hireProg = document.createElement('div');
      hireProg.className = 'progress hidden';
      hireProg.innerHTML = '<div class="progress-bar"></div>';

      const businessBtn = document.createElement('button');
      const businessProg = document.createElement('div');
      businessProg.className = 'progress hidden';
      businessProg.innerHTML = '<div class="progress-bar"></div>';

      row.appendChild(extortBtn);
      row.appendChild(extortProg);
      row.appendChild(illicitBtn);
      row.appendChild(illicitProg);
      row.appendChild(recruitBtn);
      row.appendChild(recruitProg);
      row.appendChild(hireBtn);
      row.appendChild(hireProg);
      row.appendChild(businessBtn);
      row.appendChild(businessProg);

      boss.element = row;
      boss.extortButton = extortBtn;
      boss.extortProgress = extortProg;
      boss.illicitButton = illicitBtn;
      boss.illicitProgress = illicitProg;
      boss.recruitButton = recruitBtn;
      boss.recruitProgress = recruitProg;
      boss.hireButton = hireBtn;
      boss.hireProgress = hireProg;
      boss.businessButton = businessBtn;
      boss.businessProgress = businessProg;

      container.appendChild(row);

      extortBtn.onclick = () => {
        if (boss.busy) return;
        boss.busy = true;
        extortBtn.disabled = true;
        illicitBtn.disabled = true;
        recruitBtn.disabled = true;
        hireBtn.disabled = true;
        businessBtn.disabled = true;
        this.runProgress(extortProg, this.extortDuration(3000), () => {
          if (Math.random() < this.DISAGREEABLE_CHANCE) {
            state.disagreeableOwners += 1;
          } else {
            state.territory += 1;
          }
          state.unlockedBusiness = true;
          state.unlockedEnforcer = true;
          boss.busy = false;
          extortBtn.disabled = false;
          illicitBtn.disabled = false;
          recruitBtn.disabled = false;
          hireBtn.disabled = false;
          businessBtn.disabled = false;
        });
      };

      illicitBtn.onclick = () => {
        if (boss.busy) return;
        if (state.businesses - state.illicit - state.illicitProgress <= 0) return alert('No available fronts');
        boss.busy = true;
        extortBtn.disabled = true;
        illicitBtn.disabled = true;
        recruitBtn.disabled = true;
        hireBtn.disabled = true;
        businessBtn.disabled = true;
        state.illicitProgress += 1;
        this.updateUI();
        this.runProgress(illicitProg, 4000, () => {
          state.illicitProgress -= 1;
          this.showIllicitBusinessSelection(choice => {
            state.illicitCounts[choice] += 1;
            state.illicit += 1;
            state.respect += 1;
            boss.busy = false;
            extortBtn.disabled = false;
            illicitBtn.disabled = false;
            recruitBtn.disabled = false;
            hireBtn.disabled = false;
            businessBtn.disabled = false;
            this.updateUI();
          });
        });
      };

      recruitBtn.onclick = () => {
        if (boss.busy) return;
        const cost = this.enforcerCost();
        if (this.totalMoney() < cost) return alert('Not enough money');
        boss.busy = true;
        extortBtn.disabled = true;
        illicitBtn.disabled = true;
        recruitBtn.disabled = true;
        hireBtn.disabled = true;
        businessBtn.disabled = true;
        this.spendMoney(cost);
        this.runProgress(recruitProg, 2000, () => {
          state.patrol += 1;
          state.unlockedGangster = true;
          boss.busy = false;
          extortBtn.disabled = false;
          illicitBtn.disabled = false;
          recruitBtn.disabled = false;
          hireBtn.disabled = false;
          businessBtn.disabled = false;
        });
      };

      hireBtn.onclick = () => {
        if (boss.busy) return;
        if (!state.unlockedGangster) return alert('Recruit enforcers first');
        const gCost = this.gangsterCost();
        if (this.totalMoney() < gCost) return alert('Not enough money');
        boss.busy = true;
        extortBtn.disabled = true;
        illicitBtn.disabled = true;
        recruitBtn.disabled = true;
        hireBtn.disabled = true;
        businessBtn.disabled = true;
        this.spendMoney(gCost);
        this.runProgress(hireProg, 3000, () => {
          this.showGangsterTypeSelection(choice => {
            const g = { id: state.nextGangId++, type: choice, busy: false, personalHeat: 0, stats: this.defaultStatsForType(choice) };
            state.gangsters.push(g);
            boss.busy = false;
            extortBtn.disabled = false;
            illicitBtn.disabled = false;
            recruitBtn.disabled = false;
            hireBtn.disabled = false;
            businessBtn.disabled = false;
            this.updateUI();
            this.renderCards();
          });
        });
      };

      businessBtn.onclick = () => {
        if (boss.busy) return;
        if (!state.unlockedBusiness) return alert('No territory yet');
        const cost = this.businessCost();
        if (this.totalMoney() < cost) return alert('Not enough money');
        boss.busy = true;
        extortBtn.disabled = true;
        illicitBtn.disabled = true;
        recruitBtn.disabled = true;
        hireBtn.disabled = true;
        businessBtn.disabled = true;
        this.spendMoney(cost);
        this.runProgress(businessProg, 5000, () => {
          state.businesses += 1;
          state.unlockedIllicit = true;
          state.respect += 1;
          boss.busy = false;
          extortBtn.disabled = false;
          illicitBtn.disabled = false;
          recruitBtn.disabled = false;
          hireBtn.disabled = false;
          businessBtn.disabled = false;
        });
      };
    }

    boss.extortButton.textContent = 'Boss Extort';
    boss.extortButton.disabled = boss.busy;
    boss.illicitButton.textContent = 'Boss Build Illicit';
    const availFronts = state.businesses - state.illicit - state.illicitProgress;
    boss.illicitButton.disabled = boss.busy || !state.unlockedIllicit || availFronts <= 0;
    boss.recruitButton.textContent = 'Boss Recruit Enforcer';
    boss.recruitButton.disabled = boss.busy || !state.unlockedEnforcer;
    boss.hireButton.textContent = 'Boss Recruit Gangster';
    boss.hireButton.disabled = boss.busy || !state.unlockedGangster;
    boss.businessButton.textContent = 'Boss Buy Business';
    boss.businessButton.disabled = boss.busy || !state.unlockedBusiness;
  }

  renderGangsters() {
    const state = this.state;
    const faceDiv = document.getElementById('facesContainer');
    const brainDiv = document.getElementById('brainsContainer');
    const fistDiv = document.getElementById('fistsContainer');

    const ensureRow = g => {
      if (g.ui) return;
      // Create row and controls
      const row = document.createElement('div');
      row.className = 'action';
      const primary = document.createElement('button');
      const primaryProg = document.createElement('div');
      primaryProg.className = 'progress hidden';
      primaryProg.innerHTML = '<div class="progress-bar"></div>';
      const aux = document.createElement('button');
      const auxProg = document.createElement('div');
      auxProg.className = 'progress hidden';
      auxProg.innerHTML = '<div class="progress-bar"></div>';
      const fear = document.createElement('button');
      const fearProg = document.createElement('div');
      fearProg.className = 'progress hidden';
      fearProg.innerHTML = '<div class="progress-bar"></div>';

      // Community/Respect action button for all types
      const rep = document.createElement('button');
      const repProg = document.createElement('div');
      repProg.className = 'progress hidden';
      repProg.innerHTML = '<div class="progress-bar"></div>';

      // Layout
      row.appendChild(primary);
      row.appendChild(primaryProg);
      row.appendChild(aux);
      row.appendChild(auxProg);
      if (g.type === 'fist' || g.type === 'brain') {
        row.appendChild(fear);
        row.appendChild(fearProg);
      }
      row.appendChild(rep);
      row.appendChild(repProg);

      // Heat label
      const heatLabel = document.createElement('span');
      heatLabel.style.marginLeft = '8px';
      heatLabel.textContent = `Heat: ${g.personalHeat || 0}`;
      row.appendChild(heatLabel);

      // Attach
      g.ui = { row, primary, primaryProg, aux, auxProg, fear: (g.type === 'fist' || g.type === 'brain') ? fear : null, fearProg: (g.type === 'fist' || g.type === 'brain') ? fearProg : null, rep, repProg, heatLabel };
      // Bind handlers per type (only once, on creation)
      if (g.type === 'face') this._bindFaceHandlers(g);
      else if (g.type === 'brain') this._bindBrainHandlers(g);
      else if (g.type === 'fist') this._bindFistHandlers(g);
    };

    state.gangsters.forEach(g => {
      ensureRow(g);
      // Ensure row is attached to the right container (idempotent)
      let target = null;
      if (g.type === 'face') target = faceDiv;
      else if (g.type === 'brain') target = brainDiv;
      else if (g.type === 'fist') target = fistDiv;
      if (g.ui && g.ui.row && target && g.ui.row.parentNode !== target) {
        target.appendChild(g.ui.row);
      }
      this._updateGangsterRow(g);
    });
  }

  _bindFaceHandlers(g) {
    const state = this.state;
    const { primary: btn, primaryProg: prog, aux: auxBtn, auxProg, rep, repProg } = g.ui;
    btn.onclick = () => {
      if (g.busy) return;
      g.busy = true;
      btn.disabled = true;
      auxBtn.disabled = true;
      this.runProgress(prog, this.extortDuration(4000), () => {
        if (Math.random() < this.DISAGREEABLE_CHANCE) {
          state.disagreeableOwners += 1;
        } else {
          state.territory += 1;
        }
        g.personalHeat = (g.personalHeat || 0) + 1;
        state.unlockedBusiness = true;
        g.busy = false;
        btn.disabled = false;
        auxBtn.disabled = false;
        if (g.ui.heatLabel) g.ui.heatLabel.textContent = `Heat: ${g.personalHeat}`;
      });
    };

    auxBtn.onclick = () => {
      if (g.busy) return;
      if (!state.unlockedGangster) return alert('Recruit enforcers first');
      const gCost = this.gangsterCost();
      if (this.totalMoney() < gCost) return alert('Not enough money');
      g.busy = true;
      auxBtn.disabled = true;
      btn.disabled = true;
      this.spendMoney(gCost);
      this.runProgress(auxProg, 3000, () => {
        this.showGangsterTypeSelection(choice => {
          const n = { id: state.nextGangId++, type: choice, busy: false, personalHeat: 0, stats: this.defaultStatsForType(choice) };
          state.gangsters.push(n);
          g.busy = false;
          auxBtn.disabled = false;
          btn.disabled = false;
          this.updateUI();
          this.renderCards();
        });
      });
    };

    // Face community action: Promotional Campaign (costs clean money)
    if (rep) {
      rep.onclick = () => {
        if (g.busy) return;
        const cost = 50;
        if (state.cleanMoney < cost) return alert('Not enough clean money');
        g.busy = true;
        btn.disabled = true;
        auxBtn.disabled = true;
        rep.disabled = true;
        state.cleanMoney -= cost;
        this.runProgress(repProg, 4000, () => {
          state.respect += 1;
          g.personalHeat = (g.personalHeat || 0) + 0; // PR action, no heat
          g.busy = false;
          btn.disabled = false;
          auxBtn.disabled = false;
          rep.disabled = false;
        });
      };
    }
  }

  _bindBrainHandlers(g) {
    const state = this.state;
    const { primary: btn, primaryProg: prog, aux: auxBtn, auxProg, fear: fearBtn, fearProg, rep, repProg } = g.ui;
    btn.onclick = () => {
      if (g.busy) return;
      if (state.businesses - state.illicit - state.illicitProgress <= 0) return alert('No available fronts');
      g.busy = true;
      btn.disabled = true;
      auxBtn.disabled = true;
      state.illicitProgress += 1;
      this.updateUI();
      this.runProgress(prog, 4000, () => {
        state.illicitProgress -= 1;
        this.showIllicitBusinessSelection(choice => {
          state.illicitCounts[choice] += 1;
          state.illicit += 1;
          g.personalHeat = (g.personalHeat || 0) + 1;
          g.busy = false;
          btn.disabled = false;
          auxBtn.disabled = false;
          if (g.ui.heatLabel) g.ui.heatLabel.textContent = `Heat: ${g.personalHeat}`;
          this.updateUI();
        });
      });
    };

    auxBtn.onclick = () => {
      if (g.busy) return;
      if (!state.unlockedBusiness) return alert('No territory yet');
      const cost = this.businessCost();
      if (this.totalMoney() < cost) return alert('Not enough money');
      g.busy = true;
      auxBtn.disabled = true;
      btn.disabled = true;
      this.spendMoney(cost);
      this.runProgress(auxProg, 5000, () => {
        state.businesses += 1;
        state.unlockedIllicit = true;
        state.respect += 1;
        g.busy = false;
        auxBtn.disabled = false;
        btn.disabled = false;
      });
    };

    if (fearBtn) {
      fearBtn.onclick = () => {
        if (g.busy) return;
        if (!(state.unlockedBusiness || state.unlockedIllicit)) return;
        if (state.dirtyMoney < 100) return alert('Not enough dirty money');
        g.busy = true;
        btn.disabled = true;
        auxBtn.disabled = true;
        fearBtn.disabled = true;
        state.dirtyMoney -= 100;
        this.runProgress(fearProg, 5000, () => {
          const bonus = this.respectLevel() * 0.1;
          state.cleanMoney += Math.round(80 * (1 + bonus));
          g.busy = false;
          btn.disabled = false;
          auxBtn.disabled = false;
          fearBtn.disabled = false;
        });
      };
    }

    // Brain community action: Donate to Soup Kitchen
    if (rep) {
      rep.onclick = () => {
        if (g.busy) return;
        const cost = 40;
        if (state.cleanMoney < cost) return alert('Not enough clean money');
        g.busy = true;
        btn.disabled = true;
        auxBtn.disabled = true;
        if (fearBtn) fearBtn.disabled = true;
        rep.disabled = true;
        state.cleanMoney -= cost;
        this.runProgress(repProg, 4000, () => {
          state.respect += 1;
          if (state.heat > 0) state.heat -= 1;
          g.busy = false;
          btn.disabled = false;
          auxBtn.disabled = false;
          if (fearBtn) fearBtn.disabled = false;
          rep.disabled = false;
        });
      };
    }
  }

  _bindFistHandlers(g) {
    const state = this.state;
    const { primary: btn, primaryProg: prog, aux: auxBtn, auxProg, fear: fearBtn, fearProg, rep, repProg } = g.ui;
    btn.onclick = () => {
      if (g.busy) return;
      const cost = this.enforcerCost();
      if (this.totalMoney() < cost) return alert('Not enough money');
      g.busy = true;
      btn.disabled = true;
      auxBtn.disabled = true;
      fearBtn.disabled = true;
      this.spendMoney(cost);
      this.runProgress(prog, 2000, () => {
        state.patrol += 1;
        state.unlockedGangster = true;
        g.busy = false;
        btn.disabled = false;
        auxBtn.disabled = false;
        fearBtn.disabled = false;
        if (rep) rep.disabled = false;
      });
    };

    auxBtn.onclick = () => {
      if (g.busy) return;
      g.busy = true;
      btn.disabled = true;
      auxBtn.disabled = true;
      fearBtn.disabled = true;
      if (rep) rep.disabled = true;
      this.runProgress(auxProg, 5000, () => {
        state.dirtyMoney += 150;
        state.heat += 1;
        g.personalHeat = (g.personalHeat || 0) + 2;
        g.busy = false;
        btn.disabled = false;
        auxBtn.disabled = false;
        fearBtn.disabled = false;
        if (rep) rep.disabled = false;
        if (g.ui.heatLabel) g.ui.heatLabel.textContent = `Heat: ${g.personalHeat}`;
      });
    };

    fearBtn.onclick = () => {
      if (g.busy) return;
      g.busy = true;
      btn.disabled = true;
      auxBtn.disabled = true;
      fearBtn.disabled = true;
      if (rep) rep.disabled = true;
      this.runProgress(fearProg, 3000, () => {
        if (state.disagreeableOwners > 0) state.disagreeableOwners -= 1;
        state.fear += 1;
        g.personalHeat = (g.personalHeat || 0) + 1;
        g.busy = false;
        btn.disabled = false;
        auxBtn.disabled = false;
        fearBtn.disabled = false;
        if (rep) rep.disabled = false;
        if (g.ui.heatLabel) g.ui.heatLabel.textContent = `Heat: ${g.personalHeat}`;
      });
    };

    // Fist community action: Vigilante Patrol
    if (rep) {
      rep.onclick = () => {
        if (g.busy) return;
        g.busy = true;
        btn.disabled = true;
        auxBtn.disabled = true;
        fearBtn.disabled = true;
        rep.disabled = true;
        this.runProgress(repProg, 3000, () => {
          state.respect += 1;
          state.heat += 1; // Some heat from vigilantism
          g.personalHeat = (g.personalHeat || 0) + 1;
          g.busy = false;
          btn.disabled = false;
          auxBtn.disabled = false;
          fearBtn.disabled = false;
          rep.disabled = false;
          if (g.ui.heatLabel) g.ui.heatLabel.textContent = `Heat: ${g.personalHeat}`;
        });
      };
    }
  }

  _updateGangsterRow(g) {
    const state = this.state;
    const ui = g.ui;
    if (!ui) return;
    if (g.type === 'face') {
      ui.primary.textContent = `Face #${g.id} Extort`;
      ui.primary.disabled = g.busy;
      ui.aux.textContent = `Face #${g.id} Recruit Gangster`;
      ui.aux.disabled = g.busy || !state.unlockedGangster;
      if (ui.rep) {
        ui.rep.textContent = `Face #${g.id} Promotional Campaign (-$50 clean)`;
        ui.rep.disabled = g.busy || state.cleanMoney < 50;
      }
    } else if (g.type === 'brain') {
      ui.primary.textContent = `Brain #${g.id} Build Illicit`;
      const avail = state.businesses - state.illicit - state.illicitProgress;
      ui.primary.disabled = g.busy || !state.unlockedIllicit || avail <= 0;
      ui.aux.textContent = `Brain #${g.id} Buy Business`;
      ui.aux.disabled = g.busy || !state.unlockedBusiness;
      const showLaunder = state.unlockedBusiness || state.unlockedIllicit;
      if (ui.fear) {
        ui.fear.textContent = `Brain #${g.id} Launder Money`;
        ui.fear.classList.toggle('hidden', !showLaunder);
        if (!showLaunder && ui.fearProg) ui.fearProg.classList.add('hidden');
        ui.fear.disabled = g.busy || state.dirtyMoney < 100;
      }
      if (ui.rep) {
        ui.rep.textContent = `Brain #${g.id} Donate to Soup Kitchen (-$40 clean)`;
        ui.rep.disabled = g.busy || state.cleanMoney < 40;
      }
    } else if (g.type === 'fist') {
      ui.primary.textContent = `Fist #${g.id} Recruit Enforcer`;
      ui.primary.disabled = g.busy || !state.unlockedEnforcer;
      ui.aux.textContent = `Fist #${g.id} Raid Business`;
      ui.aux.disabled = g.busy;
      if (ui.fear) {
        ui.fear.textContent = `Fist #${g.id} Intimidate`;
        ui.fear.disabled = g.busy;
      }
      if (ui.rep) {
        ui.rep.textContent = `Fist #${g.id} Vigilante Patrol`;
        ui.rep.disabled = g.busy;
      }
    }
    if (ui.heatLabel) ui.heatLabel.textContent = `Heat: ${g.personalHeat || 0}`;
  }

  payCops() {
    if (this.totalMoney() < 50) return alert('Not enough money');
    document.getElementById('payCops').disabled = true;
    this.spendMoney(50);
    this.runProgress(document.getElementById('payCopsProgress'), 3000, () => {
      this.state.heat = Math.max(0, this.state.heat - 1);
      document.getElementById('payCops').disabled = false;
      if (this.state.heat === 0) document.getElementById('payCops').classList.add('hidden');
    });
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
// Boss card (2/2/2)
const boss = this.state.boss || (this.state.boss = { busy: false, personalHeat: 0, stats: { face: 2, fist: 2, brain: 2 } });
if (!boss.stats) boss.stats = { face: 2, fist: 2, brain: 2 };
const bossEl = document.createElement('div');
bossEl.className = 'card' + (boss.busy ? ' busy' : '');
bossEl.setAttribute('draggable', boss.busy ? 'false' : 'true');
bossEl.dataset.gid = 'boss';
const bstats = boss.stats;
bossEl.innerHTML = `<div><strong>BOSS</strong></div>
  <div>Heat: ${boss.personalHeat || 0}</div>
  <div>F:${bstats.fist} Fa:${bstats.face} Br:${bstats.brain}</div>`;
bossEl.addEventListener('dragstart', ev => {
  if (boss.busy) { ev.preventDefault(); return; }
  ev.dataTransfer.setData('text/plain', 'boss');
  ev.dataTransfer.effectAllowed = 'move';
});
area.appendChild(bossEl);
s.gangsters.forEach(g => {
  this._ensureGangsterStats(g);
  const el = document.createElement('div');
  el.className = 'card' + (g.busy ? ' busy' : '');
  el.setAttribute('draggable', g.busy ? 'false' : 'true');
  el.dataset.gid = String(g.id);
  const stats = g.stats || { face: 1, fist: 1, brain: 1 };
  el.innerHTML = `<div><strong>${g.type.toUpperCase()} #${g.id}</strong></div>
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
const blocks = [
  { id: 'actRecruitEnforcer', label: 'Recruit Enforcer (Fist)', stat: 'fist', base: 2000, handler: (g, progEl, dur) => this._actRecruitEnforcer(g, progEl, dur) },
  { id: 'actBuyBusiness', label: 'Buy Business (Brain)', stat: 'brain', base: 5000, handler: (g, progEl, dur) => this._actBuyBusiness(g, progEl, dur) },
  { id: 'actLaunder', label: 'Launder $100 (Brain)', stat: 'brain', base: 4000, handler: (g, progEl, dur) => this._actLaunder(g, progEl, dur) },
  { id: 'actPromo', label: 'Promotional Campaign (Face)', stat: 'face', base: 3000, handler: (g, progEl, dur) => this._actPromo(g, progEl, dur) },
  { id: 'actVigilante', label: 'Vigilante Patrol (Fist)', stat: 'fist', base: 3000, handler: (g, progEl, dur) => this._actVigilante(g, progEl, dur) },
  { id: 'actRaid', label: 'Raid Business (Fist)', stat: 'fist', base: 3500, handler: (g, progEl, dur) => this._actRaid(g, progEl, dur) },
  { id: 'actExtort', label: 'Extort (Face)', stat: 'face', base: 4000, handler: (g, progEl, dur) => this._actExtort(g, progEl, dur) },
  { id: 'actBuildIllicit', label: 'Build Illicit (Brain)', stat: 'brain', base: 4000, handler: (g, progEl, dur) => this._actBuildIllicit(g, progEl, dur) },
  { id: 'actHireGangster', label: 'Hire Gangster (Face)', stat: 'face', base: 3000, handler: (g, progEl, dur) => this._actHireGangster(g, progEl, dur) },
  { id: 'actPayCops', label: 'Pay Cops -$50', stat: 'brain', base: 3000, handler: (g, progEl, dur) => this._actPayCops(g, progEl, dur) },
  { id: 'actDonate', label: 'Donate to Soup Kitchen (Brain)', stat: 'brain', base: 4000, handler: (g, progEl, dur) => this._actDonate(g, progEl, dur) },
  { id: 'actIntimidate', label: 'Intimidate (Fist)', stat: 'fist', base: 3000, handler: (g, progEl, dur) => this._actIntimidate(g, progEl, dur) },
];
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
    let g = null;
    if (idStr === 'boss') {
      g = this.state.boss;
      if (!g.stats) g.stats = { face: 2, fist: 2, brain: 2 };
      g.type = 'boss';
    } else {
      const gid = parseInt(idStr, 10);
      g = this.state.gangsters.find(x => x.id === gid);
    }
    if (!g || g.busy) return;
    const dur = this.durationWithStat(b.base, b.stat, g);
    const ok = b.handler(g, prog, dur);
    if (!ok) this._cardMsg('Cannot start action.');
  });
  area.appendChild(el);
});
}

_cardMsg(txt) { if (this.cardEls && this.cardEls.msg) this.cardEls.msg.textContent = txt; }

_startCardWork(g, progEl, durMs, onDone) {
g.busy = true;
this.renderCards();
this.runProgress(progEl, durMs, () => {
  try { onDone && onDone(); } finally { g.busy = false; this.renderCards(); this.updateUI(); }
});
return true;
}

_actRecruitEnforcer(g, progEl, dur) {
const cost = this.enforcerCost ? this.enforcerCost() : 20;
if (this.totalMoney() < cost) { this._cardMsg('Not enough money'); return false; }
this.spendMoney(cost);
return this._startCardWork(g, progEl, dur, () => { this.state.patrol += 1; });
}

_actBuyBusiness(g, progEl, dur) {
const cost = this.businessCost ? this.businessCost() : 100;
if (this.totalMoney() < cost) { this._cardMsg('Not enough money'); return false; }
this.spendMoney(cost);
return this._startCardWork(g, progEl, dur, () => { this.state.businesses += 1; });
}

_actLaunder(g, progEl, dur) {
if (this.state.dirtyMoney < 100) { this._cardMsg('Need $100 dirty'); return false; }
this.state.dirtyMoney -= 100;
return this._startCardWork(g, progEl, dur, () => {
  const base = 80;
  const bonus = Math.floor(base * 0.1 * this.respectLevel());
  this.state.cleanMoney += base + bonus;
  g.personalHeat = (g.personalHeat || 0) + 1;
});
}

_actPromo(g, progEl, dur) {
if (this.state.cleanMoney < 50) { this._cardMsg('Need $50 clean'); return false; }
this.state.cleanMoney -= 50;
return this._startCardWork(g, progEl, dur, () => { this.state.respect += 1; });
}

_actVigilante(g, progEl, dur) {
return this._startCardWork(g, progEl, dur, () => {
  this.state.respect += 1;
  this.state.heat += 1;
  g.personalHeat = (g.personalHeat || 0) + 1;
});
}

_actExtort(g, progEl, dur) {
  // Face-like extort: gain territory or disagreeable owner
  return this._startCardWork(g, progEl, dur, () => {
    if (Math.random() < this.DISAGREEABLE_CHANCE) {
      this.state.disagreeableOwners += 1;
    } else {
      this.state.territory += 1;
    }
    g.personalHeat = (g.personalHeat || 0) + 1;
  });
}

_actBuildIllicit(g, progEl, dur) {
  const s = this.state;
  const avail = s.businesses - s.illicit;
  if (avail <= 0) { this._cardMsg('No available fronts'); return false; }
  return this._startCardWork(g, progEl, dur, () => {
    // Reuse existing selection modal if available; otherwise default to 'counterfeiting'
    if (typeof this.showIllicitBusinessSelection === 'function') {
      this.showIllicitBusinessSelection(choice => {
        s.illicitCounts[choice] += 1;
        s.illicit += 1;
        g.personalHeat = (g.personalHeat || 0) + 1;
        this.updateUI();
      });
    } else {
      s.illicitCounts.counterfeiting += 1;
      s.illicit += 1;
      g.personalHeat = (g.personalHeat || 0) + 1;
    }
  });
}

_actHireGangster(g, progEl, dur) {
  const s = this.state;
  const cost = this.gangsterCost ? this.gangsterCost() : 0;
  if (this.totalMoney() < cost) { this._cardMsg('Not enough money'); return false; }
  this.spendMoney(cost);
  return this._startCardWork(g, progEl, dur, () => {
    if (typeof this.showGangsterTypeSelection === 'function') {
      this.showGangsterTypeSelection(choice => {
        const n = { id: s.nextGangId++, type: choice, busy: false, personalHeat: 0, stats: this.defaultStatsForType(choice) };
        s.gangsters.push(n);
        this.renderCards();
      });
    } else {
      const choice = 'fist';
      const n = { id: s.nextGangId++, type: choice, busy: false, personalHeat: 0, stats: this.defaultStatsForType(choice) };
      s.gangsters.push(n);
      this.renderCards();
    }
  });
}

_actPayCops(g, progEl, dur) {
  if (this.totalMoney() < 50) { this._cardMsg('Not enough money'); return false; }
  this.spendMoney(50);
  return this._startCardWork(g, progEl, dur, () => {
    this.state.heat = Math.max(0, this.state.heat - 1);
  });
}

_actDonate(g, progEl, dur) {
  if (this.state.cleanMoney < 40) { this._cardMsg('Need $40 clean'); return false; }
  this.state.cleanMoney -= 40;
  return this._startCardWork(g, progEl, dur, () => {
    this.state.respect += 1;
    if (this.state.heat > 0) this.state.heat -= 1;
  });
}

_actIntimidate(g, progEl, dur) {
  return this._startCardWork(g, progEl, dur, () => {
    if (this.state.disagreeableOwners > 0) this.state.disagreeableOwners -= 1;
    this.state.fear = (this.state.fear || 0) + 1;
    g.personalHeat = (g.personalHeat || 0) + 1;
  });
}

_actRaid(g, progEl, dur) {
  return this._startCardWork(g, progEl, dur, () => {
    const haul = 150; // base dirty cash from raid
    this.state.dirtyMoney += haul;
    this.state.heat += 2;
    g.personalHeat = (g.personalHeat || 0) + 2;
  });
}

}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
