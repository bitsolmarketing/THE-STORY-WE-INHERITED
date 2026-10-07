# INHERITED — A Visual History of Pakistan

A VACTRA TECH interactive experience: a cinematic journey through Pakistan's history, 1947 – 2026,
that you move with your own scroll, with the research archive behind every moment.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. For the competition machine, use the production build:

```bash
npm run build
```

```bash
npx vite preview --port 4173
```

### Useful URL flags

- `?enter` — skip the entry screen (kiosk / testing)
- `?quality=high|medium|low` — force a quality tier
- `#timeline`, `#archive`, `#sources`, `#about`, `#menu` — open a layer directly

## Two ways in

- **Play the Judges' Cut** — the curated film, about two minutes, plays by itself and pauses the
  moment you scroll.
- **Enter the full experience** — the same film at your own pace. Each chapter arrives, develops
  and holds before the year turns; the timeline (right edge or Menu → Timeline) travels anywhere.

## Content

- Sequence: `docs/STORYBOARD_FINAL.pdf` → `src/data/story/events.ts` (56 beats).
- Archive: `docs/archive/MASTER_IMAGE_MANIFEST.csv` → `npm run import:archive`.
- Rights: only clear / likely-clear real material appears in the film; VERIFY items are
  archive-only and marked. Nothing is generated to look historical.

See `docs/ARCHITECTURE.md` for the engine, the data contract and the verification scripts.
