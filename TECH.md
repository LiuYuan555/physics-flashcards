# TECH.md

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Vanilla JavaScript (ES modules, no framework) |
| Bundler | [Vite 5](https://vitejs.dev/) |
| Styles | Plain CSS with custom properties |
| Hosting | [Vercel](https://vercel.com/) (static site) |
| Source control | GitHub (`LiuYuan555/physics-flashcards`) |

No build-time JS framework, no TypeScript, no UI library.

---

## Data Pipeline

```
Definitions.csv
      │
      │  node clean_csv.js   (run manually)
      ▼
public/definitions.json
      │
      │  vite build          (copies publicDir → dist/)
      ▼
dist/definitions.json
      │
      │  fetch('/definitions.json')   (runtime, on page load)
      ▼
main.js  →  renders flashcard UI
```

### Definitions.csv

The authoritative data source. Three columns:

| Column | Description |
|--------|-------------|
| `Front` | The term shown on the card front |
| `Back` | The definition shown on the card back |
| `Topic` | Chapter label in the format `Ch N: Title` |
| `Keywords` | Pipe-separated content words auto-extracted from the definition; used for test-mode grading |

Each row is one flashcard. Chapter number is embedded in the Topic string (e.g. `Ch 11: General Wave Properties I - Introduction`) and is parsed out by `clean_csv.js`.

### clean_csv.js

Node script (CommonJS, uses `csv-parse`) that:
1. Parses the CSV with the `csv-parse` library
2. Groups rows by Topic, extracts chapter number and title from the `Ch N: Title` prefix
3. Sorts groups by chapter number
4. Writes `public/definitions.json` — shape: `[{ chapter, title, terms: [{term, definition, keywords}] }]`

Run with `node clean_csv.js` after editing the CSV. Output goes to `public/` so Vite copies it into `dist/` on build.

### public/definitions.json

Intermediate artefact consumed by the app at runtime via `fetch('/definitions.json')`. Committed to the repo so the dev server works without running the parse step first.

---

## Build & Deploy Pipeline

```
git push → GitHub → Vercel CI → npm run build → dist/ → CDN edge nodes
```

Vercel is configured via `vercel.json`:
- Framework: `vite`
- Build command: `npm run build`
- Output directory: `dist`

No server-side functions — the entire app is a static bundle. `definitions.json` is served as a static asset from Vercel's CDN.

---

## Client-Side Architecture

All app logic lives in three files:

| File | Role |
|------|------|
| `index.html` | Full HTML shell; all DOM elements pre-declared, no dynamic injection at root |
| `main.js` | State, data fetching, card flip/navigation, shuffle, progress, keyboard/touch |
| `style.css` | All styles; CSS custom properties for theming |

### State (main.js)

| Variable | Type | Purpose |
|----------|------|---------|
| `chapters[]` | Array | Loaded from JSON; the full dataset |
| `currentChapterIdx` | Number | Which chapter is active (-1 = landing) |
| `cardOrder[]` | Number[] | Indices into `terms[]`, shuffled or sequential |
| `currentCardIdx` | Number | Position in `cardOrder` (not a direct term index) |
| `progress` | Object | `{ "ch-N": Set([term indices]) }` — which cards are marked known |

Progress is persisted to `localStorage` under the key `physcards-progress`. Sets are serialised to arrays for JSON storage.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Previous / next card |
| `Space` | Flip card |
| `Enter` | Toggle "known" |
