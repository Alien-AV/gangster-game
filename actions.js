import { Deck } from './deck.js';
// Declarative action registry for card UI
// Each action: { id, label, stat, base, handler(game, gangster, progressEl, durationMs) }

export const ACTIONS = [
  // Unified Explore for any deck-like card: expects item.data.exploreIds
  { id: 'actExploreDeck', label: 'Explore (Brain)', stat: 'brain', base: 3500,
    effect: (game, g, targetEl) => {
      // Identify which deck to draw from (card id on the DOM), then use deck system
      const wrap = targetEl && targetEl.closest ? targetEl.closest('.ring-wrap') : null;
      const cardEl = wrap ? wrap.querySelector('.world-card') : targetEl;
      if (!cardEl || !cardEl.dataset || !cardEl.dataset.cardId) return;
      // Use deck model: ensure deck exists with start/pool/end seeded from the deck card
      const deckId = cardEl.dataset.cardId;
      game._decks = game._decks || {};
      if (!game._decks[deckId]) {
        const idsStr = cardEl.dataset.exploreIds || '';
        const pool = idsStr.split(',').map(s => s.trim()).filter(Boolean);
        // Neighborhood retains a final city_entrance in end per initTable; others empty end
        const end = (deckId === 'neighborhood') ? ['city_entrance'] : [];
        game._decks[deckId] = new Deck({ start: [], pool, end });
      }
      // Draw one group (one or more ids), respecting start → pool(shuffled) → end, and exhaustion
      game.drawFromDeck(deckId);
      if (g) g.personalHeat = (g.personalHeat || 0) + 1;
      game.updateUI();
    }
  },
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
  { id: 'actLaunder', label: 'Launder $1000 (Brain)', stat: 'brain', base: 4000,
    cost: (game) => {
      if ((game.state.dirtyMoney || 0) < 1000) return false;
      game.state.dirtyMoney -= 1000;
      return true;
    },
    effect: (game, g) => {
      const base = 800;
      const bonus = Math.floor(base * 0.1 * game.respectLevel());
      game.state.cleanMoney += base + bonus;
      g.personalHeat = (g.personalHeat || 0) + 1;
    } },
  { id: 'actPromo', label: 'Promotional Campaign (Face)', stat: 'face', base: 3000,
    cost: (game) => {
      if ((game.state.dirtyMoney || 0) < 500) return false;
      game.state.dirtyMoney -= 500;
      return true;
    },
    effect: (game) => { game.state.respect += 1; } },
  { id: 'actVigilante', label: 'Vigilante Patrol (Fist)', stat: 'fist', base: 3000,
    effect: (game, g) => {
      game.state.respect += 1;
      game.state.fear = (game.state.fear || 0) + 1;
      game.state.heat += 1;
      g.personalHeat = (g.personalHeat || 0) + 1;
    } },
  { id: 'actRaid', label: 'Raid Business (Fist)', stat: 'fist', base: 3500,
    effect: (game, g) => {
      game.state.dirtyMoney += 1500;
      game.state.heat += 2;
      g.personalHeat = (g.personalHeat || 0) + 2;
    } },
  { id: 'actExtort', label: 'Extort (Face)', stat: 'face', base: 4000,
    effect: (game, g) => {
      if (Math.random() < game.DISAGREEABLE_CHANCE) {
        game.state.disagreeableOwners += 1;
      } else {
        game.state.extortedBusinesses = (game.state.extortedBusinesses || 0) + 1;
      }
      g.personalHeat = (g.personalHeat || 0) + 1;
    } },
  { id: 'actBuildIllicit', label: 'Build Illicit (Brain)', stat: 'brain', base: 4000,
    prereq: (game) => (game.state.businesses - game.state.illicit) > 0,
    effect: (game, g) => {
      const s = game.state;
      game.showIllicitBusinessSelection(choice => {
        s.illicitCounts[choice] += 1;
        s.illicit += 1;
        g.personalHeat = (g.personalHeat || 0) + 1;
        game.updateUI();
      });
    } },
  { id: 'actHireGangster', label: 'Hire Gangster (Face)', stat: 'face', base: 3000,
    cost: (game) => {
      const cost = game.gangsterCost ? game.gangsterCost() : 0;
      if (game.totalMoney() < cost) return false;
      game.spendMoney(cost);
      return true;
    },
    effect: (game) => {
      // Legacy modal removed; default to Face until explicit choices are reintroduced via UI
      const type = 'face';
      const g = { id: game.state.nextGangId++, type, name: undefined, busy: false, personalHeat: 0, stats: game.defaultStatsForType(type) };
      game.state.gangsters.push(g);
      game.updateUI();
    } },
  // Procure Equipment: lets player choose an equipment card to add to inventory
  { id: 'actProcureEquipment', label: 'Procure Equipment (Brain)', stat: 'brain', base: 3000,
    cost: { money: 200 },
    effect: (game) => {
      if (!Array.isArray(game.state.inventory)) game.state.inventory = [];
      const nextId = (game.state.nextEquipId || 1);
      const item = { id: nextId, type: 'pistol' };
      game.state.nextEquipId = nextId + 1;
      game.state.inventory.push(item);
      game.updateUI();
    } },
  { id: 'actPayCops', label: 'Pay Cops -$500', stat: 'brain', base: 3000,
    cost: { money: 500 },
    effect: (game) => {
      game.state.heat = Math.max(0, (game.state.heat || 0) - 1);
      game.updateUI();
    } },
  { id: 'actDonate', label: 'Donate to Soup Kitchen (Brain)', stat: 'brain', base: 4000,
    cost: (game) => {
      if ((game.state.cleanMoney || 0) < 400) return false;
      game.state.cleanMoney -= 400;
      return true;
    },
    effect: (game) => {
      game.state.respect += 1;
      if (game.state.heat > 0) game.state.heat -= 1;
    } },
  { id: 'actForgeAlibi', label: 'Forge Fake Alibi (Brain)', stat: 'brain', base: 3500,
    cost: { money: 500 },
    effect: (game) => {
      game.spawnTableCard('fake_alibi');
      game.updateUI();
    } },
  { id: 'actIntimidate', label: 'Intimidate (Fist)', stat: 'fist', base: 3000,
    effect: (game, g) => {
      if (game.state.disagreeableOwners > 0) game.state.disagreeableOwners -= 1;
      game.state.fear = (game.state.fear || 0) + 1;
      g.personalHeat = (g.personalHeat || 0) + 1;
      game.spawnTableCard('heat');
    } },
];
