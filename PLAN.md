# Short-term Plan

- card render rework and unification project
  - Goals
    - Unify card rendering into a single function that builds common HTML and conditionally adds specifics based on the card definition.
    - Eliminate duplicated rendering code between `renderWorldCard` and `ensureGangsterNode`. (DONE)
    - Move hints, descriptions, stats, and drag behavior declarations into `CARD_DEFS`. (DONE)
    - Cards declare `handlers` (e.g., `onCreate`, `onExpire`) by name; actual functions live in `card.js` in a shared handlers map. (PARTIAL: onCreate in place; others as needed)
  - Steps
    1) Add complete data to `CARD_DEFS` for all cards, including gangsters and boss: images, descriptions, hints, stats, draggable flags, and handler pointers. (DONE)
    2) Update `renderWorldCard` to read from `CARD_DEFS` and render:
       - Base title/art/desc
       - Optional stats block if `stats` present
       - Optional badges/timers based on type/state
       - Apply `draggable` uniformly if declared
    3) Replace the gangster-specific HTML in `ensureGangsterNode` with a call to the unified renderer and type hooks; keep only data-binding (dataset gid) and gangster-only event wiring if still needed. (DONE)
    4) Remove hints from `getCardInfo`; read hints directly from `CARD_DEFS`. (DONE)
    5) Replace `CARD_BEHAVIORS` per-type rendering tweaks with small renderer hooks or per-type sections in the unified renderer when necessary. (IN PROGRESS)
    6) Delete any remaining duplicate code paths; ensure tests and lint pass. (IN PROGRESS)

This file tracks near-term tasks to align the prototype with the intended design. It explains what we are about to build, why, and serves as the single source of truth for updating docs and implementation in lockstep.

## Upcoming changes

- Rework heat mechanic (remove global heat counter)
  - Replace the global heat/heatProgress with spawned Heat cards on the table.
  - Each Heat card has a timer and a consequence on expiration (e.g., fines, crackdowns, loss of assets).
  - Existing mitigation actions (Pay Cops, Donate, Intimidate) will interact with/disarm Heat cards.

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