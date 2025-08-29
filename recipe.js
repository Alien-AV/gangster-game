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
    const key = this._keyFor(types);
    const matches = this.recipes.filter(r => r.key === key && r.size === types.length);
    const results = [];
    for (const rec of matches) {
      if (rec.builder) {
        const out = rec.builder(context);
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
  // Recruit: recruit_* + gangster → spawn gangster of specific subtype and consume recruit
  recipes.addRecipe(['recruit','gangster'], (ctx) => {
    const t = (ctx && ctx.target && ctx.target.data && ctx.target.data.type) || 'face';
    return [{ spawnGangsterType: t, consumeTarget: true }];
  });
  // Corrupt Cop + gangster → forge fake alibi (costs money)
  recipes.addRecipe(['cop','gangster'], ['actForgeAlibi']);
  // Fake alibi + heat → consume both (safe clear)
  recipes.addRecipe(['paperwork','heat'], (ctx) => {
    const t = ctx && ctx.target; const s = ctx && ctx.gangster; // not used; context provided for parity
    // Represent as an op that the engine will apply: consume target and a source marker
    return [{ consumeTarget: true, consumeSource: true }];
  });
  // Services map directly to single actions
  recipes.addRecipe(['service','gangster'], (ctx) => {
    const target = ctx && ctx.target;
    if (!target) return [];
    if (target.id === 'bookmaker') return ['actLaunder'];
    if (target.id === 'newspaper') return ['actPromo'];
    if (target.id === 'pawn_shop') return ['actProcureEquipment'];
    return [];
  });
}
