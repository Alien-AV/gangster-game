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
    };
    this.DISAGREEABLE_CHANCE = 0.2;

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

    this.loadState();
    this.interval = setInterval(() => this.tick(), 1000);
  }

  saveState() {
    const s = this.state;
    const data = {
      time: s.time,
      cleanMoney: s.cleanMoney,
      dirtyMoney: s.dirtyMoney,
      patrol: s.patrol,
      territory: s.territory,
      heat: s.heat,
      heatProgress: s.heatProgress,
      disagreeableOwners: s.disagreeableOwners,
      fear: s.fear,
      businesses: s.businesses,
      unlockedEnforcer: s.unlockedEnforcer,
      unlockedGangster: s.unlockedGangster,
      unlockedBusiness: s.unlockedBusiness,
      illicitCounts: s.illicitCounts,
      illicit: s.illicit,
      illicitProgress: s.illicitProgress,
      unlockedIllicit: s.unlockedIllicit,
      boss: { busy: s.boss.busy },
      gangsters: s.gangsters.map(g => ({ id: g.id, specialty: g.specialty, busy: g.busy })),
      nextGangId: s.nextGangId,
    };
    localStorage.setItem('gameState', JSON.stringify(data));
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
      this.state.boss = { busy: false };
      this.state.gangsters = data.gangsters.map(g => ({ id: g.id, specialty: g.specialty, busy: false }));
    } catch (e) {
      console.error('Failed to load saved state', e);
    }
    this.updateUI();
  }

  totalMoney() {
    return this.state.cleanMoney + this.state.dirtyMoney;
  }

  fearLevel() {
    return Math.floor(this.state.fear / 5);
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
    const level = this.fearLevel();
    let bonusText = 'None';
    if (level > 0) {
      const extortBonus = level * 10;
      const enforcerCost = this.enforcerCost();
      const gangsterCost = this.gangsterCost();
      bonusText = `Extort ${extortBonus}% faster, Enforcer $${enforcerCost}, Gangster $${gangsterCost}`;
    }
    document.getElementById('fearBonus').textContent = bonusText;
    document.getElementById('businesses').textContent = s.businesses;
    const available = s.businesses - s.illicit - s.illicitProgress;
    document.getElementById('availableFronts').textContent = available;
    const faces = s.gangsters.filter(g => g.specialty === 'face').length;
    const fists = s.gangsters.filter(g => g.specialty === 'fist').length;
    const brains = s.gangsters.filter(g => g.specialty === 'brain').length;
    document.getElementById('faces').textContent = faces;
    document.getElementById('fists').textContent = fists;
    document.getElementById('brains').textContent = brains;
    document.getElementById('illicit').textContent = s.illicit;
    document.getElementById('counterfeitingCount').textContent = s.illicitCounts.counterfeiting;
    document.getElementById('drugCount').textContent = s.illicitCounts.drugs;
    document.getElementById('gamblingCount').textContent = s.illicitCounts.gambling;
    document.getElementById('fencingCount').textContent = s.illicitCounts.fencing;
    if (s.heat > 0) document.getElementById('payCops').classList.remove('hidden');
    this.renderBoss();
    this.renderGangsters();
    this.saveState();
  }

  runProgress(container, duration, callback) {
    const bar = container.querySelector('.progress-bar');
    container.classList.remove('hidden');
    bar.style.width = '0%';
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const percent = Math.min((elapsed / duration) * 100, 100);
      bar.style.width = percent + '%';
      if (elapsed >= duration) {
        clearInterval(interval);
        container.classList.add('hidden');
        callback();
        this.updateUI();
      }
    }, 100);
  }

  showGangsterTypeSelection(callback) {
    const container = document.getElementById('gangsterChoice');
    container.classList.remove('hidden');

    const choose = spec => {
      container.classList.add('hidden');
      document.getElementById('chooseFace').onclick = null;
      document.getElementById('chooseFist').onclick = null;
      document.getElementById('chooseBrain').onclick = null;
      callback(spec);
      this.updateUI();
    };

    document.getElementById('chooseFace').onclick = () => choose('face');
    document.getElementById('chooseFist').onclick = () => choose('fist');
    document.getElementById('chooseBrain').onclick = () => choose('brain');
  }

  showIllicitBusinessSelection(callback) {
    const container = document.getElementById('illicitChoice');
    container.classList.remove('hidden');

    const choose = type => {
      container.classList.add('hidden');
      document.getElementById('chooseCounterfeiting').onclick = null;
      document.getElementById('chooseDrugs').onclick = null;
      document.getElementById('chooseGambling').onclick = null;
      document.getElementById('chooseFencing').onclick = null;
      callback(type);
      this.updateUI();
    };

    document.getElementById('chooseCounterfeiting').onclick = () => choose('counterfeiting');
    document.getElementById('chooseDrugs').onclick = () => choose('drugs');
    document.getElementById('chooseGambling').onclick = () => choose('gambling');
    document.getElementById('chooseFencing').onclick = () => choose('fencing');
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
            const g = { id: state.nextGangId++, specialty: choice, busy: false };
            state.gangsters.push(g);
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

      businessBtn.onclick = () => {
        if (boss.busy) return;
        if (!state.unlockedBusiness) return alert('No territory yet');
        if (this.totalMoney() < 100) return alert('Not enough money');
        boss.busy = true;
        extortBtn.disabled = true;
        illicitBtn.disabled = true;
        recruitBtn.disabled = true;
        hireBtn.disabled = true;
        businessBtn.disabled = true;
        this.spendMoney(100);
        this.runProgress(businessProg, 5000, () => {
          state.businesses += 1;
          state.unlockedIllicit = true;
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
    const container = document.getElementById('gangstersContainer');
    state.gangsters.forEach(g => {
      if (!g.element) {
        const row = document.createElement('div');
        row.className = 'action';

        const label = document.createElement('span');
        label.style.marginRight = '4px';

        const select = document.createElement('select');
        select.style.marginRight = '4px';

        const btn = document.createElement('button');
        const prog = document.createElement('div');
        prog.className = 'progress hidden';
        prog.innerHTML = '<div class="progress-bar"></div>';

        row.appendChild(label);
        row.appendChild(select);
        row.appendChild(btn);
        row.appendChild(prog);

        g.element = row;
        g.label = label;
        g.select = select;
        g.button = btn;
        g.progress = prog;

        container.appendChild(row);
      }

      g.label.textContent = `Gangster #${g.id} (${g.specialty})`;

      const opts = [];
      opts.push({ value: 'extort', text: 'Extort' });
      if (state.unlockedGangster) opts.push({ value: 'recruitGangster', text: 'Recruit Gangster' });
      if (state.unlockedEnforcer) opts.push({ value: 'recruitEnforcer', text: 'Recruit Enforcer' });
      opts.push({ value: 'raid', text: 'Raid Business' });
      if (state.disagreeableOwners > 0) opts.push({ value: 'intimidate', text: 'Intimidate' });
      if (state.unlockedBusiness) opts.push({ value: 'buyBusiness', text: 'Buy Business' });
      if (state.unlockedIllicit && (state.businesses - state.illicit - state.illicitProgress) > 0) opts.push({ value: 'buildIllicit', text: 'Build Illicit' });
      if (state.unlockedBusiness || state.unlockedIllicit) opts.push({ value: 'launder', text: 'Launder Money' });

      const current = g.select.value;
      g.select.innerHTML = '';
      opts.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.text;
        g.select.appendChild(opt);
      });
      if (opts.some(o => o.value === current)) g.select.value = current;

      g.button.textContent = g.busy ? 'Working...' : 'Go';
      g.button.disabled = g.busy || opts.length === 0;

      if (!g.button._handler) {
        g.button.addEventListener('click', () => {
          if (g.busy) return;
          const action = g.select.value;
          if (!action) return;
          this.performGangsterAction(g, action);
        });
        g.button._handler = true;
      }
    });
  }

  performGangsterAction(g, action) {
    const state = this.state;
    const specialtyMap = {
      extort: 'face',
      recruitGangster: 'face',
      recruitEnforcer: 'fist',
      raid: 'fist',
      intimidate: 'fist',
      buyBusiness: 'brain',
      buildIllicit: 'brain',
      launder: 'brain',
    };
    const baseDurations = {
      extort: 4000,
      recruitGangster: 3000,
      recruitEnforcer: 2000,
      raid: 5000,
      intimidate: 3000,
      buyBusiness: 5000,
      buildIllicit: 4000,
      launder: 5000,
    };

    let duration = baseDurations[action] || 1000;
    if (specialtyMap[action] === g.specialty) duration = Math.floor(duration * 0.8);

    const finish = () => {
      g.busy = false;
      this.updateUI();
    };

    switch (action) {
      case 'extort':
        g.busy = true;
        this.runProgress(g.progress, this.extortDuration(duration), () => {
          if (Math.random() < this.DISAGREEABLE_CHANCE) {
            state.disagreeableOwners += 1;
          } else {
            state.territory += 1;
          }
          state.unlockedBusiness = true;
          finish();
        });
        break;
      case 'recruitGangster': {
        if (!state.unlockedGangster) return alert('Recruit enforcers first');
        const gCost = this.gangsterCost();
        if (this.totalMoney() < gCost) return alert('Not enough money');
        g.busy = true;
        this.spendMoney(gCost);
        this.runProgress(g.progress, duration, () => {
          this.showGangsterTypeSelection(choice => {
            const n = { id: state.nextGangId++, specialty: choice, busy: false };
            state.gangsters.push(n);
            finish();
          });
        });
        break;
      }
      case 'recruitEnforcer': {
        if (!state.unlockedEnforcer) return alert('Unlock enforcers first');
        const cost = this.enforcerCost();
        if (this.totalMoney() < cost) return alert('Not enough money');
        g.busy = true;
        this.spendMoney(cost);
        this.runProgress(g.progress, duration, () => {
          state.patrol += 1;
          state.unlockedGangster = true;
          finish();
        });
        break;
      }
      case 'raid':
        g.busy = true;
        this.runProgress(g.progress, duration, () => {
          state.dirtyMoney += 150;
          state.heat += 1;
          finish();
        });
        break;
      case 'intimidate':
        if (state.disagreeableOwners <= 0) return alert('No disagreeable owners');
        g.busy = true;
        this.runProgress(g.progress, duration, () => {
          state.disagreeableOwners -= 1;
          state.fear += 1;
          finish();
        });
        break;
      case 'buyBusiness':
        if (!state.unlockedBusiness) return alert('No territory yet');
        if (this.totalMoney() < 100) return alert('Not enough money');
        g.busy = true;
        this.spendMoney(100);
        this.runProgress(g.progress, duration, () => {
          state.businesses += 1;
          state.unlockedIllicit = true;
          finish();
        });
        break;
      case 'buildIllicit':
        if (!state.unlockedIllicit || (state.businesses - state.illicit - state.illicitProgress <= 0)) {
          return alert('No available fronts');
        }
        g.busy = true;
        state.illicitProgress += 1;
        this.updateUI();
        this.runProgress(g.progress, duration, () => {
          state.illicitProgress -= 1;
          this.showIllicitBusinessSelection(choice => {
            state.illicitCounts[choice] += 1;
            state.illicit += 1;
            finish();
          });
        });
        break;
      case 'launder':
        if (!(state.unlockedBusiness || state.unlockedIllicit)) return;
        if (state.dirtyMoney < 100) return alert('Not enough dirty money');
        g.busy = true;
        state.dirtyMoney -= 100;
        this.runProgress(g.progress, duration, () => {
          state.cleanMoney += 80;
          finish();
        });
        break;
    }
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
    this.updateUI();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});

