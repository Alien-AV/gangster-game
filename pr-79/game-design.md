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
Gangsters now have a primary **specialty** (Face, Fist or Brain) which grants a
speed bonus when performing related actions. Unlike the original design where a
Face could only extort or a Fist only recruit enforcers, any gangster may now
carry out any unlocked task. Their specialty simply determines which actions
they are more efficient at.

* **Face actions** – extorting territory and recruiting additional gangsters.
* **Fist actions** – recruiting enforcers, raiding rival businesses and
  intimidating disagreeable owners.
* **Brain actions** – buying businesses, establishing illicit operations and
  laundering money.

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
