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
- Equal cards: no target/source semantics. A stack is an unordered set of cards residing on a host card.
- Visual stacking: stacked cards render as overlapped mini-cards (partially covering). Any stacked card can be dragged out to unstack (even from beneath others).

Flow
1) Player drops card A onto card B → A is added to B’s stack.
2) On any stack change (add/remove), recipe engine matches against the set of member types/ids (host + all stacked cards).
3) If multiple actions match, show chooser; if one, run; if none, do nothing.
4) Actions run via the standard infra (`executeAction` + `runProgress`).
5) After completion, infra consumes specific stack members per recipe’s consumption rule (no target/source; equal-card model).
6) Persistent stacks: recipes may be marked persistent. After an action completes, re-match the current stack; if the recipe still matches, re-run through the same flow (no custom loop fields; reuse action base timing).

Implementation steps
1) Stack data + UI
   - Add optional `stack: string[]` to table cards (persisted).
   - Render overlapped mini-cards on host; support drag-out to unstack.
2) Drop always stacks
   - Change drop handlers to append to stack; remove immediate pairwise execution.
3) Recipe engine
   - Accept a multiset of member types/ids from host+stack; remove dragged-card special casing.
   - Allow recipes to declare post-action consumption as a list of member selectors (type/id) to remove from the stack.
4) Execution
   - Hook stack matching into chooser/execution; after action, consume exact instances and update the stack.
5) Persistence
   - Save/load stacks alongside table cards; reconcile visuals on load.

Open questions
- Exact mini-card visuals and hit-targets for overlapped stacks.
- Declarative syntax for consumption rules (types vs ids vs counts).

 