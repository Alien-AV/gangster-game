// Card model
export class Card {
  constructor({ id, name, desc = '', reusable = true, type = 'generic', data = {} }) {
    this.id = id;
    this.name = name || id;
    this.desc = desc;
    this.reusable = reusable;
    this.type = type; // e.g., 'recruit','priest','crooks','cop','business'
    this.data = data;
    this.used = false; // runtime flag when consumed (for non-reusable)
  }
}

// Registry of card definitions by id for easy construction
export const CARD_REGISTRY = {
  corrupt_cop: () => new Card({ id: 'corrupt_cop', name: 'Local Corrupt Cop', desc: 'A familiar face on the beat. Can arrange favors for a price.', reusable: true, type: 'cop' }),
  priest: () => new Card({ id: 'priest', name: 'Priest at the Church', desc: 'Donations improve your reputation in the neighborhood.', reusable: true, type: 'priest' }),
  small_crooks: () => new Card({ id: 'small_crooks', name: 'Small-time Crooks', desc: 'Can be swayed to patrol for you.', reusable: true, type: 'crooks' }),
  enforcers: () => new Card({ id: 'enforcers', name: 'Enforcers', desc: 'Muscle on call. Count: 0. Upkeep: $0 per 10s each.', reusable: true, type: 'enforcer', data: { count: 0 } }),
  hot_dog_stand: () => new Card({ id: 'hot_dog_stand', name: 'Hot-dog Stand', desc: 'A flimsy front ripe for a shake-down.', reusable: true, type: 'business' }),
  bakery: () => new Card({ id: 'bakery', name: 'Corner Bakery', desc: 'Busy mornings. Might pay for protection.', reusable: false, type: 'business' }),
  diner: () => new Card({ id: 'diner', name: 'Mom-and-Pop Diner', desc: 'Cash business with regulars.', reusable: false, type: 'business' }),
  laundromat: () => new Card({ id: 'laundromat', name: 'Neighborhood Laundromat', desc: 'Steady quarters, soft targets.', reusable: false, type: 'business' }),
  pawn_shop: () => new Card({ id: 'pawn_shop', name: 'Pawn Shop', desc: 'Source for gear—if you grease the wheels.', reusable: false, type: 'business' }),
  newspaper: () => new Card({ id: 'newspaper', name: 'Local Newspaper', desc: 'Buy ads to boost your reputation.', reusable: false, type: 'business' }),
  bookmaker: () => new Card({ id: 'bookmaker', name: 'Bookmaker', desc: 'Launder money via gambling operations.', reusable: true, type: 'business' }),
  extorted_business: () => new Card({ id: 'extorted_business', name: 'Extorted Businesses', desc: 'Protection owed: 0', reusable: true, type: 'extorted_business', data: { count: 0 } }),
  disagreeable_owner: () => new Card({ id: 'disagreeable_owner', name: 'Disagreeable Owner', desc: 'Stands up to your shakedown. Convince (Face) or threaten (Fist) to secure protection.', reusable: false, type: 'owner' }),
  recruit_face: () => new Card({ id: 'recruit_face', name: 'Potential Recruit: Face', desc: 'A smooth talker looking for work. Hire when you have cash.', reusable: false, type: 'recruit', data: { type: 'face' } }),
  recruit_fist: () => new Card({ id: 'recruit_fist', name: 'Potential Recruit: Fist', desc: 'A bruiser ready to prove himself.', reusable: false, type: 'recruit', data: { type: 'fist' } }),
  recruit_brain: () => new Card({ id: 'recruit_brain', name: 'Potential Recruit: Brain', desc: 'A planner who knows the angles.', reusable: false, type: 'recruit', data: { type: 'brain' } }),
  city_entrance: () => new Card({ id: 'city_entrance', name: 'City Entrance', desc: 'A path into the wider city opens. New opportunities await.', reusable: false, type: 'milestone' }),
};

export function makeCard(id) {
  const f = CARD_REGISTRY[id];
  return f ? f() : new Card({ id, name: id, desc: '', reusable: true, type: 'generic' });
}

// Create a Card facade for a gangster entity
export function makeGangsterCard(g) {
  const { id, type, name, stats = {} } = g || {};
  const title = name || (type ? type.toUpperCase() : 'GANGSTER');
  const desc = `F:${stats.fist ?? 0} Fa:${stats.face ?? 0} Br:${stats.brain ?? 0}`;
  return new Card({ id: `gangster_${id}`, name: title, desc, reusable: true, type: 'gangster', data: { gid: id, type } });
}
