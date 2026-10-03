# GEDCOM Family Tree

Interactive family tree viewer with AI-powered assistant.

![Demo](demo-screenshot.png)

Try the demo: load [`demo.ged`](demo.ged) to see a sample family tree, or [`demo-catala.ged`](demo-catala.ged) and import the story [`demo-catala.historia.json`](demo-catala.historia.json) from **Històries**.

## Features

- Parse GEDCOM 5.5.1 and 7.0 files (MyHeritage compatible), plus GEDZIP (`.gdz`) packages with photos
- Reads UTF-8, UTF-16, ANSEL and ANSI files, and any line ending
- Interactive family tree: focus on a person, pan and zoom, level of detail when zoomed out
- Person panel for research: events with their notes and cited sources (with page), other names, every parent family, siblings and half-siblings, notes and sources
- UI in Catalan
- Tree Health: in-browser GEDCOM lint (gedlint, WASM)
- Research: **Recerca** lists who in the view still lacks basic facts (birth, parents, death, marriage, occupation, photo, sources), most incomplete first. **Entrevista**, from the person panel, turns those gaps into questions to ask a relative or look up in an archive; answers are kept in the browser, shown in the person panel, copyable as text, and fed to the AI so its stories can use family memories
- Stories: guided walks through the family for relatives, step by step, each step a narrative beside the tree (people highlighted), a photo or a document. Kept in the browser per tree; export/import as `.historia.json`
- Story packages (`.historia.zip`): share one story with relatives who do not have the tree. It carries the story, only the people it shows and its photos; living people (no death, born within 100 years) stay as anonymous boxes. Opening one on the upload screen goes straight into the story
- Story maps: places and migration routes on the ICGC topographic map, or a Catalan village as the 1945-46 and 1956-57 American flights photographed it (ICGC historical orthophotos). The AI geocodes places with the ICGC geocoder, OpenStreetMap outside Catalonia
- AI assistant for genealogy queries (off by default, see below)
- Responsive mobile-friendly UI

## Tech Stack

- **Frontend**: React + Vite + Tailwind, PixiJS canvas, custom layout on d3-hierarchy, d3-zoom
- **Backend**: Hono + AI SDK (Anthropic)
- **Parser**: TypeScript GEDCOM parser

## Getting Started

```bash
pnpm install
pnpm dev        # builds shared + parser, then runs frontend (:5173) and backend (:3001)
pnpm test:run   # tests run against source, no build needed
pnpm typecheck
pnpm lint
```

Parsing and layout run in Web Workers, so the UI stays responsive on large files.

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_AI_ENABLED` | frontend | `true` shows the AI panel |
| `ANTHROPIC_API_KEY` | backend | Needed by the AI assistant |
| `GEDLINT_BIN` | backend | Path to a native gedlint binary for the AI audit tool |

## Structure

```
packages/
├── frontend/   # React UI (deployed as Cloudflare static assets, see wrangler.toml)
├── backend/    # API server for the AI assistant
├── parser/     # GEDCOM parser
└── shared/     # Shared models and utilities
```
