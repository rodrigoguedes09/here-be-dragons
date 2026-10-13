# Contributing

Thanks for wanting to improve the maps. A few notes to get you going.

## Setup

```bash
git clone https://github.com/rodrigoguedes09/here-be-dragons
cd here-be-dragons
npm test              # no install step: there are zero dependencies
node bin/cli.js .     # map this very repository
```

Node 18+ and git are all you need.

## Where things live

| File | What it does |
|---|---|
| `src/git.js` | Reads the tree at `HEAD` and the history (`git log --numstat`), following renames |
| `src/classify.js` | Decides which files go on the map and what kind of land they are |
| `src/analyze.js` | Hotspots, coupling, ownership, knowledge loss, AI authorship, provinces, dragons |
| `src/layout.js` | Circle packing, Voronoi terrain, coasts, borders, biomes, label placement |
| `src/render.js` | The ink-and-parchment SVG |
| `src/html.js`, `src/viewer/` | The interactive atlas |
| `src/chronicle.js` | The story and the quests |
| `src/report.js` | Terminal, Markdown and JSON output |

## Principles

- **Every mark means something.** If it's on the map, it comes from the repository. Pure decoration stays subtle (paper, grass tufts, sea names).
- **Deterministic.** The same repository and seed must always draw the same map.
- **Local and dependency-free.** No network calls during analysis, no runtime dependencies.
- **Honest.** Pair fantasy names with real paths and numbers everywhere they're shown.

## Ideas for good first contributions

- Better test-file pairing for your language (`stem()` in `src/classify.js`).
- New AI agent signatures (`AI_SIGNS` in `src/analyze.js`).
- A new map theme (`THEMES` in `src/render.js`).
- New sea names. They're in `src/names.js`, and puns are welcome.
- Your favorite project's map in the gallery (`scripts/gallery.mjs`).

## Previewing changes

`node scripts/preview.mjs <repo> out.png` renders a map and screenshots it with a local Chrome/Edge, which is handy when you tune the art. Please include before/after images in pull requests that change how maps look.
