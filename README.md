# PhysCards — Codebase Reading Guide

> For a Year 2 CS student with Python/C++ experience and minimal web background.

---

## What This Project Is

PhysCards is a static web flashcard app for O-Level Physics revision. There is no backend server. The entire app is plain HTML, CSS, and JavaScript, bundled by Vite and hosted on Vercel's CDN.

**The two core flows to burn into memory:**

```
Data pipeline:
  Definitions.csv  →  node clean_csv.js  →  public/definitions.json  →  fetch() in browser  →  main.js renders cards

Deploy pipeline:
  git push  →  GitHub  →  Vercel CI  →  npm run build  →  dist/  →  live on CDN
```

---

## File Map

| File | Lines | Role |
|------|-------|------|
| `Definitions.csv` | 136 | Source of truth — all flashcard terms and definitions |
| `clean_csv.js` | 91 | Node script: parses CSV → writes `public/definitions.json` |
| `public/definitions.json` | ~400 | Auto-generated JSON consumed by the browser at runtime |
| `index.html` | 115 | App skeleton — every DOM element is declared here |
| `style.css` | 560 | All visual styling: dark theme, 3D flip, responsive layout |
| `main.js` | 330 | All app logic: state, events, rendering, progress, navigation |
| `match.js` | 34 | Test-mode grading: keyword matching + lightweight stemming |
| `vite.config.js` | 13 | Dev server settings and build configuration |
| `package.json` | 13 | npm scripts and dependency list (only Vite) |
| `vercel.json` | 4 | Tells Vercel how to build and serve the app |
| `TECH.md` | 100 | Architecture overview: data pipeline and deploy pipeline |
| `CLAUDE.md` | 30 | Dev quick-reference: commands and keyboard shortcuts |

---

## Reading Sequence

### Phase 1 — Big Picture (30 min)

**Goal:** Understand what the project does and how the files connect before touching any code.

#### 1. `TECH.md`
Read the "Data Pipeline" and "Build & Deploy Pipeline" sections. Understand what each step does before moving on.

#### 2. `package.json`
Focus on the `"scripts"` block:
```json
"dev":     "vite"        → local dev server (like Flask's app.run())
"build":   "vite build"  → compile everything to dist/ for production
"preview": "vite preview" → serve dist/ locally to verify the build
```
There is only one dependency: Vite. No runtime framework.

#### 3. `vercel.json`
Four lines. It tells Vercel: run `npm run build`, serve the `dist/` folder. This is CI/CD in its simplest form — push to GitHub and the site deploys automatically.

---

### Phase 2 — The Data (20 min)

**Goal:** Know what data the app uses and how it goes from a spreadsheet to the browser.

#### 4. `Definitions.csv` — first 20 rows
Three columns: `Front` (the term), `Back` (the definition), `Topic` (chapter label like `Ch 3: Dynamics`). Each row is one flashcard.

#### 5. `clean_csv.js` — read carefully
This is the most Python-like file. It is a standalone script you run with `node clean_csv.js`.

Key things to understand:

| Concept | What it does | Python equivalent |
|---------|-------------|-------------------|
| `require('fs')` | imports the file system module | `import os` |
| `parseCSVLine(line)` | hand-rolled CSV parser using an `inQuotes` state flag | `csv.reader` |
| Regex on line 41 | `/^Ch\s+(\d+):\s*(.+)$/i` extracts chapter number and title | `re.search(r'Ch\s+(\d+)', s)` |
| `topicMap` (Map) | groups rows by chapter | Python `dict` |

Output written to `public/definitions.json`:
```json
[
  { "chapter": 3, "title": "Dynamics", "terms": [{ "term": "...", "definition": "..." }] }
]
```

---

### Phase 3 — Frontend Structure (30 min)

**Goal:** Know how the browser renders the app before reading the JavaScript logic.

#### 6. `index.html`
Think of this as a template. It pre-declares every element, then JavaScript fills them with real data.

Key sections:
- `<aside id="sidebar">` — left panel with chapter list, shuffle button, progress bar, feedback link
- `<section id="landing">` — welcome screen, shown when no chapter is selected
- `<section id="flashcard-view">` — the flippable card, shown when a chapter is active
- `<script type="module" src="/main.js">` — loads the app. `type="module"` enables ES module `import`/`export`.

The HTML is the skeleton. CSS paints it. JavaScript makes it interactive.

#### 7. `style.css` — skim, do not memorize
Focus on three sections:

1. **Lines 1–77 (Variables)** — CSS custom properties work like module-level constants:
   ```css
   :root { --bg-primary: #0a0a0f; --accent: #7c3aed; }
   /* Used anywhere as: color: var(--accent); */
   ```

2. **Flashcard section** — The 3D flip uses `perspective` and `rotateY(180deg)`. `backface-visibility: hidden` hides the reverse side of each face until the card rotates past 90°.

3. **Media queries** — `@media (max-width: 768px) { ... }` applies different rules on small screens. The sidebar slides off-screen; the card shrinks.

---

### Phase 4 — App Logic (2 hours)

**Goal:** Understand how the app works end-to-end.

#### 8. `match.js` — read in full (20 lines)
Pure logic, no DOM or browser APIs. Start here — it is the easiest JS file.

