# ♟ ChessLens

> A clean, zero-dependency chess.com stats viewer — runs straight from Node.js.

![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)
![Zero dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen)

---

## What is it?

**ChessLens** pulls live data from the [chess.com Public API](https://www.chess.com/news/view/published-data-api) and renders a beautiful, mobile-ready stats dashboard — no npm install, no bundler, no framework. Just Node.js and a browser.

---

## Screenshot

```
┌─────────────────────────────────────────────────-┐
│  ♟  Chess Stats  — yournickname                  │
│  [ username input ]          [ Search ]          │
├──────────┬──────────┬──────────┬─────────────────┤
│  ⚡ Bullet│ 🔥 Blitz │  ⏱ Rapid │  📅 Daily        │
│  1204    │  1350    │  1480    │  1560           │
│  W/D/L   │  W/D/L   │  W/D/L   │  W/D/L          │
│  ████░░  │  ████░░  │  █████░  │  █████░         │
└──────────┴──────────┴──────────┴─────────────────┘
           ♟ Tactics Best    🧩 Puzzle Rush
```

---

## Features

- **Live ratings** — Bullet, Blitz, Rapid, Daily — current + personal best
- **W/D/L breakdown** with animated win-rate progress bar
- **Tactics & Puzzle Rush** best scores
- **Username via query param** — `?u=yournickname` — shareable links that always work
- **Player comparison** — `?u=playerone&v=playertwo` for side-by-side mode metrics
- **In-page search form** — search and compare without URL editing
- **Responsive layout** — looks great on iPhone SE and a 4K monitor alike
- **Dark theme** — easy on the eyes, chess.com-inspired gold accents
- **Zero dependencies** — uses only Node.js built-in modules (`http`, `https`, `url`)
- **Input validation** — sanitized output, safe username format check

---

## Quick Start

```bash
# clone or navigate to the folder
cd chess-stats

# run — no npm install needed
node index.js

# open in browser
open http://localhost:3000/?u=yournickname
```

---

## Usage

| Method | Example |
|---|---|
| Query param | `http://localhost:3000/?u=magnuscarlsen` |
| Compare via query params | `http://localhost:3000/?u=magnuscarlsen&v=hikaru` |
| In-page form | Type player 1 (+ optional player 2) → hit **Search** |
| Default port | `3000` |
| Custom port | `PORT=8080 node index.js` |

---

## Stats Displayed

| Category | Current Rating | Best Rating | Wins | Draws | Losses | Win % |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| ⚡ Bullet | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 🔥 Blitz | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ⏱ Rapid | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 📅 Daily | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ♟ Tactics | — | ✅ | — | — | — | — |
| 🧩 Puzzle Rush | — | ✅ (score) | — | — | — | — |

---

## API

Data is fetched from the official chess.com public API (no API key required):

```
GET https://api.chess.com/pub/player/{username}/stats
```

All requests are made **server-side** — no CORS issues, no API keys exposed to the client.

---

## Requirements

- Node.js v18 or later (uses `URL` global, `https.request`)
- Internet access to reach `api.chess.com`

---

## Project Structure

```
chess-stats/
└── index.js   # everything — HTTP server, API fetch, HTML rendering
```

Single-file by design. No build step, no config, no boilerplate.

---

## License

MIT — do whatever you want with it.

---

*Built with ♟ and zero npm packages.*
