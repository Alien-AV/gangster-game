# Gangster Game Prototype

This repository contains a very small prototype for a mafia management game. The game is a semi-idle experiment inspired by games like **Cultist Simulator**. Gameplay revolves around balancing money, manpower and heat while expanding your criminal empire.

For a high level overview of the gameplay ideas, see [game-design.md](game-design.md).

## How to run

Open `index.html` in any modern web browser. No build step or server is required.

You start with only the ability to extort with the boss. A successful extortion claims a block of territory without granting immediate cash. Sometimes the attempt fails, leaving you with a disagreeable owner instead of new turf. As you perform actions new options will unlock. Gangsters no longer have fixed roles – each can attempt any unlocked job but works faster at tasks tied to their chosen specialty (Face, Brain or Fist). The boss can perform any action. Recruited enforcers automatically patrol your territory. Progress bars show how long each action takes. Disagreeable owners steadily push heat up until you address them.
When establishing an illicit business you are prompted to choose between money counterfeiting, drug production, illegal gambling or fencing operations.

This prototype intentionally uses a very minimal user interface to focus purely on testing the core gameplay loop.

## Deployment

Changes merged into `main` are automatically published to **GitHub Pages**
using the workflow defined in `.github/workflows/pages.yml`. Once the action
completes, the game will be available at
`https://<username>.github.io/gangster-game/`.
