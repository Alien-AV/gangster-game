# Short-term Plan

This file tracks near-term tasks to align the prototype with the intended design. It explains what we are about to build, why, and serves as the single source of truth for updating docs and implementation in lockstep.

## Upcoming changes

- Implement vigilantism as a choice for local criminals
  - On the `small_crooks` table card, present a chooser with options like "Recruit Enforcer" or "Vigilante Patrol" when a gangster is dropped.
  - Use the existing `actVigilante` semantics (Fist-based duration, +respect, +heat) for the vigilantism branch.

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

- Salaries and money flow breakdown
  - Add salaries to enforcers.
  - Display a per-tick breakdown line of income/expenses, e.g., "+100 from protection −50 from gangsters −10 from enforcers".

- Specialized Gangsters having better specialized stat than the Boss

- Reduce flickering on the main screen and unneeded reload after actions that breaks animations
