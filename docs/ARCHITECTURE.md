# ARCHITECTURE — INHERITED · A Visual History of Pakistan

A VACTRA TECH interactive experience. This document is authoritative on technical structure.
Story and sequence: `docs/STORYBOARD_FINAL.pdf` (56 beats, 1947 – 2026). The original 1947 slice
spec (`SPEC_PHASE01.md`) still governs the opening's visual language.

## 1. Stack

| Concern | Choice |
| --- | --- |
| Build | Vite 8 + TypeScript (strict) |
| UI | React 19 (DOM shell + overlays) |
| 3D | three + @react-three/fiber (one Canvas, one frame loop) |
| State | zustand: coarse reactive state only; per-frame values live in a mutable `frame` object |
| Audio | Web Audio API, fully procedural (no music, no audio assets), off until the visitor turns it on |
| Data | Typed local data behind provider / repository interfaces (backend-ready) |
| Verification | vitest (engine), Playwright scripts in `e2e/` (headless Chromium, software WebGL) |

## 2. The one progress value

- `ScrollTrack` gives the page its length: `timeline.trackVh` (full-experience seconds × 42vh).
- `ScrollProgress` (the only scroll listener) writes `frame.target` (0..1).
- `CinematicLoop` (one `useFrame`, priority −1000) every frame:
  1. damps `frame.progress` toward the target (heavy: λ = 3.2),
  2. caps film speed at 7 film-seconds per real second (a flick never skips decades),
  3. leashes the scroll position to at most 8 film-seconds ahead of the film,
  4. drives the camera through the `CameraDirector`,
  5. publishes beat changes to the store,
  6. runs DOM ticks (`engine/loop/ticker.ts`): year wheel, captions, veils, chrome, audio mix.
- Everything visual is a pure function of `frame.progress`, so reverse scrolling is free.

## 3. Event-locked timeline (`engine/timeline/timeline.ts`)

`buildTimeline({ opening, events })` lays out beats in order:

```
opening chapters (1947)  →  E03  →  T:E03>E04  →  E04  →  …  →  E56  →  epilogue
```

- **event** beats have phases: *arrive* (camera settles) → *develop* (motif draws) → *hold*.
- **transition** beats sit between every pair of events; the year changes **only** here,
  rolling like an odometer through the intermediate years (`odometer()`).
- Pacing is authored twice in `PACING`: `full` (scroll distance) and `judges` (Judges' Cut
  playback speed). Major 7 s / 2.9 s, featured 4 / 1.4, standard 2.6 / 0.8 …
- Helpers: `beatAt`, `local`, `yearAt`, `restingProgress`, `judgesTimeAt`, `progressAtJudgesTime`.
- Tests: `timeline.test.ts` (order, year never changes inside an event, ~2-minute cut, odometer).

## 4. Camera

- `CameraDirector` cuts between rigs (every cut happens under the paper veil):
  - **opening** — `CameraController` keyframes in `scenes/cameraPath.ts`, authored relative to
    chapter ranges (`at('partition', 0.5)`), so re-pacing never breaks the camera.
  - **chronicle** — procedural rostrum camera (`scenes/chronicle/chronicleCamera.ts`) gliding
    along the spine; on major/featured events it leans down over the hero photograph during
    the hold (documentary cutaway).
- `applyPose` widens the FOV on narrow (portrait) screens to keep ~70% of the composition.

## 5. Scenes (`SceneManager` mounts by proximity, lazily)

| Scene | What it is |
| --- | --- |
| `scenes/paper` | One plane + `PaperMaterial`: prologue darkness, dust gathering into the land (`Dust`), the 1947 map, "1947" embossed, the olive wash of the new state (masked out of J&K), partition ink (`PartitionInk`), migration flows, archival prints on the map, map → earth. |
| `scenes/world` (lazy) | Paper cut-out diorama rising out of the map at Lahore: station, crowd, the composite traveller, the train (hollow carriage, compartment, barred window), the scrolling Punjab landscape. The train never moves; the world does. |
| `scenes/chronicle` (lazy) | 1948 → 2026: the paper table, the ink spine with a tick for every year, plates (motif + photographs) mounted near the camera only. |

