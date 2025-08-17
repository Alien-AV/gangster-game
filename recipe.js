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
