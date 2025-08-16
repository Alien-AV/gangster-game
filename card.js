import { ACTIONS } from './actions.js';
import { startCountdown } from './progress-ring.js';

// Card model
export class Card {
  constructor({ id, name, desc = '', reusable = true, type = 'generic', data = {}, img = undefined, verbs = [] }) {
    this.id = id;
    this.name = name || id;
    this.desc = desc;
    this.reusable = reusable;
    this.type = type; // e.g., 'recruit','priest','crooks','cop','business'
    this.data = data;
    this.used = false; // runtime flag when consumed (for non-reusable)
    this.img = img; // optional image filename for art
    this.verbs = Array.isArray(verbs) ? verbs : [];
  }
}

// Registry of card definitions by id for easy construction
export const CARD_REGISTRY = {
  corrupt_cop: () => new Card({ id: 'corrupt_cop', name: 'Local Corrupt Cop', desc: 'A familiar face on the beat. Can arrange favors for a price.', reusable: true, type: 'cop', img: 'images/cop.png', verbs: ['pay_cops'] }),
  priest: () => new Card({ id: 'priest', name: 'Priest at the Church', desc: 'Donations improve your reputation in the neighborhood.', reusable: true, type: 'priest', img: 'images/priest.jpg', verbs: ['donate'] }),
  small_crooks: () => new Card({ id: 'small_crooks', name: 'Small-time Crooks', desc: 'They’re trouble. Choose whether to point ’em somewhere… or put ’em down yourself.', reusable: true, type: 'crooks', img: 'images/crooks.jpg', verbs: ['recruit_enforcer'] }),
  enforcers: () => new Card({ id: 'enforcers', name: 'Enforcers', desc: 'Hired muscle - when you just need some extra hands.', reusable: true, type: 'enforcer', data: { count: 0 }, verbs: [] }),
  hot_dog_stand: () => new Card({ id: 'hot_dog_stand', name: 'Hot-dog Stand', desc: 'A flimsy front ripe for a shake-down.', reusable: true, type: 'business', img: 'images/hotdog.jpg', verbs: ['extort_or_raid'] }),
  bakery: () => new Card({ id: 'bakery', name: 'Corner Bakery', desc: 'Busy mornings. Might pay for protection.', reusable: false, type: 'business', img: 'images/bakery.png', verbs: ['extort_or_raid'] }),
  diner: () => new Card({ id: 'diner', name: 'Mom-and-Pop Diner', desc: 'Cash business with regulars.', reusable: false, type: 'business', img: 'images/diner.jpg', verbs: ['extort_or_raid'] }),
  laundromat: () => new Card({ id: 'laundromat', name: 'Neighborhood Laundromat', desc: 'Steady quarters, soft targets.', reusable: false, type: 'business', img: 'images/laundromat.jpg', verbs: ['extort_or_raid'] }),
  pawn_shop: () => new Card({ id: 'pawn_shop', name: 'Pawn Shop', desc: 'Source for gear—if you grease the wheels.', reusable: false, type: 'business', verbs: ['procure_equipment'] }),
  newspaper: () => new Card({ id: 'newspaper', name: 'Local Newspaper', desc: 'Buy ads to boost your reputation.', reusable: false, type: 'business', img: 'images/newspaper.jpg', verbs: ['promo'] }),
  bookmaker: () => new Card({ id: 'bookmaker', name: 'Bookmaker', desc: 'Launder money via gambling operations.', reusable: true, type: 'business', img: 'images/bookmaker.jpg', verbs: ['launder'] }),
  extorted_business: () => new Card({ id: 'extorted_business', name: 'Extorted Businesses', desc: 'Shops paying protection under your wing.', reusable: true, type: 'extorted_business', data: { count: 0 }, verbs: [] }),
  heat: () => new Card({ id: 'heat', name: 'Police Heat', desc: 'The cops are onto you. Handle it before it blows over.', reusable: false, type: 'heat', img: 'images/heat.png', verbs: [] }),
  disagreeable_owner: () => new Card({ id: 'disagreeable_owner', name: 'Disagreeable Owner', desc: 'A stubborn shopkeeper. A kind word—or a broken window—might change their mind.', reusable: false, type: 'owner', verbs: ['pressure_owner'] }),
  recruit_face: () => new Card({ id: 'recruit_face', name: 'Recruit: Face', desc: 'A smooth talker looking for work.', reusable: false, type: 'recruit', data: { type: 'face' }, img: 'images/face.png', verbs: ['hire_recruit'] }),
  recruit_fist: () => new Card({ id: 'recruit_fist', name: 'Recruit: Fist', desc: 'A bruiser ready to prove himself.', reusable: false, type: 'recruit', data: { type: 'fist' }, img: 'images/fist.png', verbs: ['hire_recruit'] }),
  recruit_brain: () => new Card({ id: 'recruit_brain', name: 'Recruit: Brain', desc: 'A planner who knows the angles.', reusable: false, type: 'recruit', data: { type: 'brain' }, img: 'images/brain.png', verbs: ['hire_recruit'] }),
  city_entrance: () => new Card({ id: 'city_entrance', name: 'City Entrance', desc: 'A path into the wider city opens. New opportunities await.', reusable: false, type: 'milestone', img: 'images/city.jpg', verbs: [] }),
};