```javascript
tokenize("The rate of change")
// → ["rate", "change"]  (lowercase, no punctuation, short words dropped)

// stemmer() is the Porter Stemmer from the 'stemmer' npm package
stemmer("changing")  // → "chang"   (suffix stripped)
stemmer("formation") // → "format"  (suffix stripped)

grade(userAnswer, ["rate", "change"])
// → { ok: true, missing: [] }   if user's answer contains both stems
// → { ok: false, missing: ["rate"] }  if a keyword is absent
```

| JS | Python equivalent |
|----|-------------------|
| `new Set([...array])` | `set(list)` |
| `array.map(fn)` | `[fn(x) for x in array]` |
| `array.filter(fn)` | `[x for x in array if fn(x)]` |

#### 9. `main.js` — read in four passes

**Pass 1 — Lines 1–75: State and Initialization**

```javascript
let chapters = [];           // loaded from JSON — list of chapter objects
let currentChapterIdx = -1;  // -1 means "show landing page"
let cardOrder = [];          // indices into terms[], shuffled or sequential
let progress = {};           // { "ch-3": Set([0, 2, 5]) } — indices of known cards
```

`init()` runs on page load: fetches `definitions.json`, loads progress from localStorage, renders the chapter nav, attaches all event listeners.

**`async/await`** — JavaScript's equivalent of Python's asyncio:
```javascript
const res = await fetch('/definitions.json'); // waits for network
chapters = await res.json();                  // waits for JSON parsing
```

**Pass 2 — Lines 76–175: Event Listeners and DOM Caching**

All DOM elements are stored in `const` variables once at the top (caching). Event listeners are callbacks:
```javascript
flashcard.addEventListener('click', flipCard);
// "when the card is clicked, call flipCard()"
```

**Pass 3 — Lines 176–374: Rendering and Navigation**

- `renderChapterNav()` — creates chapter buttons dynamically and appends them to the sidebar
- `selectChapter(idx)` — updates state, resets `cardOrder`, calls `showCard()`
- `showCard()` — branches to `showStudyCard()` or `showTestCard()` based on the `mode` variable
- `goToNext()` / `goToPrev()` — moves through cards with modulo wrap:
  ```javascript
  currentCardIdx = (currentCardIdx + 1) % cardOrder.length;
  ```

**Pass 4 — Lines 375–end: Progress, Shuffle, Keyboard**

- `markKnown()` — toggles a card's index in the `Set`, persists to `localStorage`
- `shuffle()` — Fisher-Yates in-place shuffle (same algorithm from any algorithms course)
- `handleKeyboard(e)` — switch on `e.key`: `ArrowLeft`, `ArrowRight`, `' '` (Space), `Enter`
- Mobile toggle — adds/removes a CSS class; CSS transitions handle the visual slide

---

### Phase 5 — Deployment (15 min)

#### 10. `vite.config.js`
- `publicDir: 'public'` — copies files here into `dist/` as-is (how `definitions.json` ends up in the build)
- `server: { port: 3000, open: true }` — dev server config

#### 11. Trace the full workflow end-to-end
```
Edit Definitions.csv
  → node clean_csv.js      (regenerate JSON)
  → npm run dev            (verify locally at localhost:3000)
  → npm run build          (compile to dist/)
  → npm run preview        (verify production build at localhost:4173)
  → git push               (triggers Vercel CI → live site)
```

---

## JavaScript Concepts You Need (Python/C++ Analogies)

| JavaScript | Python | Notes |
|-----------|--------|-------|
| `const x = 5` | `X = 5` (constant) | Cannot be reassigned |
| `let x = 5` | `x = 5` | Can be reassigned |
| `(x) => x * 2` | `lambda x: x * 2` | Arrow function |
| `` `Hello ${name}` `` | `f"Hello {name}"` | Template literal |
| `async / await` | `asyncio` | Async without callback chains |
| `array.map(fn)` | `[fn(x) for x in array]` | Transform each element |
| `array.filter(fn)` | `[x for x in array if fn(x)]` | Keep matching elements |
| `new Set([...])` | `set(list)` | Unique values, O(1) lookup |
| `{ key: value }` | `{'key': value}` | Object (dict) literal |
| `import { fn } from './file.js'` | `from file import fn` | ES module import |
| `document.querySelector('#id')` | — | Find a DOM element by CSS selector |
| `element.addEventListener('click', fn)` | — | Register a callback for a user action |
| `element.classList.toggle('x')` | — | Add class if absent, remove if present |
| `localStorage.setItem(k, v)` | `shelve` / pickle | Persists across page reloads |

---

## How the Three Frontend Files Relate

```
index.html          →  defines all elements (structure)
    ↓ references
style.css           →  controls how elements look (presentation)
    ↓
main.js             →  controls what elements do (behaviour)
    ↓ imports
match.js            →  grades test answers (pure logic)
    ↓ fetches
public/definitions.json  →  the flashcard data
```

---

## Five Questions to Test Your Understanding

After reading, try to answer these without looking:

1. You add a new term to `Definitions.csv`. What exact steps do you take before it appears on the live site?
2. Where in `main.js` does the app decide to show the landing page versus a flashcard?
3. How does a card get marked as "known" and how does that survive a page reload?
4. What does `cardOrder` contain, and why is it an array of indices rather than the card objects themselves?
5. In `match.js`, why does `grade()` call `stem()` on both the keywords *and* the user's answer?