Opening curves live in one place: `scenes/openingCurves.ts`.

### Motifs (`scenes/chronicle/motifs/`)
22 generators (portrait, document, constitution, nameplate, rivers, dam, route, network, split,
frontline, contours, seismic, crowd, memorial, trajectory, aircraft, rocket, industry, ballot,
unification, dialogue, horizon). Each returns strokes / fills / labels / dots in plate space;
`shared/ink.ts` turns them into one geometry + one material per plate (draw-on, rise, dashes).

### Photographs
`scenes/chronicle/filmPrints.ts` reads `src/data/archive/filmIndex.json` (generated) — only
images held locally, rights clear or likely clear, real material. Hero first; up to 4 per major
event. `shared/Print.tsx` renders a print (border, contact shadow, warm duotone in the shader,
"develops" out of the paper; click → archive record).

## 6. Shell and layers (`src/ui`)

- Entry screen (`Intro`) → Judges' Cut or the full journey.
- `TopBar` (INHERITED · VACTRA TECH · MENU), `TimelineRail`, `Captions` (+ IN POWER),
  `YearIndicator` (odometer date stamp), `BottomBar` (scroll cue · Judges' Cut player · ARCHIVE ·
  SOUND), `PaperVeil`, `EpilogueCard`.
- Layers (URL hash addressable): `#menu`, `#timeline`, `#archive`, `#sources`, `#about`.
- Navigation: `engine/navigation.ts` — near targets scroll smoothly; far targets cut through
  paper while the odometer rolls to the destination year.
- Judges' Cut: `engine/judgesCut.ts` — wall-clock playback of the same film (no per-frame page
  scrolling); any wheel / touch / key pauses and hands control back.

## 7. Data boundary (backend contract)

- `data/story/types.ts` — `StoryEvent { id, year, date, dateLabel, title, description, type,
  importance, movement, duration?, visualTreatment, archivalAssets?, sources?, rightsStatus?,
  peopleInPower?, sound? }`.
- `data/story/provider.ts` — `StoryProvider` (opening, events, timeline). Replace the static
  provider with an API-backed one and call `setTimeline(provider.timeline())`.
- `data/archive/types.ts` — `ArchiveAsset` with `rights { status, statement }`,
  `authenticity`, `materialClass` (historical / contextual / stand-in / reconstruction).
- `data/archive/repository.ts` — `ArchiveRepository` (Mock: lazy local JSON; Http: `VITE_ARCHIVE_API_URL`).

## 8. Content pipeline (scripts)

| Script | Purpose |
| --- | --- |
| `npm run build:geo` | Natural Earth → `src/data/geo/subcontinent.json` (map, wings, schematic rivers/routes, places; no line through Kashmir). |
| `node scripts/fetch-archive.mjs` | Fetches web-size originals for clear / likely-clear preview-only records from Wikimedia Commons (never VERIFY items). Resumable; log in `docs/archive/FETCH_LOG.json`. |
| `npm run import:archive` | Manifest → `assets.json` (all records, rights verbatim) + `filmIndex.json`; builds 1600 / 1024 / 400 px JPEGs into `public/assets/archive`. |

## 9. Performance

One loop; no per-frame React state; instanced cut-outs; one ink geometry per plate; scenes and
images loaded only near the camera and disposed after; quality tiers (`engine/quality`) with
PerformanceMonitor step-down; textures sized by tier. Draw calls: ~5 (map), ~100 (station),
3–9 (chronicle).

## 10. Verification

- `npm test` — engine unit tests.
- `npm run verify` — scroll-through screenshots + console/WebGL/network errors (production build on :4173).
- `node e2e/journey.mjs` — judge's-eye test: entry → Judges' Cut → interrupt → flick → timeline travel → archive.
- `node e2e/probe.mjs @E08 '#archive=E05'` — screenshot specific chapters or layers.
