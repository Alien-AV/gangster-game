# Infra Plan

## Linting
- ESLint with browser + ES2020 env
- Extends: eslint:recommended
- Parser options: ecmaVersion 2020, sourceType module (or script if preferred)
- Scripts:
  - "lint": "eslint ."
  - "lint:fix": "eslint . --fix"

### Steps
1. npm init -y
2. npm i -D eslint
3. npx eslint --init (or drop a minimal .eslintrc.json)

Minimal .eslintrc.json example:
{
  "env": { "browser": true, "es2020": true },
  "extends": ["eslint:recommended"],
  "parserOptions": { "ecmaVersion": 2020, "sourceType": "script" },
  "rules": {
    "no-unused-vars": ["warn", {"args": "none"}],
    "no-console": "off"
  }
}

## Testing
- Jest with jsdom for DOM-based logic
- Scripts:
  - "test": "jest"
  - "test:watch": "jest --watch"

### Steps
1. npm i -D jest @jest/environment jsdom
2. jest.config.js:
module.exports = {
  testEnvironment: "jsdom",
};

3. Example test: tests/game.core.test.js
- Instantiate Game with minimal DOM nodes used by updateUI()
- Assert tick() updates money/heat
- Assert serializeState()/loadState() round-trip
- Assert card action duration scales by stats

## CI (optional)
- GitHub Actions: node setup, npm ci, npm run lint, npm test

## Dev Server (optional)
- Live Server/Vite for quick reload (static HTML works fine)

## Notes
- Keep `game.js` as a plain script tag; no bundler required for now.
- If modularizing later, switch sourceType to module and split classes into files.
