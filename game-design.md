# Gangster Game Design Notes

This prototype explores a lightweight mafia management loop. Actions unlock progressively and the entire UI is kept intentionally minimal so we can focus on whether the core balancing act is fun.

## Core Resources
- **Money** – needed to recruit enforcers, hire gangsters and pay off the police.
- **Enforcers** – basic manpower. They can patrol your territory or be assigned to gangsters.
- **Territory** – city blocks under your control. More territory means more potential profit but requires more patrols or heat rises.
- **Heat** – unwanted attention from law enforcement. Can be reduced by paying off cops.
- **Businesses** – legitimate fronts that can host illicit operations.
- **Available Fronts** – businesses not yet hosting illicit operations.
- **Fear** – represents how cowed local businesses are. Certain actions raise it and may unlock future bonuses.

## Card-Based Overhaul (Prototype Plan)

We are transitioning the interaction model to a card-driven UI inspired by Cultist Simulator/Stacklands.

### Core Concepts

- **Gangster Cards**
  - Each gangster is represented as a draggable card.
  - Cards show name/id, type, heat, and a stat line, e.g. `Fist:1 Face:2 Brain:1`.
  - Stats represent individual skill variance and modify action speeds/effectiveness.
    - Face stat => faster/better extortion/promotions.
    - Brain stat => faster/better illicit building/laundering/donations.
    - Fist stat => faster/better raids/intimidation/vigilante patrol.
  - Future: merge/equip other cards (e.g., guns, enforcers) to buff stats and form squads.

- **Action Blocks (Workstations)**
  - Actions are fixed blocks on a canvas/board (e.g., Extort, Build Illicit, Launder, Buy Business, Raid, Intimidate, Promotional Campaign, Donate to Soup Kitchen, Vigilante Patrol).
  - Drag a gangster card onto an action block to start that action.
  - When action completes, results (money, respect, fear, etc.) are applied and the card returns to the card area.

### Drag-and-Drop Rules

- Dragging disabled while the gangster is busy.
- Dropping onto an incompatible action shows feedback and returns the card.
- Duration = baseDuration / (1 + relevantStat * scaling).
  - Initial scaling: 10% speed-up per stat point (tunable).

### MVP Scope (this iteration)

- Keep the existing UI working, and layer a prototype board:
  - Render a Cards area with gangster cards.
  - Render an Actions area with blocks for: Extort, Recruit Enforcer, Buy Business, Build Illicit, Launder, Raid, Intimidate, Promotional Campaign, Donate Soup, Vigilante Patrol.
  - Implement drag-and-drop triggers to call the same underlying effects already present in game logic with stat-modified durations.
  - Show progress bars on action blocks while a gangster is working; lock the gangster until completion.

### Persistence

- Save/Load must preserve gangster stats. For legacy saves without stats, default by type:
  - Face: { face: 2, fist: 1, brain: 1 }
  - Brain: { face: 1, fist: 1, brain: 2 }
  - Fist: { face: 1, fist: 2, brain: 1 }

### Future Extensions

- Card merging/equipment (weapons, lieutenants) to increase stats and convert a gangster to a squad card.
- Action outputs as result cards (e.g., goods, favors) that can be combined or sold.
- Spatial mechanics on the canvas (placement bonuses, adjacency effects).
- Multi-slot actions (drop 2+ cards to cooperate on a difficult task).

### Progression System (Planned)
- Replace simple unlock flags with a tiered progression model.
- Early actions (e.g., extort in local neighborhood) have 0% risk and can yield small beneficial effects.
- As the player expands into larger city regions, actions impose higher risk and/or requirements (minimum stats/resources, prep tasks) to operate effectively.
- Preparation loops (gather gear, improve stats, reduce heat) mitigate risks and time costs before attempting higher-tier actions.

### Open Questions

- Balance between click UI and card UI (timeline to fully replace old UI).
- Visual theming and animations.

## Gangsters
- **Face** – used to extort surrounding blocks, potentially expanding territory if the owner cooperates.
- **Fist** – recruits enforcers and can raid rival businesses for quick cash at the cost of heat.
- **Brain** – sets up illicit businesses behind purchased fronts.
  They can also launder dirty money into clean profits once businesses are available.

## Gameplay Loop Example
1. Extort with the boss to seize your first block of territory.
2. Recruit enforcers (they automatically patrol your territory) to keep heat down. Fists specialize in this and can also raid rival businesses for large cash payouts.
3. Hire gangsters and choose their specialty. Faces handle the recruiting once unlocked.
4. Use Face gangsters to expand territory which increases your passive income.
5. Have Brains purchase businesses and then create illicit operations behind them. When building an illicit operation you can select from counterfeiting money, producing drugs, running illegal gambling or fencing stolen goods.
6. Balance money, territory, patrols and heat while gradually growing your empire. Heat rises each second based on unpatrolled blocks and any disagreeable owners.
7. Occasionally an extortion attempt fails, leaving a disagreeable owner who refuses to pay. Failed extortions do not add territory and the owner will steadily raise heat until dealt with. These are tracked by a "disagreeable owners" counter.
8. Send Fists to intimidate these owners. Successful intimidation removes one disagreeable owner and increases fear.

These notes are kept short on purpose – the goal is simply to track the prototype design as it evolves.








## Game Start Scenario

1. Boss begins in a local neighborhood block, with ability to explore "the neighborhood".
2. During the exploration, Boss can locate "events", "places" or "people" to interact with.
3. Some of the places are businesses that can be extorted for money - they will have minimal requirements that boss handily satisfies, and thus don't have risk of failure or raise heat.
4. Other cards are potential recruits, say, one of each type of gangster, and several enforcers.
5. Other businesses can be purchased for money, and then used to host illicit operations.
6. After establishing a foothold, Boss can find a way to expand into other neighborhoods, which he personally couldn't tackle, and needs to equip and prepare his gangsters to handle the new territory.

