# Gangster Game Prototype

This repository contains a very small prototype for a mafia management game. The game is a semi-idle experiment inspired by games like **Cultist Simulator**. Gameplay revolves around balancing money, manpower and heat while expanding your criminal empire.

## How to run

Open `index.html` in any modern web browser. No build step or server is required.

You start with only the ability to extort with the boss. As you perform actions new options will unlock. Use the buttons to recruit mooks, assign them to patrols, recruit lieutenants and buy businesses. Progress bars show how long each action takes.

This prototype intentionally uses a very minimal user interface to focus purely on testing the core gameplay loop.

## Deployment

Changes merged into `main` are automatically published to **GitHub Pages**
using the workflow defined in `.github/workflows/pages.yml`. Once the action
completes, the game will be available at
`https://<username>.github.io/gangster-game/`.
