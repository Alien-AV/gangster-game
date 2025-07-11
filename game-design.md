# Gangster Game Design Notes

This prototype explores a lightweight mafia management loop. Actions unlock progressively and the entire UI is kept intentionally minimal so we can focus on whether the core balancing act is fun.

## Core Resources
- **Money** – needed to recruit mooks, hire lieutenants and pay off the police.
- **Mooks** – basic manpower. They can patrol your territory or be assigned to lieutenants.
- **Territory** – city blocks under your control. More territory means more potential profit but requires more patrols or heat rises.
- **Heat** – unwanted attention from law enforcement. Can be reduced by paying off cops.
- **Businesses** – legitimate fronts that can host illicit operations.

## Lieutenants
- **Face** – used to extort surrounding blocks, expanding territory and generating cash.
- **Fist** – keeps unruly businesses in line when patrols are thin (not yet implemented).
- **Brain** – sets up illicit businesses behind purchased fronts.

## Gameplay Loop Example
1. Extort with the boss to seize your first block of territory.
2. Recruit mooks (they automatically patrol your territory) to keep heat down.
3. Hire lieutenants and choose their specialty.
4. Use Face lieutenants to expand territory and earn more money.
5. Buy a business and assign a Brain lieutenant to create an illicit operation.
6. Balance money, territory, patrols and heat while gradually growing your empire.

These notes are kept short on purpose – the goal is simply to track the prototype design as it evolves.