export function makeCard(id) {
  const f = CARD_REGISTRY[id];
  return f ? f() : new Card({ id, name: id, desc: '', reusable: true, type: 'generic' });
}

// Compute dynamic info line for a card (counts, timers, etc.)
export function computeCardDynamic(game, item) {
  if (!item) return '';
  if (item.type === 'enforcer') {
    const count = (item.data && item.data.count) || 0; return `Amount: ${count}`;
  }
  if (item.id === 'extorted_business') {
    const count = (item.data && item.data.count) || 0; return `Amount: ${count}`;
  }
  if (item.type === 'business' && item.cooldownUntil) {
    const remain = Math.max(0, (item.cooldownUntil - (game.state.time || 0)));
    if (remain > 0) return `Recovers in ${remain}s`;
  }
  return '';
}

// Create a Card facade for a gangster entity
export function makeGangsterCard(g) {
  const { id, type, name, stats = {} } = g || {};
  const title = name || (type ? type.toUpperCase() : 'GANGSTER');
  const desc = `F:${stats.fist ?? 0} Fa:${stats.face ?? 0} Br:${stats.brain ?? 0}`;
  // Map gangster type to default images
  const imgMap = { boss: 'boss.png', face: 'face.png', fist: 'fist.png', brain: 'brain.png' };
  const img = imgMap[type] || undefined;
  return new Card({ id: `gangster_${id}`, name: title, desc, reusable: true, type: 'gangster', data: { gid: id, type }, img, verbs: [] });
}

