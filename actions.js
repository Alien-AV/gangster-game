import { Deck } from './deck.js';
import { startCountdown } from './progress-ring.js';
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
    requires: { stat: 'fist', min: 3 },
    effect: (game, g) => {
      game.state.respect += 1;
      game.state.fear = (game.state.fear || 0) + 1;
      game.state.heat += 2;
      g.personalHeat = (g.personalHeat || 0) + 2;
    } },
  { id: 'actRaid', label: 'Raid Business (Fist)', stat: 'fist', base: 3500,
    requires: { stat: 'fist', min: 2 },
    effect: (game, g, targetEl, targetItem) => {
      game.state.dirtyMoney += 1500;
      game.state.heat += 2;
      if (g) g.personalHeat = (g.personalHeat || 0) + 2;
      if (targetItem && targetEl) {
        const wrap = targetEl.closest && targetEl.closest('.ring-wrap');
        const nowSec = (game.state.time || 0);
        const nowMs = Date.now();
        targetItem.cooldownTotal = 60;
        targetItem.cooldownUntil = nowSec + targetItem.cooldownTotal;
        targetItem.cooldownStartMs = nowMs;
        targetItem.cooldownEndMs = nowMs + targetItem.cooldownTotal * 1000;
        if (wrap) {
          try {
            startCountdown(wrap, {
              startMs: targetItem.cooldownStartMs,
              endMs: targetItem.cooldownEndMs,
              mode: 'cooldown',
              showBadge: false,
              onTick: (_p, remaining) => {
                const sec = Math.max(0, Math.ceil(remaining / 1000));
                if (targetItem && targetItem._dynEl) { try { targetItem._dynEl.textContent = `Recovers in ${sec}s`; } catch(e){} }
              },
              onDone: () => {
                try {
                  wrap.classList.remove('cooldown-active');
                  wrap.style.removeProperty('--p');
                  const banner = targetEl.querySelector && targetEl.querySelector('.world-card-center-badge.badge-recover');
                  if (banner) { try { banner.remove(); } catch(e){} }
                } catch(e){}
                targetItem.cooldownUntil = 0;
                targetItem.cooldownStartMs = 0;
                targetItem.cooldownEndMs = 0;
                game.updateCardDynamic(targetItem);
              }
            });
          } catch(e){}
        }
      }
      game.spawnTableCard('heat');
    } },
  { id: 'actExtort', label: 'Extort (Face)', stat: 'face', base: 4000,
    effect: (game, g, targetEl, targetItem) => {
      const tableCards = game.state.table.cards;
      const idx = tableCards.indexOf(targetItem);
      game._extortAttemptCount = (game._extortAttemptCount || 0) + 1;
      const forceFail = (game._extortAttemptCount === 2);
      if (g) g.personalHeat = (g.personalHeat || 0) + 1;
      if (forceFail) {
        const owner = { id: 'disagreeable_owner', name: 'Disagreeable Owner', type: 'owner', reusable: false, img: 'images/disagreeable-owner.png' };
        if (idx >= 0) tableCards.splice(idx, 1);
        tableCards.push(owner);
        if (targetItem && targetItem.uid) game.removeCardByUid(targetItem.uid);
        { const nidx = tableCards.indexOf(owner); game.ensureCardNode(owner, nidx); }
        game.state.disagreeableOwners = (game.state.disagreeableOwners || 0) + 1;
      } else {
        let xb = tableCards.find(x => x.id === 'extorted_business');
        if (!xb) {
          xb = { id: 'extorted_business', name: 'Extorted Businesses', type: 'extorted_business', reusable: true, data: { count: 1 }, img: 'images/extorted-business.png' };
          if (idx >= 0) tableCards.splice(idx, 1);
          tableCards.push(xb);
          if (targetItem && targetItem.uid) game.removeCardByUid(targetItem.uid);
          { const nidx = tableCards.indexOf(xb); game.ensureCardNode(xb, nidx); }
        } else {
          xb.data = xb.data || {}; xb.data.count = (xb.data.count || 0) + 1;
          if (idx >= 0) {
            tableCards.splice(idx, 1);
            if (targetItem && targetItem.uid) game.removeCardByUid(targetItem.uid);
          }
          { const nidx = tableCards.indexOf(xb); game.ensureCardNode(xb, nidx); }
        }
        game.state.extortedBusinesses = (game.state.extortedBusinesses || 0) + 1;
      }
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
  { id: 'actForgeAlibi', label: 'Buy Alibi (Brain)', stat: 'brain', base: 3500,
    requires: { stat: 'face', min: 2 },
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
