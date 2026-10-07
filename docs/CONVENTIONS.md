# CONVENTIONS FOR IMPLEMENTATION

Read `SPEC_PHASE01.md` (story, authoritative) and `ARCHITECTURE.md` (structure) first. This file is the practical rulebook.

## Progress

- There is ONE progress value: `frame.progress` from `@/engine/store/cinematicStore`. Read it inside `useFrame` (scenes) or `useTick` (DOM). Never copy it into React state.
- Ranges come from the timeline: `cinematic.get().timeline` (`beatAt`, `local`, `phases`, `chapterRange`, `yearAt`). Opening curves: `@/scenes/openingCurves`. Helpers: `seg`, `bell`, `remap`, `ease`, `damp` in `@/engine/progress/ranges`. Transition curves: `@/engine/transitions`.
- The year changes only inside transition beats (event-locked chronology). Never animate the year from anything but `timeline.yearAt` (or a navigation travel).
- The dev server polls for file changes (`vite.config.ts`): native watch events were missed on this Windows path.
- Everything must be a pure function of progress so reverse scrolling works. No one-shot timers, no "has played" flags for visuals.
- Time-based ambience (dust drift, sway) uses `frame.time`, and must be disabled when `quality.idleMotion` is false.

## Coordinate frame

- See `@/scenes/world/layout.ts`. Ground is y = 0. +X is the direction of travel along the track. North on the map is −Z. The platform is on +Z; the window seat looks toward −Z.
- The paper plane is the ground for the entire slice. The camera looks nearly straight down at it in Scenes 01–03 and descends to eye level in Scene 04.
- Map geometry comes from `@/data/geo/subcontinent.json` (world units already; `x` east, `z` south).

## Colour

- `three.ColorManagement` is enabled (default). `new Color('#hex')` is converted to linear and output as sRGB, so hex values from the palette display faithfully in standard materials. Tone mapping is OFF (`flat` on Canvas) so the palette is not altered.
- In custom `ShaderMaterial`s we compute in display (sRGB) space directly and do NOT include `colorspace_fragment`. Pass palette colours as raw sRGB vec3 using `srgbVec3(hex)` from `@/engine/assets/color`. Fog applied manually inside custom shaders must use the same raw sRGB values.
- Only the nine palette colours (plus their mixes) exist. No neon, purple, red, pure black, glassmorphism.

## Performance

- No per-frame React state. UI subscribes to coarse store values (`chapterId`, `year`, `archiveOpen`…).
- Instance anything repeated (crowd, luggage, columns, trees, poles). Keep draw calls in the low hundreds at most.
- Textures are generated once in `useMemo`/`useEffect`, sized from `quality` (`cinematic.get().quality`), and disposed in cleanup. Use `generateMipmaps` and anisotropy where appropriate.
- Use one directional light (+ ambient/hemisphere). Point lights are capped by `quality.maxPointLights`. Shadows only if `quality.shadows`.
- Particle counts come from `quality`. Never hard-code counts.
- Avoid `new` inside `useFrame`. Reuse vectors/colors.

## Scenes

- Each scene module exports one React component and owns only its files. Shared state goes through the store or layout constants, not through props drilled from App.
- Scene components mount/unmount under `SceneManager`; they must dispose GPU resources on unmount and tolerate mounting at any progress value (e.g. page reload at 0.8).
- The DOM UI (year, captions) is positioned by CSS, never by projecting 3D points, except where explicitly designed.

## Data

- The engine never imports `assets.json` directly: use `useArchiveRepository()` (`@/data/archive/repository`). Captions come from `useStory()` (`@/data/story/provider`).
- Never fabricate historical photographs. Items without `localPath` render as typographic document frames.

## Verification hooks

- `window.__CINEMA_READY__ = true` must be set once the first meaningful frame can be drawn (fonts loaded + paper textures generated). `Loader` sets it.
- `window.__CINEMA__` exposes `frame`, `store`, `scrollToProgress`, `renderer`, `stats()` (set in `Stage`).
- `?quality=low|medium|high`, `?debug`, `?restart` are supported URL flags.

## Style

- TypeScript strict; no `any` unless interfacing with untyped JSON (cast once at the boundary).
- Files: PascalCase for components, camelCase for modules. Co-locate CSS as `Component.css` and import it from the component.
- Comments explain intent and the narrative purpose of a number, not what the code does.
