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
  { id: 'corrupt_cop', name: 'Local Corrupt Cop', desc: 'A familiar face on the beat. Can arrange favors for a price.', reusable: true, type: 'cop', img: 'images/cop.png', hint: 'Forge a fake alibi.' },
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
  { id: 'neighborhood', name: 'Neighborhood', desc: 'Your turf. Discover rackets, marks, and useful connections.', reusable: true, type: 'neighborhood', img: 'images/neighborhood.png', hint: 'Drop a gangster to explore.', data: { deck: true, deckStart: [ ['recruits','targets','opportunities'] ], exploreIds: [], deckEnd: ['city_entrance'] } },
  { id: 'recruits', name: 'Recruits', desc: 'Potential talent waiting to be found.', reusable: true, type: 'neighborhood', img: 'images/face.png', hint: 'Drop a gangster to find recruits.', data: { deck: true, exploreIds: ['recruit_face','recruit_fist','recruit_brain','small_crooks'] } },
  { id: 'targets', name: 'Targets', desc: 'Locations ripe for protection or raids.', reusable: true, type: 'neighborhood', img: 'images/laundromat.jpg', hint: 'Drop a gangster to find targets.', data: { deck: true, exploreIds: ['hot_dog_stand','bakery','diner','laundromat'] } },
  { id: 'opportunities', name: 'Opportunities', desc: 'Useful connections and services.', reusable: true, type: 'neighborhood', img: 'images/priest.jpg', hint: 'Drop a gangster to find opportunities.', data: { deck: true, exploreIds: ['corrupt_cop','priest','bookmaker','pawn_shop','newspaper'] } },
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
  // If gangster, render stat badge
  if (item.type === 'gangster') {
    const stats = (() => {
      const def = CARD_DEF_BY_ID.get(item.id) || {};
      const st = Object.assign({}, def.stats || {}, item.stats || {});
      return { face: st.face || 0, fist: st.fist || 0, brain: st.brain || 0, meat: st.meat != null ? st.meat : 1 };
    })();
    const badges = document.createElement('div');
    badges.className = 'world-card-stats';
    const b = document.createElement('div');
    b.className = 'stat-badge';
    b.textContent = `Face ${stats.face}  Fist ${stats.fist}  Brain ${stats.brain}  Meat ${stats.meat}`;
    badges.appendChild(b);
    const artEl = c.querySelector('.world-card-art');
    if (artEl) artEl.appendChild(badges); else c.appendChild(badges);
  }
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
  if (item && item.type === 'gangster') {
    const def = CARD_DEF_BY_ID.get(item.id) || {};
    const st = Object.assign({}, def.stats || {}, item.stats || {});
    const face = st.face != null ? st.face : 0;
    const fist = st.fist != null ? st.fist : 0;
    const brain = st.brain != null ? st.brain : 0;
    const meat = st.meat != null ? st.meat : 1;
    statsLine = `Fist:${fist} Face:${face} Brain:${brain} Meat:${meat}`;
  }
  const hint = def && def.hint ? def.hint : '';
  const dynamic = computeCardDynamic(game, item);
  return { title, desc, hint, dynamic, stats: statsLine };
}