// Export unified type-driven behaviors used by the world renderer
export const CARD_BEHAVIORS = {
  heat: {
    onCreate: function(game, item) {
      // Initialize standard heat countdown if not already set
      if (!item.heatEndMs) {
        const nowMs = Date.now();
        item.heatStartMs = nowMs;
        item.heatEndMs = nowMs + 20000; // default 20s real-time
      }
    }
  },
  business: {
    onDrop: function (game, item, gangster, cardEl) {
      const now = game.state.time || 0;
      if (item.cooldownUntil && now < item.cooldownUntil) { game._cardMsg('Business is recovering after a raid.'); return; }
      // If business has specific verbs, run them exclusively
      const verbs = Array.isArray(item.verbs) ? item.verbs : [];
      if (verbs.includes('launder')) {
        const a = (ACTIONS || []).find(x => x.id === 'actLaunder'); if (!a) return;
        const dur = game.durationWithStat(a.base, a.stat, gangster); game.executeAction(a, gangster, cardEl, dur); return;
      }
      if (verbs.includes('procure_equipment')) {
        const a = (ACTIONS || []).find(x => x.id === 'actProcureEquipment'); if (!a) return;
        const dur = game.durationWithStat(a.base, a.stat, gangster); game.executeAction(a, gangster, cardEl, dur); return;
      }
      if (verbs.includes('promo')) {
        const a = (ACTIONS || []).find(x => x.id === 'actPromo'); if (!a) return;
        const dur = game.durationWithStat(a.base, a.stat, gangster); game.executeAction(a, gangster, cardEl, dur); return;
      }
      // Default business behavior: extort or raid
      const options = [{ id: 'actExtort', label: 'Extort' }, { id: 'actRaid', label: 'Raid' }];
      game.showInlineActionChoice(cardEl, options, (choiceId) => {
        const baseAct = (ACTIONS || []).find(a => a.id === choiceId);
        if (!baseAct) return;
        const act = {
          ...baseAct,
          effect: (gme, gg) => {
            if (choiceId === 'actExtort') {
              game._extortAttemptCount = (game._extortAttemptCount || 0) + 1;
              const forceFail = (game._extortAttemptCount === 2);
              if (gg) gg.personalHeat = (gg.personalHeat || 0) + 1;
              const discArr = (game.state.table && game.state.table.cards) || [];
              const idx = discArr.indexOf(item);
              if (forceFail) {
                const owner = makeCard('disagreeable_owner');
                if (idx >= 0) discArr.splice(idx, 1); // remove business
                discArr.push(owner);
                // Ensure DOM reflects removal and new card
                if (item && item.uid && typeof game.removeCardByUid === 'function') { try { game.removeCardByUid(item.uid); } catch(e){} }
                if (typeof game.ensureCardNode === 'function') { try { const nidx = discArr.indexOf(owner); game.ensureCardNode(owner, nidx); } catch(e){} }
                game.state.disagreeableOwners = (game.state.disagreeableOwners || 0) + 1;
              } else {
                let xb = discArr.find(x => x.id === 'extorted_business');
                if (!xb) {
                  xb = makeCard('extorted_business');
                  xb.data = xb.data || {}; xb.data.count = 1;
                  if (idx >= 0) discArr.splice(idx, 1); // remove business
                  discArr.push(xb);
                  // Ensure DOM removal and creation
                  if (item && item.uid && typeof game.removeCardByUid === 'function') { try { game.removeCardByUid(item.uid); } catch(e){} }
                  if (typeof game.ensureCardNode === 'function') { try { const nidx = discArr.indexOf(xb); game.ensureCardNode(xb, nidx); } catch(e){} }
                } else {
                  xb.data = xb.data || {}; xb.data.count = (xb.data.count || 0) + 1;
                  if (idx >= 0) {
                    discArr.splice(idx, 1); // remove business from data
                    // Remove business node from DOM
                    if (item && item.uid && typeof game.removeCardByUid === 'function') { try { game.removeCardByUid(item.uid); } catch(e){} }
                  }
                  // Ensure extorted aggregate exists, then update its dynamic counter
                  if (typeof game.ensureCardNode === 'function') { try { const nidx = discArr.indexOf(xb); game.ensureCardNode(xb, nidx); } catch(e){} }
                }
                game.state.extortedBusinesses = (game.state.extortedBusinesses || 0) + 1;
              }
            }
            if (choiceId === 'actRaid') {
               // Set cooldown (seconds) and start animator on wrapper
               const nowSec = (game.state.time || 0);
               const nowMs = Date.now();
               item.cooldownTotal = 60;
               item.cooldownUntil = nowSec + item.cooldownTotal;
               item.cooldownStartMs = nowMs;
               item.cooldownEndMs = nowMs + item.cooldownTotal * 1000;
               if (cardEl && cardEl.parentElement && cardEl.parentElement.classList.contains('ring-wrap')) {
                 const wrap = cardEl.parentElement;
                 try {
                   startCountdown(wrap, {
                     startMs: item.cooldownStartMs,
                     endMs: item.cooldownEndMs,
                     mode: 'cooldown',
                     showBadge: false,
                     onTick: (_p, remaining) => {
                       const sec = Math.max(0, Math.ceil(remaining / 1000));
                       if (item && item._dynEl) { try { item._dynEl.textContent = `Recovers in ${sec}s`; } catch(e){} }
                     },
                     onDone: () => {
                       try {
                         wrap.classList.remove('cooldown-active');
                         wrap.style.removeProperty('--p');
                         const banner = cardEl.querySelector && cardEl.querySelector('.world-card-center-badge.badge-recover');
                         if (banner) { try { banner.remove(); } catch(e){} }
                       } catch(e){}
                       item.cooldownUntil = 0;
                       item.cooldownStartMs = 0;
                       item.cooldownEndMs = 0;
                       game.updateCardDynamic(item);
                     }
                   });
                 } catch(e){}
               }
               if (typeof baseAct.effect === 'function') baseAct.effect(game, gg);
               // Spawn a heat card that expires soon (handled by heat.onCreate)
               try {
                 if (typeof game.spawnTableCard === 'function') game.spawnTableCard('heat');
                 else {
                   const discArr = (game.state.table && game.state.table.cards) || [];
                   const h = makeCard('heat');
                   discArr.push(h);
                   if (typeof game.ensureCardNode === 'function') {
                     const hidx = discArr.indexOf(h);
                     game.ensureCardNode(h, hidx);
                   }
                 }
               } catch(e){}
             }
           }
         };
         const dur = game.durationWithStat(act.base, act.stat, gangster);
         game.executeAction(act, gangster, cardEl, dur);
      });
    }
  },
  crooks: {
    onDrop: function (game, item, gangster, cardEl) {
      const recruitAct = (ACTIONS || []).find(a => a.id === 'actRecruitEnforcer');
      const vigilAct = (ACTIONS || []).find(a => a.id === 'actVigilante');
      if (!recruitAct && !vigilAct) return;
      const options = [];
      if (recruitAct) options.push({ id: 'recruit', label: 'Recruit' });
      if (vigilAct) {
        // Require Fist >= 3 to beat up
        const canBeat = game.effectiveStat(gangster, 'fist') >= 3;
        options.push({ id: 'vigilante', label: canBeat ? 'Beat Up' : 'Beat Up (Requires Fist 3)' , disabled: !canBeat });
      }
      if (!options.length) return;
      game.showInlineActionChoice(cardEl, options, (choiceId) => {
        if (choiceId === 'recruit' && recruitAct) {
          const act = {
            ...recruitAct, id: 'actRecruitCrooks', label: 'Recruit Local Crooks', stat: 'face',
            effect: (gme, gg) => {
              recruitAct.effect(gme, gg);
              const discArr = (gme.state.table && gme.state.table.cards) || [];
              let ef = discArr.find(x => x.id === 'enforcers');
              if (!ef) { ef = makeCard('enforcers'); discArr.push(ef); }
              ef.data = ef.data || {}; ef.data.count = (ef.data.count || 0) + 1;
              // Update card counter live
              if (typeof gme.updateCardDynamic === 'function') {
                try { gme.updateCardDynamic(ef); } catch(e){}
              }
              // Ensure DOM exists for enforcers
              if (typeof gme.ensureCardNode === 'function') {
                try { const idx = discArr.indexOf(ef); gme.ensureCardNode(ef, idx); } catch(e){}
              }
            }
          };
          const dur = game.durationWithStat(act.base, act.stat, gangster);
          game.executeAction(act, gangster, cardEl, dur);
        } else if (choiceId === 'vigilante' && vigilAct) {
          if (game.effectiveStat(gangster, 'fist') < 3) { game._cardMsg('Requires Fist 3'); return; }
          const act = { ...vigilAct };
          const dur = game.durationWithStat(act.base, act.stat, gangster);
          game.executeAction(act, gangster, cardEl, dur);
        }
      });
    }
  },
  priest: {
    onDrop: function (game, item, gangster, cardEl) {
      const baseAct = (ACTIONS || []).find(a => a.id === 'actDonate');
      if (!baseAct) return;
      const dur = game.durationWithStat(baseAct.base, baseAct.stat, gangster);
      game.executeAction(baseAct, gangster, cardEl, dur);
    }
  },
  cop: {
    onDrop: function (game, item, gangster, cardEl) {
      const baseAct = (ACTIONS || []).find(a => a.id === 'actPayCops');
      if (!baseAct) return;
      const dur = game.durationWithStat(baseAct.base, baseAct.stat, gangster);
      game.executeAction(baseAct, gangster, cardEl, dur);
    }
  },
  recruit: {
    onDrop: function (game, item, gangster, cardEl) {
      const baseAct = (ACTIONS || []).find(a => a.id === 'actHireGangster');
      if (!baseAct) return;
      const price = (typeof game.gangsterCost === 'function') ? game.gangsterCost() : 200;
      if (game.totalMoney() < price) { game._cardMsg(`Need $${price} to hire.`); return; }
      const chosen = (item.data && item.data.type) || 'face';
      const act = {
        ...baseAct,
        label: `Hire ${chosen.charAt(0).toUpperCase() + chosen.slice(1)}`,
        effect: (gme) => {
          const s = gme.state;
          const newG = { id: s.nextGangId++, type: chosen, name: undefined, busy: false, personalHeat: 0, stats: gme.defaultStatsForType(chosen) };
          s.gangsters.push(newG);
          item.used = true;
          gme.updateUI();
          if (typeof gme.ensureGangsterNode === 'function') {
            try { gme.ensureGangsterNode(newG); } catch(e){}
          }
        }
      };
      const dur = game.durationWithStat(act.base, act.stat, gangster);
      game.executeAction(act, gangster, cardEl, dur);
    }
  },
  bookmaker: {
    onDrop: function (game, item, gangster, cardEl) {
      const baseAct = (ACTIONS || []).find(a => a.id === 'actLaunder');
      if (!baseAct) return;
      const dur = game.durationWithStat(baseAct.base, baseAct.stat, gangster);
      game.executeAction(baseAct, gangster, cardEl, dur);
    }
  },
  pawn_shop: {
    onDrop: function (game, item, gangster, cardEl) {
      const baseAct = (ACTIONS || []).find(a => a.id === 'actProcureEquipment');
      if (!baseAct) return;
      const dur = game.durationWithStat(baseAct.base, baseAct.stat, gangster);
      game.executeAction(baseAct, gangster, cardEl, dur);
    }
  },
  owner: {
    onDrop: function (game, item, gangster, cardEl) {
      const baseMs = 3500;
      const canThreaten = game.effectiveStat(gangster, 'fist') >= 3;
      const options = [
        { id: 'convince_owner', label: 'Convince Owner (Face)' },
        { id: 'threaten_owner', label: canThreaten ? 'Threaten Owner (Fist)' : 'Threaten Owner (Fist, Requires Fist 3)', disabled: !canThreaten },
      ];
      game.showInlineActionChoice(cardEl, options, (choiceId) => {
        if (choiceId === 'convince_owner') {
          const act = {
            id: 'actConvinceOwner', label: 'Convince Owner (Face)', stat: 'face', base: baseMs,
            cost: { money: 500 },
            effect: (gme, gg) => {
              const discArr = (gme.state.table && gme.state.table.cards) || [];
              const idx = discArr.indexOf(item);
              let xb = discArr.find(x => x.id === 'extorted_business');
              if (!xb) {
                xb = makeCard('extorted_business');
                xb.data = xb.data || {}; xb.data.count = 1;
                if (idx >= 0) discArr.splice(idx, 1);
                discArr.push(xb);
                if (item && item.uid && typeof gme.removeCardByUid === 'function') { try { gme.removeCardByUid(item.uid); } catch(e){} }
                if (typeof gme.ensureCardNode === 'function') { try { const nidx = discArr.indexOf(xb); gme.ensureCardNode(xb, nidx); } catch(e){} }
              } else {
                xb.data = xb.data || {}; xb.data.count = (xb.data.count || 0) + 1;
                if (idx >= 0) {
                  discArr.splice(idx, 1);
                  if (item && item.uid && typeof gme.removeCardByUid === 'function') { try { gme.removeCardByUid(item.uid); } catch(e){} }
                }
                if (typeof gme.ensureCardNode === 'function') { try { const nidx = discArr.indexOf(xb); gme.ensureCardNode(xb, nidx); } catch(e){} }
              }
              if (xb && typeof game.updateCardDynamic === 'function') {
                try { game.updateCardDynamic(xb); } catch(e){}
              }
              if (gme.state.disagreeableOwners > 0) gme.state.disagreeableOwners -= 1;
              gme.state.extortedBusinesses = (gme.state.extortedBusinesses || 0) + 1;
            }
          };
          const dur = game.durationWithStat(act.base, act.stat, gangster);
          game.executeAction(act, gangster, cardEl, dur);
        }
        if (choiceId === 'threaten_owner') {
          if (!canThreaten) { game._cardMsg('Requires Fist 3'); return; }
          const act = {
            id: 'actThreatenOwner', label: 'Threaten Owner (Fist)', stat: 'fist', base: baseMs,
            effect: (gme, gg) => {
              const discArr = (gme.state.table && gme.state.table.cards) || [];
              const idx = discArr.indexOf(item);
              let xb = discArr.find(x => x.id === 'extorted_business');
              if (!xb) {
                xb = makeCard('extorted_business');
                xb.data = xb.data || {}; xb.data.count = 1;
                if (idx >= 0) discArr.splice(idx, 1);
                discArr.push(xb);
                if (item && item.uid && typeof gme.removeCardByUid === 'function') { try { gme.removeCardByUid(item.uid); } catch(e){} }
                if (typeof gme.ensureCardNode === 'function') { try { const nidx = discArr.indexOf(xb); gme.ensureCardNode(xb, nidx); } catch(e){} }
              } else {
                xb.data = xb.data || {}; xb.data.count = (xb.data.count || 0) + 1;
                if (idx >= 0) {
                  discArr.splice(idx, 1);
                  if (item && item.uid && typeof gme.removeCardByUid === 'function') { try { gme.removeCardByUid(item.uid); } catch(e){} }
                }
                if (typeof gme.ensureCardNode === 'function') { try { const nidx = discArr.indexOf(xb); gme.ensureCardNode(xb, nidx); } catch(e){} }
              }
              if (xb && typeof game.updateCardDynamic === 'function') {
                try { game.updateCardDynamic(xb); } catch(e){}
              }
              if (gme.state.disagreeableOwners > 0) gme.state.disagreeableOwners -= 1;
              gme.state.extortedBusinesses = (gme.state.extortedBusinesses || 0) + 1;
              // Spawn heat for intimidate path
              if (typeof gme.spawnTableCard === 'function') gme.spawnTableCard('heat');
            }
          };
          const dur = game.durationWithStat(act.base, act.stat, gangster);
          game.executeAction(act, gangster, cardEl, dur);
        }
      });
    }
  }
};

