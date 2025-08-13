# Gangster Game Prototype

This repository contains a very small prototype for a mafia management game. The game is a semi-idle experiment inspired by games like **Cultist Simulator**. Gameplay revolves around balancing money, manpower and heat while expanding your criminal empire.

For a high level overview of the gameplay ideas, see [game-design.md](game-design.md).

## How to run

Open `index.html` in any modern web browser. No build step or server is required.

You interact with a table of cards stored in `state.table.cards`. Drag gangsters onto table cards to act:

- Boss can perform any action. Faces handle social tasks (extort, recruit), Brains handle economic tasks (buy, build, launder), Fists handle force (recruit enforcers, raid, intimidate).
- Dropping a gangster on a business opens a choice popup (chooser) to select Extort or Raid. Actions run with progress bars; duration scales with the relevant stat. Soon, stats will gate options (e.g., low Face may hide/disable certain choices).
- Successful Extort adds territory; failed attempts create a disagreeable owner that increases heat until handled (e.g., Intimidate). Raids yield fast dirty money and heat, and place the business on cooldown.
- Enforcers can be recruited; assignment- and stack-based behavior is planned (see `PLAN.md`).
- Building an illicit operation lets you choose a type (counterfeiting, drugs, gambling, fencing).

This prototype intentionally uses a very minimal user interface to focus purely on testing the core gameplay loop.

## Roadmap (short-term)

See `PLAN.md` for upcoming changes (chooser-first interactions, heat rework to time-limited cards, enforcer stack/assignment, equipment stat mods, and money flow breakdown).

## Deployment

Changes merged into `main` are automatically published to **GitHub Pages**
using the workflow defined in `.github/workflows/pages.yml`. Once the action
completes, the game will be available at
`https://<username>.github.io/gangster-game/`.
