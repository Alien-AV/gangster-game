// Simple declarative Recipe engine for stacking interactions
// Future-ready for multi-card stacks; for now we match by set of types
export class RecipeEngine {
  constructor() {
    this.recipes = [];
  }
  // pattern: array of types, e.g., ['business','gangster'] or ids; outputs: one or more action ids
  // addRecipe(pattern, outputs | builder)
  addRecipe(pattern, outputs) {
    const key = this._keyFor(pattern);
    const entry = { key, size: pattern.length };
    if (typeof outputs === 'function') entry.builder = outputs; else entry.outputs = Array.isArray(outputs) ? outputs.slice() : [outputs];
    this.recipes.push(entry);
  }
  _keyFor(types) {
    return types.slice().sort().join('+');
  }
  // Return array of candidate actions. Builder can dynamically return ACTION ids based on context
  matchAll(types, context) {
    // Symmetric subset match: any recipe whose pattern is a subset of provided types
    const bag = Object.create(null);
    for (const t of types) bag[t] = (bag[t] || 0) + 1;
    const isSubset = (pattern) => {
      const need = Object.create(null);
      for (const t of pattern) need[t] = (need[t] || 0) + 1;
      for (const k in need) { if ((bag[k] || 0) < need[k]) return false; }
      return true;
    };
    const results = [];
    for (const rec of this.recipes) {
      // Recover original pattern from key (approximate by splitting); size is exact
      const pat = rec.key.split('+');
      if (pat.length !== rec.size) continue;
      if (!isSubset(pat)) continue;
      if (rec.builder) {
        const out = rec.builder(context || {});
        if (Array.isArray(out)) results.push(...out);
        else if (out) results.push(out);
      } else if (rec.outputs) {
        results.push(...rec.outputs);
      }
    }
    // De-duplicate while preserving order
    return results.filter((id, i, a) => a.indexOf(id) === i);
  }
}

// Default recipe registrations helper
export function registerDefaultRecipes(recipes) {
  // Explore: any deck-like card + gangster → unified explore action
  recipes.addRecipe(['neighborhood','gangster'], ['actExploreDeck']);
  recipes.addRecipe(['recruits','gangster'], ['actExploreDeck']);
  recipes.addRecipe(['targets','gangster'], ['actExploreDeck']);
  recipes.addRecipe(['opportunities','gangster'], ['actExploreDeck']);
  // Business interactions via chooser
  recipes.addRecipe(['business','gangster'], ['actExtort','actRaid']);
  // Recruit: recruit_* + gangster → timed action to recruit from card
  recipes.addRecipe(['recruit','gangster'], ['actRecruitFromCard']);
  recipes.addRecipe(['small_crooks','gangster'], ['actRecruitEnforcer','actVigilante']);
  // Corrupt Cop + gangster → forge fake alibi (costs money)
  recipes.addRecipe(['cop','gangster'], ['actForgeAlibi']);
  // Fake alibi + heat → timed action
  recipes.addRecipe(['paperwork','heat'], ['actUseAlibi']);
  // Services map directly to single actions (symmetric)
  recipes.addRecipe(['service','gangster'], (ctx) => {
    const items = (ctx && Array.isArray(ctx.stackItems)) ? ctx.stackItems : [];
    const svc = items.find(it => it && it.type === 'service');
    if (!svc) return [];
    if (svc.id === 'bookmaker') return ['actLaunder'];
    if (svc.id === 'newspaper') return ['actPromo'];
    if (svc.id === 'pawn_shop') return ['actProcureEquipment'];
    return [];
  });
}
