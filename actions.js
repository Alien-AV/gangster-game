import { Deck } from './deck.js';
import { scaleDurationMs } from './time.js';
import { startCountdown, clearRing } from './progress-ring.js';
// Declarative action registry for card UI
// Each action: { id, label, stat, base, handler(game, gangster, progressEl, durationMs) }

export const ACTIONS = [
  // Timed recruit from a recruit card
  { id: 'actRecruitFromCard', label: 'Recruit (Face)', stat: 'face', base: 2500,
    effect: (game, _g, _el, _it, ctx) => {
      ctx = ctx || {};
      const items = Array.isArray(ctx.stackItems) ? ctx.stackItems : [];
      const table = game.state.table; const cards = table && table.cards ? table.cards : [];
      const recruit = items.find(it => it && it.type === 'recruit');
      const t = (recruit && recruit.data && recruit.data.type) || 'face';
      // Consume the recruit card found in stack
      if (recruit) {
        const idx = cards.indexOf(recruit);
        if (idx >= 0) { cards.splice(idx, 1); if (recruit && recruit.uid) game.removeCardByUid(recruit.uid); }
      }
      // Spawn a gangster card directly
      const defId = (t === 'boss') ? 'boss' : ('gangster_' + t);
      const newCard = game.spawnTableCard(defId);
      if (newCard) newCard.stats = game.defaultStatsForType ? game.defaultStatsForType(t) : newCard.stats;
      if (Array.isArray(game.state.hireStack) && defId !== 'boss') game.state.hireStack.push({ t: 'gangster', ts: Date.now(), id: defId });
      game.updateUI();
    } },
  // Unified Explore for any deck-like card: expects item.data.exploreIds
  { id: 'actExploreDeck', label: 'Explore (Brain)', stat: 'brain', base: 3500,
    effect: (game, _g, _el, _it, ctx) => {
      ctx = ctx || {};
      const items = Array.isArray(ctx.stackItems) ? ctx.stackItems : [];
      // Identify deck card from stack
      const deckCard = items.find(it => it && it.data && it.data.deck === true);
      if (!deckCard) return;
      // Ensure deck exists
      const deckId = deckCard.id;
      game._decks = game._decks || {};
      if (!game._decks[deckId]) {
        const ids = (deckCard && deckCard.data && Array.isArray(deckCard.data.exploreIds)) ? deckCard.data.exploreIds.slice() : [];
        const end = (deckId === 'neighborhood') ? ['city_entrance'] : [];
        game._decks[deckId] = new Deck({ start: [], pool: ids, end });
      }
      game.drawFromDeck(deckId);
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
    effect: (game) => { game.state.patrol += 1; if (Array.isArray(game.state.hireStack)) game.state.hireStack.push({ t: 'enforcer', ts: Date.now() }); } },
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
  { id: 'actLaunder', label: 'Launder $1000', base: 4000,
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
  { id: 'actPromo', label: 'Promotional Campaign', base: 3000,
    cost: (game) => {
      if ((game.state.dirtyMoney || 0) < 500) return false;
      game.state.dirtyMoney -= 500;
      return true;
    },
    effect: (game) => { game.state.respect += 1; } },
  { id: 'actVigilante', label: 'Vigilante Patrol', base: 3000,
    requires: { stat: 'fist', min: 3 },
    effect: (game, g) => {
      game.state.respect += 1;
      game.state.fear = (game.state.fear || 0) + 1;
      game.state.heat += 2;
      if (g) g.personalHeat = (g.personalHeat || 0) + 2;
    } },
  { id: 'actRaid', label: 'Raid Business', base: 3500,
    requires: { stat: 'fist', min: 2 },
    effect: (game, g, _el, _it, ctx) => {
      ctx = ctx || {};
      const items = Array.isArray(ctx.stackItems) ? ctx.stackItems : [];
      const targetItem = items.find(it => it && it.type === 'business');
      const targetEl = (() => {
        const wrap = targetItem && targetItem.uid ? game._dom && game._dom.cardByUid && game._dom.cardByUid.get(targetItem.uid) : null;
        return wrap ? (wrap.querySelector && wrap.querySelector('.world-card')) : null;
      })();
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
        targetItem.cooldownEndMs = nowMs + scaleDurationMs(targetItem.cooldownTotal * 1000);
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
  { id: 'actExtort', label: 'Extort', base: 4000,
    effect: (game, g, _el, _it, ctx) => {
      ctx = ctx || {};
      const items = Array.isArray(ctx.stackItems) ? ctx.stackItems : [];
      const tableCards = game.state.table.cards;
      const targetItem = items.find(it => it && it.type === 'business');
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
  { id: 'actBuildIllicit', label: 'Build Illicit', base: 4000,
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
  
  // Procure Equipment: lets player choose an equipment card to add to inventory
  { id: 'actProcureEquipment', label: 'Procure Equipment', base: 3000,
    cost: { money: 200 },
    effect: (game) => {
      if (!Array.isArray(game.state.inventory)) game.state.inventory = [];
      const nextId = (game.state.nextEquipId || 1);
      const item = { id: nextId, type: 'pistol' };
      game.state.nextEquipId = nextId + 1;
      game.state.inventory.push(item);
      game.updateUI();
    } },
  { id: 'actDonate', label: 'Donate to Soup Kitchen', base: 4000,
    cost: (game) => {
      if ((game.state.cleanMoney || 0) < 400) return false;
      game.state.cleanMoney -= 400;
      return true;
    },
    effect: (game) => {
      game.state.respect += 1;
      if (game.state.heat > 0) game.state.heat -= 1;
    } },
  { id: 'actForgeAlibi', label: 'Buy Alibi', base: 3500,
    requires: { stat: 'face', min: 2 },
    cost: { money: 500 },
    effect: (game) => {
      // Add a short processing delay by spawning the paperwork after action completes (effect already runs post-timer)
      game.spawnTableCard('fake_alibi');
      game.updateUI();
    } },
  // Timed use of a fake alibi on heat
  { id: 'actUseAlibi', label: 'Use Alibi', base: 2500,
    effect: (game, _g, _el, _it, ctx) => {
      ctx = ctx || {};
      const table = game.state.table; const cards = table && table.cards ? table.cards : [];
      const items = Array.isArray(ctx.stackItems) ? ctx.stackItems : [];
      const heat = items.find(it => it && it.type === 'heat');
      const alibi = items.find(it => it && it.id === 'fake_alibi');
      if (heat && heat.uid) {
        const wrap = game._dom && game._dom.cardByUid && game._dom.cardByUid.get(heat.uid);
        if (wrap) { try { clearRing(wrap, 'heat'); } catch(e){} }
      }
      if (heat) { const i = cards.indexOf(heat); if (i >= 0) { const it = cards[i]; cards.splice(i, 1); if (it && it.uid) game.removeCardByUid(it.uid); } }
      if (alibi) { const j = cards.indexOf(alibi); if (j >= 0) { const it2 = cards[j]; cards.splice(j, 1); if (it2 && it2.uid) game.removeCardByUid(it2.uid); } }
      game.updateUI();
    } },
  { id: 'actIntimidate', label: 'Intimidate', base: 3000,
    effect: (game, g) => {
      if (game.state.disagreeableOwners > 0) game.state.disagreeableOwners -= 1;
      game.state.fear = (game.state.fear || 0) + 1;
      if (g) g.personalHeat = (g.personalHeat || 0) + 1;
      game.spawnTableCard('heat');
    } },
];
