import { ACTIONS } from './actions.js';
import { startCountdown, clearRing } from './progress-ring.js';

// Card model
export class Card {
  constructor({ id, name, desc = '', reusable = true, type = 'generic', data = {}, img = undefined, verbs = [], draggable = false }) {
    this.id = id;
    this.name = name || id;
    this.desc = desc;
    this.reusable = reusable;
    this.type = type; // e.g., 'recruit','priest','crooks','cop','business'
    this.data = data;
    this.used = false; // runtime flag when consumed (for non-reusable)
    this.img = img; // optional image filename for art
    this.verbs = Array.isArray(verbs) ? verbs : [];
    this.draggable = !!draggable;
  }
}

// Declarative card definitions
export const CARD_DEFS = [
  { id: 'corrupt_cop', name: 'Local Corrupt Cop', desc: 'A familiar face on the beat. Can arrange favors for a price.', reusable: true, type: 'cop', img: 'images/cop.png', verbs: ['pay_cops'], hint: 'Bribe to lower heat.' },
  { id: 'priest', name: 'Priest at the Church', desc: 'Donations improve your reputation in the neighborhood.', reusable: true, type: 'priest', img: 'images/priest.jpg', verbs: ['donate'], hint: 'Donate to gain respect and reduce heat.' },
  { id: 'small_crooks', name: 'Small-time Crooks', desc: 'They’re trouble. Choose whether to point ’em somewhere… or put ’em down yourself.', reusable: true, type: 'crooks', img: 'images/crooks.png', verbs: ['recruit_enforcer'], hint: 'Recruit or beat up.' },
  { id: 'enforcers', name: 'Enforcers', desc: 'Hired muscle - when you just need some extra hands.', reusable: true, type: 'enforcer', img: 'images/enforcers.png', data: { count: 0 }, hint: 'Adds manpower.' },
  { id: 'hot_dog_stand', name: 'Hot-dog Stand', desc: 'A flimsy front ripe for a shake-down.', reusable: true, type: 'business', img: 'images/hotdog.jpg', verbs: ['extort_or_raid'], hint: 'Extort for steady money or raid for a burst.' },
  { id: 'bakery', name: 'Corner Bakery', desc: 'Busy mornings. Might pay for protection.', reusable: false, type: 'business', img: 'images/bakery.png', verbs: ['extort_or_raid'], hint: 'Extort or raid.' },
  { id: 'diner', name: 'Mom-and-Pop Diner', desc: 'Cash business with regulars.', reusable: false, type: 'business', img: 'images/diner.jpg', verbs: ['extort_or_raid'], hint: 'Extort or raid.' },
  { id: 'laundromat', name: 'Neighborhood Laundromat', desc: 'Steady quarters, soft targets.', reusable: false, type: 'business', img: 'images/laundromat.jpg', verbs: ['extort_or_raid'], hint: 'Extort or raid.' },
  { id: 'pawn_shop', name: 'Pawn Shop', desc: 'Source for gear—if you grease the wheels.', reusable: false, type: 'service', img: 'images/pawnshop.png', hint: 'Procure equipment.' },
  { id: 'newspaper', name: 'Local Newspaper', desc: 'Buy ads to boost your reputation.', reusable: false, type: 'service', img: 'images/newspaper.jpg', hint: 'Run promotions.' },
  { id: 'bookmaker', name: 'Bookmaker', desc: 'Launder money via gambling operations.', reusable: true, type: 'service', img: 'images/bookmaker.jpg', hint: 'Launder dirty money.' },
  { id: 'extorted_business', name: 'Extorted Businesses', desc: 'Shops paying protection under your wing.', reusable: true, type: 'extorted_business', img: 'images/extorted-business.png', data: { count: 0 }, hint: 'Aggregated protection payouts.' },
  { id: 'heat', name: 'Police Heat', desc: 'The cops are onto you. Handle it before it blows over.', reusable: false, type: 'heat', img: 'images/heat.png', hint: 'Expires over time; avoid getting arrested.' },
  { id: 'neighborhood', name: 'Neighborhood', desc: 'Your turf. Discover rackets, marks, and useful connections.', reusable: true, type: 'neighborhood', img: 'images/neighborhood.png', hint: 'Drop a gangster to explore.', data: { exploreIds: ['recruits','targets','opportunities'] } },
  { id: 'recruits', name: 'Recruits', desc: 'Potential talent waiting to be found.', reusable: true, type: 'neighborhood', img: 'images/face.png', hint: 'Drop a gangster to find recruits.', data: { exploreIds: ['recruit_face','recruit_fist','recruit_brain'] } },
  { id: 'targets', name: 'Targets', desc: 'Locations ripe for protection or raids.', reusable: true, type: 'neighborhood', img: 'images/laundromat.jpg', hint: 'Drop a gangster to find targets.', data: { exploreIds: ['hot_dog_stand','bakery','diner','laundromat'] } },
  { id: 'opportunities', name: 'Opportunities', desc: 'Useful connections and services.', reusable: true, type: 'neighborhood', img: 'images/priest.jpg', hint: 'Drop a gangster to find opportunities.', data: { exploreIds: ['corrupt_cop','priest','bookmaker','pawn_shop','newspaper'] } },
  { id: 'fake_alibi', name: 'Fake Alibi', desc: 'Papers that say you were somewhere else.', reusable: false, type: 'paperwork', img: 'images/newspaper.jpg', hint: 'Combine with Heat to clear it safely.', draggable: true },
  { id: 'disagreeable_owner', name: 'Disagreeable Owner', desc: 'A stubborn shopkeeper. A kind word—or a broken window—might change their mind.', reusable: false, type: 'owner', img: 'images/disagreeable-owner.png', hint: 'Convince or threaten.' },
  { id: 'recruit_face', name: 'Recruit: Face', desc: 'A smooth talker looking for work.', reusable: false, type: 'recruit', data: { type: 'face' }, img: 'images/face.png', hint: 'Hire to add a Face.' },
  { id: 'recruit_fist', name: 'Recruit: Fist', desc: 'A bruiser ready to prove himself.', reusable: false, type: 'recruit', data: { type: 'fist' }, img: 'images/fist.png', hint: 'Hire to add a Fist.' },
  { id: 'recruit_brain', name: 'Recruit: Brain', desc: 'A planner who knows the angles.', reusable: false, type: 'recruit', data: { type: 'brain' }, img: 'images/brain.png', hint: 'Hire to add a Brain.' },
  { id: 'gangster_face', name: 'Face', desc: 'Smooth talker. Negotiates, distracts, and greases palms.', reusable: true, type: 'gangster', img: 'images/face.png', stats: { face: 3, fist: 1, brain: 1, meat: 1 }, draggable: true, hint: 'Drag onto table cards.' },
  { id: 'gangster_fist', name: 'Fist', desc: 'Bruiser. Raids and intimidates when needed.', reusable: true, type: 'gangster', img: 'images/fist.png', stats: { face: 1, fist: 3, brain: 1, meat: 1 }, draggable: true, hint: 'Drag onto table cards.' },
  { id: 'gangster_brain', name: 'Brain', desc: 'A planner who knows the angles.', reusable: true, type: 'gangster', img: 'images/brain.png', stats: { face: 1, fist: 1, brain: 3, meat: 1 }, draggable: true, hint: 'Drag onto table cards.' },
  { id: 'boss', name: 'Boss', desc: 'Crew leader. Calls the shots and keeps heat manageable.', reusable: true, type: 'gangster', img: 'images/boss.png', stats: { face: 2, fist: 2, brain: 2, meat: 1 }, draggable: true, hint: 'Drag onto table cards.' },
  { id: 'city_entrance', name: 'City Entrance', desc: 'A path into the wider city opens. New opportunities await.', reusable: false, type: 'milestone', img: 'images/city.jpg', hint: 'Progress further into the city.' },
];

