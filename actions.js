// Declarative action registry for card UI
// Each action: { id, label, stat, base, handler(game, gangster, progressEl, durationMs) }

export const ACTIONS = [
  { id: 'actRecruitEnforcer', label: 'Recruit Enforcer (Fist)', stat: 'fist', base: 2000,
    cost: (game) => {
      const cost = game.enforcerCost ? game.enforcerCost() : 20;
      if (game.totalMoney() < cost) return false;
      game.spendMoney(cost);
      return true;
    },
    effect: (game) => { game.state.patrol += 1; } },
  { id: 'actBuyBusiness', label: 'Buy Business (Brain)', stat: 'brain', base: 5000,
    cost: (game) => {
      const cost = game.businessCost ? game.businessCost() : 0;
      if (game.totalMoney() < cost) return false;
      game.spendMoney(cost);
      return true;
    },
    effect: (game) => {
      game.state.businesses += 1;
      game.state.unlockedIllicit = true;
      game.state.respect += 1;
      game.updateUI();
    } },
  { id: 'actLaunder', label: 'Launder $100 (Brain)', stat: 'brain', base: 4000,
    cost: (game) => {
      if ((game.state.dirtyMoney || 0) < 100) return false;
      game.state.dirtyMoney -= 100;
      return true;
    },
    effect: (game, g) => {
      const base = 80;
      const bonus = Math.floor(base * 0.1 * game.respectLevel());
      game.state.cleanMoney += base + bonus;
      g.personalHeat = (g.personalHeat || 0) + 1;
    } },
  { id: 'actPromo', label: 'Promotional Campaign (Face)', stat: 'face', base: 3000,
    cost: (game) => {
      if ((game.state.cleanMoney || 0) < 50) return false;
      game.state.cleanMoney -= 50;
      return true;
    },
    effect: (game) => { game.state.respect += 1; } },
  { id: 'actVigilante', label: 'Vigilante Patrol (Fist)', stat: 'fist', base: 3000,
    effect: (game, g) => {
      game.state.respect += 1;
      game.state.heat += 1;
      g.personalHeat = (g.personalHeat || 0) + 1;
    } },
  { id: 'actRaid', label: 'Raid Business (Fist)', stat: 'fist', base: 3500,
    effect: (game, g) => {
      game.state.dirtyMoney += 150;
      game.state.heat += 2;
      g.personalHeat = (g.personalHeat || 0) + 2;
    } },
  { id: 'actExtort', label: 'Extort (Face)', stat: 'face', base: 4000,
    effect: (game, g) => {
      if (Math.random() < game.DISAGREEABLE_CHANCE) {
        game.state.disagreeableOwners += 1;
      } else {
        game.state.territory += 1;
      }
      g.personalHeat = (g.personalHeat || 0) + 1;
    } },
  { id: 'actBuildIllicit', label: 'Build Illicit (Brain)', stat: 'brain', base: 4000,
    prereq: (game) => (game.state.businesses - game.state.illicit) > 0,
    effect: (game, g) => {
      const s = game.state;
      if (typeof game.showIllicitBusinessSelection === 'function') {
        game.showIllicitBusinessSelection(choice => {
          s.illicitCounts[choice] += 1;
          s.illicit += 1;
          g.personalHeat = (g.personalHeat || 0) + 1;
          game.updateUI();
        });
      } else {
        s.illicitCounts.counterfeiting += 1;
        s.illicit += 1;
        g.personalHeat = (g.personalHeat || 0) + 1;
      }
    } },
  { id: 'actHireGangster', label: 'Hire Gangster (Face)', stat: 'face', base: 3000,
    cost: (game) => {
      const cost = game.gangsterCost ? game.gangsterCost() : 0;
      if (game.totalMoney() < cost) return false;
      game.spendMoney(cost);
      return true;
    },
    effect: (game) => {
      game.showGangsterTypeSelection(choice => {
        const g = { id: game.state.nextGangId++, type: choice, name: undefined, busy: false, personalHeat: 0, stats: game.defaultStatsForType(choice) };
        game.state.gangsters.push(g);
        game.updateUI();
        game.renderCards();
      });
    } },
  // Procure Equipment: lets player choose an equipment card to add to inventory
  { id: 'actProcureEquipment', label: 'Procure Equipment (Brain)', stat: 'brain', base: 3000,
    cost: { money: 20 },
    effect: (game) => {
      if (typeof game.showEquipmentSelection === 'function') {
        game.showEquipmentSelection(type => {
          const item = { id: game.state.nextEquipId++, type };
          if (!Array.isArray(game.state.inventory)) game.state.inventory = [];
          game.state.inventory.push(item);
          game.updateUI();
          game.renderCards();
        });
      } else {
        // Fallback: add a pistol if modal not available
        const item = { id: game.state.nextEquipId++, type: 'pistol' };
        if (!Array.isArray(game.state.inventory)) game.state.inventory = [];
        game.state.inventory.push(item);
      }
    } },
  { id: 'actPayCops', label: 'Pay Cops -$50', stat: 'brain', base: 3000,
    cost: { money: 50 },
    effect: (game) => {
      game.state.heat = Math.max(0, (game.state.heat || 0) - 1);
      game.updateUI();
    } },
  { id: 'actDonate', label: 'Donate to Soup Kitchen (Brain)', stat: 'brain', base: 4000,
    cost: (game) => {
      if ((game.state.cleanMoney || 0) < 40) return false;
      game.state.cleanMoney -= 40;
      return true;
    },
    effect: (game) => {
      game.state.respect += 1;
      if (game.state.heat > 0) game.state.heat -= 1;
    } },
  { id: 'actIntimidate', label: 'Intimidate (Fist)', stat: 'fist', base: 3000,
    effect: (game, g) => {
      if (game.state.disagreeableOwners > 0) game.state.disagreeableOwners -= 1;
      game.state.fear = (game.state.fear || 0) + 1;
      g.personalHeat = (g.personalHeat || 0) + 1;
    } },
];
