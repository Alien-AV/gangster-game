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

## Gangsters
Gangsters no longer have rigid roles. Each one can perform any unlocked action
but has three skill ratings – **Face**, **Fist** and **Brain**. A higher rating
makes actions in that category faster. When hiring a gangster you still choose a
specialty which grants a higher starting rating in that area.

## Gameplay Loop Example
1. Extort with the boss to seize your first block of territory.
2. Recruit enforcers (they automatically patrol your territory) to keep heat down. Gangsters with higher **Fist** skill are best at this and can also raid rival businesses for large cash payouts.
3. Hire gangsters and choose their specialty. The chosen specialty simply gives them a head start in that skill.
4. Use gangsters with strong **Face** skill to expand territory which increases your passive income.
5. Have those with high **Brain** skill purchase businesses and set up illicit operations. When building an illicit operation you can select from counterfeiting money, producing drugs, running illegal gambling or fencing stolen goods.
6. Balance money, territory, patrols and heat while gradually growing your empire. Heat rises each second based on unpatrolled blocks and any disagreeable owners.
7. Occasionally an extortion attempt fails, leaving a disagreeable owner who refuses to pay. Failed extortions do not add territory and the owner will steadily raise heat until dealt with. These are tracked by a "disagreeable owners" counter.
8. Intimidate these owners with any gangster, though ones with better **Fist** skill will finish faster. Successful intimidation removes one disagreeable owner and increases fear.

These notes are kept short on purpose – the goal is simply to track the prototype design as it evolves.