const CARD_DEF_BY_ID = (() => {
  const map = new Map();
  for (const def of CARD_DEFS) map.set(def.id, def);
  return map;
})();

export function makeCard(id) {
  return new Card(CARD_DEF_BY_ID.get(id));
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

export const CARD_BEHAVIORS = {
  heat: {
    onCreate: function(game, item) {
      // Initialize standard heat countdown if not already set
      if (!item.heatEndMs) {
        const nowMs = Date.now();
        item.heatStartMs = nowMs;
        item.heatEndMs = nowMs + 20000; // default 20s real-time
      }
    },
    onDrop: function(game, item, gangster, cardEl) {
      // Deflect Heat: short action that resets countdown to start and shows working badge
      const actionMs = 5000;
      const wrap = item._ringWrapEl || (cardEl && cardEl.parentElement);
      // Show deflecting badge and change ring color to alarming
      if (wrap) {
        try { wrap.classList.add('heat-active'); wrap.classList.add('deflecting'); } catch(e){}
        const card = wrap.querySelector && wrap.querySelector('.world-card');
        if (card) {
          let badge = card.querySelector('.world-card-center-badge.badge-deflect');
          if (!badge) {
            badge = document.createElement('div');
            badge.className = 'world-card-center-badge badge-deflect';
            badge.textContent = 'Deflecting Heat';
            card.appendChild(badge);
          }
        }
        // Stop any existing heat countdown visuals immediately
        try { clearRing(wrap, 'heat'); } catch(e){}
      }
      // Start timed work (marks gangster busy via existing infra)
      const act = { id: 'actDeflectHeat', label: 'Deflect Heat', stat: 'brain', base: actionMs };
      const dur = game.durationWithStat(act.base, act.stat, gangster);
      game.executeAction(act, gangster, cardEl, dur);
      // Reset timer on completion
      setTimeout(() => {
        const now = Date.now();
        item.heatStartMs = now;
        item.heatEndMs = now + 20000;
        // Restart countdown fresh
        if (wrap) {
          try { wrap.classList.add('heat-active'); } catch(e){}
          startCountdown(wrap, {
            startMs: item.heatStartMs,
            endMs: item.heatEndMs,
            mode: 'heat',
            showBadge: true,
            onDone: () => {
              const disc = (game.state.table && game.state.table.cards) || [];
              const idx = disc.indexOf(item);
              if (idx >= 0) disc.splice(idx, 1);
              if (item.uid) { try { game.removeCardByUid(item.uid); } catch(e){} }
              game._cardMsg('You got arrested');
            }
          });
        } else {
          game._activateTimersForItem(item, wrap);
        }
        // Clear badge
        if (wrap) {
          const card = wrap.querySelector && wrap.querySelector('.world-card');
          const badge = card && card.querySelector ? card.querySelector('.world-card-center-badge.badge-deflect') : null;
          if (badge) { try { badge.remove(); } catch(e){} }
          try { wrap.classList.remove('deflecting'); } catch(e){}
        }
      }, dur);
    }
  },
  business: {
    onDrop: function (game, item, gangster, cardEl) {
      const now = game.state.time || 0;
      if (item.cooldownUntil && now < item.cooldownUntil) { game._cardMsg('Business is recovering after a raid.'); return; }
      // Otherwise, delegate to recipe-driven generic handler (e.g., Extort/Raid)
      game._handleGenericOnDrop(item, gangster, cardEl);
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
              const tableCards = gme.state.table.cards;
              let ef = tableCards.find(x => x.id === 'enforcers');
              if (!ef) { ef = makeCard('enforcers'); tableCards.push(ef); }
              ef.data = ef.data || {}; ef.data.count = (ef.data.count || 0) + 1;
              gme.updateCardDynamic(ef);
              { const idx = tableCards.indexOf(ef); gme.ensureCardNode(ef, idx); }
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
  // Simple single-action cases now handled by unified infra (recipes + generic onDrop)
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
              const tableCards = gme.state.table.cards;
              const idx = tableCards.indexOf(item);
              let xb = tableCards.find(x => x.id === 'extorted_business');
              if (!xb) {
                xb = makeCard('extorted_business');
                xb.data = xb.data || {}; xb.data.count = 1;
                if (idx >= 0) tableCards.splice(idx, 1);
                tableCards.push(xb);
                if (item && item.uid) { gme.removeCardByUid(item.uid); }
                { const nidx = tableCards.indexOf(xb); gme.ensureCardNode(xb, nidx); }
              } else {
                xb.data = xb.data || {}; xb.data.count = (xb.data.count || 0) + 1;
                if (idx >= 0) {
                  tableCards.splice(idx, 1);
                  if (item && item.uid) { gme.removeCardByUid(item.uid); }
                }
                { const nidx = tableCards.indexOf(xb); gme.ensureCardNode(xb, nidx); }
              }
              if (xb) {
                game.updateCardDynamic(xb);
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
              const tableCards = gme.state.table.cards;
              const idx = tableCards.indexOf(item);
              let xb = tableCards.find(x => x.id === 'extorted_business');
          if (!xb) {
            xb = makeCard('extorted_business');
            xb.data = xb.data || {}; xb.data.count = 1;
                if (idx >= 0) tableCards.splice(idx, 1);
                tableCards.push(xb);
                if (item && item.uid) { gme.removeCardByUid(item.uid); }
                { const nidx = tableCards.indexOf(xb); gme.ensureCardNode(xb, nidx); }
          } else {
            xb.data = xb.data || {}; xb.data.count = (xb.data.count || 0) + 1;
            if (idx >= 0) {
                  tableCards.splice(idx, 1);
                  if (item && item.uid) { gme.removeCardByUid(item.uid); }
            }
                { const nidx = tableCards.indexOf(xb); gme.ensureCardNode(xb, nidx); }
          }
              if (xb) {
                game.updateCardDynamic(xb);
          }
          if (gme.state.disagreeableOwners > 0) gme.state.disagreeableOwners -= 1;
          gme.state.extortedBusinesses = (gme.state.extortedBusinesses || 0) + 1;
              gme.spawnTableCard('heat');
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
  if (item.uid) c.dataset.uid = item.uid;
  try { if (item && item.id) c.dataset.cardId = item.id; } catch(e){}
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
  // Expose explore ids for deck-like cards on the DOM for handlers that only have the element
  try {
    if (item && item.data && Array.isArray(item.data.exploreIds)) {
      c.dataset.exploreIds = item.data.exploreIds.join(',');
    }
  } catch(e){}
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
  const def = (typeof item.id === 'string') ? CARD_DEF_BY_ID.get(item.id) : null;
  const title = (item && item.name) || (def && def.name) || item.title || item.id;
  const desc = (item && item.desc) || (def && def.desc) || '';
  let statsLine = '';
  if (item && item.type === 'gangster' && item.uid && item.uid.startsWith('g_')) {
    const gid = parseInt(item.uid.slice(2), 10);
    const g = (game.state.gangsters || []).find(x => x.id === gid);
    if (g && g.stats) statsLine = `Fist:${g.stats.fist} Face:${g.stats.face} Brain:${g.stats.brain} Meat:${g.stats.meat ?? 1}`;
  }
  const hint = def && def.hint ? def.hint : '';
  const dynamic = computeCardDynamic(game, item);
  return { title, desc, hint, dynamic, stats: statsLine };
}
