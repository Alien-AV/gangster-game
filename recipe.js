// Simple declarative Recipe engine for stacking interactions
// Future-ready for multi-card stacks; for now we match by set of types
export class RecipeEngine {
  constructor() {
    this.recipes = [];
  }
  // pattern: array of types, e.g., ['business','gangster']
  // action: function(game, context) -> { actionId, label, stat, base, cost?, effect? }
  addRecipe(pattern, actionBuilder) {
    const key = this._keyFor(pattern);
    this.recipes.push({ key, size: pattern.length, actionBuilder });
  }
  _keyFor(types) {
    return types.slice().sort().join('+');
  }
  // Given an array of card types present in the stack, returns an action config or null
  match(types, context) {
    const key = this._keyFor(types);
    const rec = this.recipes.find(r => r.key === key && r.size === types.length);
    if (!rec) return null;
    return rec.actionBuilder(context);
  }
}