// Renderer for a world card element and wrapper
export function renderWorldCard(game, item) {
  const wrap = document.createElement('div');
  wrap.className = 'ring-wrap';
  const c = document.createElement('div');
  c.className = 'card world-card' + (item.type === 'recruit' ? ' recruit' : '');
  const title = item.name || item.title || item.id;
  const imgSrc = item.img || (item.type === 'recruit' ? ('images/' + ((item.data && item.data.type) + '.png')) : (item.type === 'cop' ? 'images/cop.png' : undefined));
  const artEmoji = '🃏';
  const computeDesc = () => {
    return item.desc || '\u00A0';
  };
  const artHtml = imgSrc
    ? '<img class="world-card-artImg" src="' + imgSrc + '" alt="' + title + '">'
    : '<div class="world-card-artEmoji">' + artEmoji + '</div>';
  c.innerHTML = `
    <div class="world-card-title">${title}</div>
    <div class="world-card-art">
      ${artHtml}
    </div>
    <div class="world-card-desc">
      <p class="world-card-descText">${computeDesc()}</p>
      <p class="world-card-descDyn"></p>
    </div>
  `;
  const imgEl = c.querySelector('.world-card-artImg');
  const emojiEl = c.querySelector('.world-card-artEmoji');
  if (imgEl) imgEl.addEventListener('error', () => { if (emojiEl) emojiEl.classList.remove('hidden'); imgEl.remove(); });
  // Seed dynamic text
  const dynEl = c.querySelector('.world-card-descDyn');
  if (dynEl) dynEl.textContent = computeCardDynamic(game, item);
  if (item.type === 'recruit' && imgEl) imgEl.style.filter = 'grayscale(1) contrast(0.95)';
    if (item.type === 'business') {
    const now = game.state.time || 0;
    if (item.extorted) {
      // no badge; static state
      } else if (item.cooldownUntil && now < item.cooldownUntil) {
      const remain = item.cooldownUntil - now;
      // Mark cooldown active and compute remaining fraction for ring
      wrap.classList.add('cooldown-active');
      if (typeof item.cooldownTotal === 'number' && item.cooldownTotal > 0) {
        const p = Math.min(1, Math.max(0, (remain / item.cooldownTotal)));
        try { wrap.style.setProperty('--p', String(p)); } catch(e){}
      }
        // Center recovery badge (shared styles)
        const banner = document.createElement('div');
        banner.className = 'world-card-center-badge badge-recover';
        banner.textContent = 'Recovering from raid';
        c.appendChild(banner);
    }
  }
  wrap.appendChild(c);
  // Expose wrapper for cooldown ring updates
  item._ringWrapEl = wrap;
  // Expose dynamic element for live updates
  item._dynEl = dynEl;
  return { wrap, card: c };
}

