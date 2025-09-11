## Upcoming changes

- Enforcer stack rework and assignment model
  - The `enforcers` table card is a stack; dragging from it extracts a single enforcer unit for assignment to a target card.
  - Assigned enforcers contribute their `meat` stat to the action at hand (e.g., collecting protection money).
  - Remove passive patrol by sheer existence; effects come from explicit assignment.

- Equipment cards and stat modification
  - Introduce equipment as cards that can be assigned to gangsters or stacks.
  - Equipment modifies relevant stats (e.g., +Face, +Fist, +Brain, +Meat) while attached.

- Actions locked behind stat requirements.
  - Disagreeable owner can't be intimidated by gangster with Fist < 3 - forcing the boss to hire specialized gangster.

- Buy business fronts, create illegal businesses behind.

- Save/load the actions progress - it's currently possible to start an action on one save, load during the action, and get the effects on another save.


## Abstraction, unification, consolidation

 - Placeholder to keep track of discovered opportunities for refactoring.

## Multi-card recipes and persistent stacks (proposal)

Principles
- Only stacks: all interactions are stack-based. Dropping a card on another only stacks it; no direct recipe execution from a drop path.
- Equal cards: no target/source/actor semantics. A stack is an unordered set of cards residing together; order does not matter.
- Anchor = topmost: timers/chooser render on the current topmost card of the stack for UX consistency; this is purely visual.
- Visual stacking: stacked cards render as overlapped mini-cards (partially covering). Any stacked card can be dragged out to unstack (even from beneath others).

Flow
1) Player drops card A onto card B → A is added to B’s stack.
2) On any stack change (add/remove), the recipe engine matches against the set of member types/ids across ALL cards in the stack.
3) If multiple actions match, show chooser anchored to the topmost card; if one, run; if none, do nothing.
4) Actions run via the standard infra (`executeAction` + `runProgress`). Timers/choosers show on the topmost card. There is no special actor or target passed to actions.
5) After completion, infra consumes specific stack members per recipe’s consumption rule (no directionality). If the recipe specifies outputs, spawn them normally to the table.
6) Repeatable stacks: recipes may be marked repeatable/persistent. After an action completes, re-match the current stack; if the same recipe still matches, automatically run again.

Implementation steps
1) Stack data + UI
   - Add optional `stack: string[]` to table cards (persisted).
   - Render overlapped mini-cards on host; support drag-out to unstack.
2) Drop always stacks
   - Change drop handlers to append to stack; remove immediate pairwise execution.
3) Recipe engine
   - Accept a multiset of member types/ids from the full stack; remove dragged-card special casing and any reliance on actor/target.
   - Support stat requirements against the aggregated stats of the stack (future): e.g., Explore requires Meat ≥ 1; Raid requires Fist ≥ 2 and Meat ≥ 1. Cards contribute to totals: gangsters/enforcers contribute Meat; equipment like pistol contributes Fist but no Meat.
   - Allow recipes to declare post-action consumption as a list of member selectors (type/id) to remove from the stack. If repeatable, leave the consumed/unconsumed members as dictated, then re-match.
4) Execution
   - Hook stack matching into chooser/execution; pass a symmetric context containing the full stack and a computed aggregate stat snapshot. After action, consume exact instances and update the stack.
5) Persistence
   - Save/load stacks alongside table cards; reconcile visuals on load.

Open questions
- Exact mini-card visuals and hit-targets for overlapped stacks.
- Declarative syntax for consumption rules (types vs ids vs counts).

Examples
- Explore: stack contains {neighborhood, gangster_face}. Aggregate stats Meat ≥ 1 satisfied. Action draws from neighborhood deck. Cards remain; stack can be dismantled manually (non-repeatable).
- Use Alibi: stack contains {heat, fake_alibi}. Action consumes both and removes them from the table.
- Raid: stack contains {business, gangster_fist, pistol}. Aggregate stats Fist ≥ 3 (gangster 3 + pistol 2, recipe requires 2), Meat ≥ 1 (gangster). Action runs; applies cooldown/heat, stack breaks unless marked repeatable.

 