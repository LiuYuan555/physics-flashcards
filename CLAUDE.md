# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000 (auto-opens browser)
npm run build    # Build to dist/
npm run preview  # Preview the production build locally

node clean_csv.js  # Re-parse Definitions.csv → public/definitions.json
```

No linter or test suite is configured.

## Architecture

This is a vanilla JS + Vite static site — no framework, no TypeScript, no build-time bundling of app logic beyond Vite's module bundling.

**Data pipeline:** `Definitions.csv` (raw source) → `clean_csv.js` (Node script, run manually) → `public/definitions.json` (served at `/definitions.json` at runtime). The JSON is fetched by `main.js` on page load via `fetch('/definitions.json')`. The `dist/definitions.json` is a copy produced by Vite's `publicDir` copy during `npm run build`.

**App structure (all in three files):**
- [index.html](index.html) — full HTML shell with all DOM elements pre-declared; no dynamic HTML injection at the root level
- [main.js](main.js) — all app logic: state, DOM refs, data fetching, card flip/navigation, shuffle (Fisher-Yates), progress tracking, and keyboard/touch handlers
- [style.css](style.css) — all styles; uses CSS custom properties for theming

**State model in `main.js`:**
- `chapters[]` — loaded from JSON; shape `[{ chapter, title, terms: [{term, definition}] }]`
- `progress` — object keyed by `"ch-N"`, values are `Set` of known card indices; persisted to `localStorage` under key `physcards-progress`
- `cardOrder[]` — indices into the current chapter's `terms[]`, shuffled or sequential
- Navigation indexes: `currentChapterIdx` and `currentCardIdx` (position into `cardOrder`, not into `terms` directly)

**Keyboard shortcuts:** Arrow keys navigate, Space flips, Enter marks known.

**Deployment:** Vercel (`vercel.json` sets framework to `vite`, build command `npm run build`, output `dist`).