// Build info panel content from a declarative source
export function getCardInfo(game, item) {
  const title = item.name || item.title || item.id;
  // Flavor
  let desc = item.desc || '';
  // Hint
  let hint = '';
  const verbs = Array.isArray(item.verbs) ? item.verbs : [];
  if (item.type === 'recruit') {
    const price = (typeof game.gangsterCost === 'function') ? game.gangsterCost() : 200;
    hint = `Hire for $${price}. Bring new blood into the crew.`;
  } else if (verbs.includes('launder')) hint = 'Launder $1000 into clean money — you will lose some on the way.';
  else if (verbs.includes('procure_equipment')) hint = 'Pick up gear to tip the odds in your favor.';
  else if (verbs.includes('promo')) hint = 'Grease the press to paint you in a good light — costs dirty cash, builds respect.';
  else if (item.type === 'business') hint = 'Raid for a quick influx of cash — or extort for steady protection payments.';
  else if (item.type === 'crooks') hint = 'Beat up local hooligans to earn respect and fear — or recruit them as enforcers.';
  else if (item.type === 'cop') hint = 'Bribe the local cop to deflect the attention of authorities.';
  else if (item.type === 'owner') hint = 'Sway the owner with a $500 donation — or break a few windows to intimidate.';
  // Dynamic line
  const dynamic = computeCardDynamic(game, item);
  return { title, desc, hint, dynamic };
}
