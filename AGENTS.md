# AGENTS.md

## Purpose

This repository is a local desktop lyric-video renderer.

The current v1 scope is:

- Electron desktop shell
- React renderer-process UI
- Shared `core` package for subtitle parsing, scene contracts, option validation, and render-job creation
- `scene-registry` package for built-in scenes and reusable scene components
- `renderer` package that renders HTML/CSS scenes through headless Chromium and muxes them with source audio via `ffmpeg`

The app currently supports one built-in scene applied across the full song: `single-image-lyrics`.

## Start Here

If you are new to the repo, read these files first:

1. [package.json](./package.json)
2. [apps/desktop/electron/main.ts](./apps/desktop/electron/main.ts) — slim composition entry; collaborators live under `electron/services/` and `electron/ipc/`
3. [apps/desktop/electron/ipc/register-ipc-handlers.ts](./apps/desktop/electron/ipc/register-ipc-handlers.ts) — IPC surface, one file per feature under `electron/ipc/`
4. [apps/desktop/src/App.tsx](./apps/desktop/src/App.tsx) — slim composition; state lives in `src/state/*`, features in `src/features/*`
5. [packages/core/src/types/scene-component.ts](./packages/core/src/types/scene-component.ts) — scene contract types
6. [packages/core/src/scenes/option-validation.ts](./packages/core/src/scenes/option-validation.ts) — scene + option validation
7. [packages/core/src/scenes/render-job.ts](./packages/core/src/scenes/render-job.ts) — render-job builder
8. [packages/scene-registry/src/scenes/single-image-lyrics/index.ts](./packages/scene-registry/src/scenes/single-image-lyrics/index.ts) — built-in scene composition
9. [packages/scene-registry/src/components/equalizer/component.ts](./packages/scene-registry/src/components/equalizer/component.ts) — example folder-component assembly
10. [packages/renderer/src/index.ts](./packages/renderer/src/index.ts) — renderer public barrel
11. [packages/renderer/src/pipeline/render-lyric-video.ts](./packages/renderer/src/pipeline/render-lyric-video.ts) — main render orchestrator

Those files show the app boundary, the IPC contract, the UI composition, the shared scene contract, the built-in scene structure, and the render pipeline.

## Repo Layout

### `apps/desktop`

Electron + React desktop app, organized into a layered structure on both sides of the IPC boundary.

#### Electron main process (`apps/desktop/electron/`)

- `main.ts`: tsup entry, ~60 lines. Wires services together, registers IPC handlers, opens the main window.
- `preload.ts`: tsup entry. Exposes the safe renderer API on `window.lyricVideoApp`.
- `preview-worker-thread.ts`: tsup entry, ~40 lines. Worker thread bootstrap that delegates to `services/preview/worker-runtime.ts`.
- `app/`: app lifecycle helpers — `create-window.ts`, `app-paths.ts` (sidecar root resolution), `preview-profiler.ts`.
- `ipc/`: one file per feature, each exporting a `registerXxxHandlers(deps)` function called by `register-ipc-handlers.ts`. Files are `bootstrap-handlers`, `dialog-handlers`, `scene-handlers`, `render-handlers`, `subtitle-handlers`, `preview-handlers`. **All IPC channel strings live here** — never hardcoded in `main.ts`.
- `services/`: behavior decoupled from IPC plumbing. `render-history.ts`, `scene-catalog.ts`, `render-job-runner.ts`, `scene-library.ts` (user scene persistence), `subtitle-generator/` (Python sidecar runner), `preview/` (`worker-client.ts`, `worker-protocol.ts`, `render-queue.ts`, `worker-runtime.ts`).
- `shared/`: cross-cutting code linked into both the main process and the worker thread — `media-cache.ts` (shared subtitle/audio loader factories) and `clamp.ts`.

#### React renderer (`apps/desktop/src/`)

- `App.tsx`: slim composition. Calls hooks, computes memos, renders feature components into the workspace layout.
- `main.tsx`: Vite entry. Imports `./styles/index.css`.
- `electron-api.ts`: shared IPC type contracts. Source of truth for the `ElectronApi` interface and all IPC payload types — imported by both `electron/preload.ts` and renderer code.
- `state/`: every domain hook lives here — `use-bootstrap`, `use-composer`, `use-workspace-selection`, `use-render-job`, `use-subtitle-generation`, `use-layout-resize`. Domain types `composer-types.ts` and `workspace-types.ts` live here too.
- `features/`: one folder per feature card with the top-level component — `project-setup`, `workspace-nav`, `preview`, `scene-editor`, `component-editor`, `subtitle-generation`, `render-progress`.
- `components/ui/form-fields.tsx`: reusable form primitives (`InfoTip`, `FieldLabel`, `NumberField`, `SelectField`, `FileField`, `OptionField`, `OptionCategorySection`).
- `hooks/use-frame-preview.ts`: debounced preview-frame request hook with object-URL lifecycle.
- `ipc/`: thin renderer-side wrapper. `lyric-video-app.ts` is a dynamic-lookup proxy around `window.lyricVideoApp` (so tests can mock the global). `use-render-progress.ts` and `use-subtitle-progress.ts` are tiny `useEffect` wrappers around the subscription methods.
- `lib/`: pure non-React helpers — `composer-helpers`, `video-presets`, `path-utils`, `format`, `render-history`, `subtitle-request`, `clamp`.
- `styles/`: monolithic CSS split into 5 cascade-ordered files — `index.css` imports `tokens.css` → `base.css` → `layout.css` → `forms.css` → `components.css`. Preserve cascade order when adding rules.
- `vite.config.ts`: renderer-process bundling; `base: "./"` matters for `file://` startup.

### `packages/core`

Shared domain logic. Put logic here when it is needed by both Electron and renderer code. The package is layered into focused subdirectories; `src/index.ts` is a barrel that re-exports everything publicly.

- `src/constants.ts`: defaults such as video size, fps, scene-file version, and supported fonts
- `src/srt.ts`: subtitle parsing (single-purpose)
- `src/timeline/`: cue lookup and frame/time conversion helpers, plus the stateful runtime cursor
  - `cue-lookup.ts`, `frame-time.ts`, `runtime.ts`
- `src/types/`: domain types, split by concern
  - `lyric.ts`, `video.ts`, `scene-options.ts`, `scene-audio.ts`, `scene-component.ts`, `render.ts`
- `src/scenes/`: option validation, scene serialization, render-job creation
  - `option-validation.ts`, `serialization.ts`, `render-job.ts`

### `packages/scene-registry`

Built-in scenes and reusable scene components. `src/index.ts` is the public barrel.

- `src/index.ts`: exports built-in scenes/components and lookup helpers
- `src/shared/`: package-internal utilities shared across components — `color.ts` (`withAlpha`, `mixHex`, `parseHexColor`, `rgbToHex`) and `math.ts` (`clamp01`, `safeScale`). Components import via relative paths; not re-exported from the package barrel.
- `src/components/background-image.tsx`, `background-color.tsx`: small single-file components
- `src/components/lyrics-by-line/`: folder-component decomposed into single-purpose modules — `types.ts`, `options-schema.ts`, `caches.ts`, `measurement.ts`, `fade.ts`, `layout.ts`, `typography.ts`, `browser-state.ts`, `react/component.tsx`, `component.ts` (the assembly), `index.ts`
- `src/components/equalizer/`: folder-component decomposed into single-purpose modules — `types.ts`, `options-schema.ts`, `validation.ts`, `prepare.ts`, `layout.ts`, `color-plan.ts`, `bar-plan.ts`, `line-geometry.ts`, `shadow.ts`, `static-values.ts`, `browser-state.ts`, `react/{component,equalizer-bar,equalizer-line-graph}.tsx`, `component.ts`, `index.ts`
- `src/scenes/single-image-lyrics/index.ts`: the only built-in scene in v1

Scene-specific heavy work should happen in component `prepare(...)`, not inside per-frame rendering.

### `packages/renderer`

Headless render coordinator. `src/index.ts` is a thin public barrel; behavior lives in focused subdirectories.

- `src/index.ts`: public barrel for `renderLyricVideo`, `createFramePreviewSession`, `probeAudioDurationMs`, preview cache factories, plus the test-exported helpers
- `src/constants.ts`: tunables and resolved ffmpeg/ffprobe paths
- `src/types.ts`: shared internal types (`RenderLogger`, `FrameMuxer`, profiling types, etc.)
- `src/abort.ts`: `throwIfAborted`, `createAbortError`, `isAbortError`
- `src/logging.ts`: `createRenderLogger`, `createLogEntry`
- `src/profiling.ts`: render and preview profilers, measure helpers, `traceRenderStep`
- `src/ffmpeg/`: subprocess + mux pipeline — `run-command.ts` (single source of truth for `runCommand`/`runBinaryCommand`), `probe.ts`, `frame-muxer.ts`, `frame-writer.ts`, `bounded-output-buffer.ts`, `mux-diagnostics.ts`
- `src/browser/`: Playwright orchestration — `chromium-loader.ts`, `render-page.ts`, `asset-routes.ts`, `capture.ts`, `diagnostics.ts`, `dispose.ts`, `live-dom-session.ts`
- `src/react-ssr/`: server-side React markup helpers — `composite-markup.ts`, `lyric-runtime-bridge.ts`
- `src/scene-prep/`: component prepare orchestration — `prepare-components.ts`, `cache-keys.ts`
- `src/assets/`: asset preload + serve — `preload.ts`, `cache-body.ts`, `mime.ts`, `preview-cache.ts`
- `src/pipeline/`: top-level orchestration — `render-lyric-video.ts`, `preview-session.ts`, `worker-frames.ts`, `parallelism.ts`, `frame-queue.ts`, `ordered-frame-queue.ts`, `progress.ts`, `static-detection.ts`
- `src/audio-analysis.ts`: audio spectrum extraction for scenes that need it (uses the shared `ffmpeg/run-command.ts`)
- `src/live-dom.ts`: live DOM scene mounting and update helpers used by the Chromium render path. **Known coupling: this file hardcodes a `runtimeRegistry` for the four built-in scene-registry component IDs (`background-image`, `background-color`, `lyrics-by-line`, `equalizer`).** Adding a new built-in scene component requires editing this file as well as the scene-registry component itself. The decoupling is intentionally deferred — fixing it requires a contract change to `SceneBrowserRuntimeDefinition` and a design pass for serialized browser-side runtime scripts.
- `tests/*`: render smoke, benchmark, preview-session, parallel-rendering, and audio-analysis coverage

## Data And Render Flow

The happy path is:

1. Renderer UI collects `mp3`, `srt`, scene selection, scene options, and output path.
2. Electron main parses the SRT, probes audio duration, validates options, and creates a `RenderJob`.
3. Electron main calls `renderLyricVideo(...)` from `packages/renderer`.
4. The renderer package runs optional scene `prepare(...)`.
5. Each frame is rendered by server-rendering the scene React component to static HTML.
6. Playwright Chromium captures each frame.
7. `ffmpeg` muxes the frame sequence with source audio into H.264/AAC MP4.
8. Electron main emits progress updates back to the React UI.

Preview rendering uses the same job/build logic, but keeps a cached Chromium preview session and renders a single frame on demand.

## Commands

Run these from the repo root:

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm test`
- `npm run benchmark:renderer`
- `npm run publish`

The end-to-end smoke test is intentionally gated because it requires Chromium and `ffmpeg`:

- PowerShell: `$env:RUN_RENDER_SMOKE='1'; npx vitest run packages/renderer/tests/render-smoke.test.ts`

## What To Edit

Use this rule of thumb:

- Change `apps/desktop` for UI, dialogs, IPC wiring, scene library persistence, and render-history behavior.
- Change `packages/core` for subtitle parsing, normalized models, scene schemas, validation, and shared helpers.
- Change `packages/scene-registry` for built-in scene behavior, component visuals, and default scene composition.
- Change `packages/renderer` for frame rendering, browser capture, temp-file handling, audio analysis, and `ffmpeg` orchestration.

If a change affects multiple layers, keep business rules in `core` and keep transport/UI details in `desktop`.

### Within `apps/desktop`

The desktop app is layered. Match new code to the layer that already owns its concern:

- **New IPC channel:** add the type to `src/electron-api.ts`, add the bridge call in `electron/preload.ts`, add the handler in the appropriate `electron/ipc/<feature>-handlers.ts` (or create a new one and register it in `register-ipc-handlers.ts`), and add a passthrough in `src/ipc/lyric-video-app.ts`. IPC channel strings should appear in exactly one handler file plus `preload.ts`.
- **New main-process behavior:** put it in `electron/services/`, not in `main.ts` or directly in an IPC handler. Handlers should be thin — they receive collaborators via the `IpcDeps` argument and call into services.
- **New shared logic between main process and preview worker:** put it under `electron/shared/` (e.g. another loader factory alongside `media-cache.ts`).
- **New renderer state slice:** add a custom hook under `src/state/`. Don't add `useState`/`useEffect` directly to `App.tsx`.
- **New feature UI:** add a folder under `src/features/`. Don't add new files to `src/components/` — that directory is reserved for `ui/` primitives.
- **New reusable form field:** extend `src/components/ui/form-fields.tsx`.
- **New renderer helper:** add a focused file under `src/lib/`. Don't reintroduce a single grab-bag utility module.
- **New styles:** add to the appropriate `src/styles/<group>.css`. Preserve the cascade order set by `src/styles/index.css`.
- **New renderer-side IPC call:** import `lyricVideoApp` from `src/ipc/lyric-video-app.ts`. Don't reach into `window.lyricVideoApp` directly — the wrapper exists so tests can mock at the module level.

### Within `packages/core`

- **New shared type:** put it in the `src/types/` file that owns its concern (`lyric.ts`, `video.ts`, `scene-options.ts`, `scene-audio.ts`, `scene-component.ts`, or `render.ts`). Don't reintroduce a single grab-bag `types.ts`.
- **New scene logic:** option validation goes in `src/scenes/option-validation.ts`, file serialization in `src/scenes/serialization.ts`, render-job creation in `src/scenes/render-job.ts`. Don't merge them back into a single `scenes.ts`.
- **New timeline helper:** add to `src/timeline/cue-lookup.ts`, `frame-time.ts`, or `runtime.ts` based on responsibility.
- The barrels (`src/index.ts`, `src/types/index.ts`, `src/scenes/index.ts`, `src/timeline/index.ts`) re-export everything; new modules need a line in their parent barrel to be visible publicly.

### Within `packages/scene-registry`

- **New built-in scene component:** create a folder under `src/components/<name>/` mirroring `equalizer/` or `lyrics-by-line/` — split into `types.ts`, `options-schema.ts`, `browser-state.ts`, `react/component.tsx`, `component.ts` (the assembly), `index.ts`. Register it in `src/components/index.ts`. **Also add a matching entry to the `runtimeRegistry` in `packages/renderer/src/live-dom.ts`** — this is a known coupling.
- **Shared color/math helpers:** put them in `src/shared/color.ts` or `src/shared/math.ts`. Don't duplicate `withAlpha`, `clamp01`, etc. in components.
- **New built-in scene:** copy the structure of `src/scenes/single-image-lyrics/index.ts` and register the result in `src/index.ts`'s `builtInScenes`.

### Within `packages/renderer`

- **New tunable / environment variable:** add it to `src/constants.ts`. Don't define `process.env` lookups inline in feature files.
- **New ffmpeg invocation:** put it in `src/ffmpeg/`. Reuse `runCommand`/`runBinaryCommand` from `src/ffmpeg/run-command.ts` — there is exactly one copy in the package.
- **New Playwright orchestration:** put it in `src/browser/`. Don't reach into Playwright APIs from `src/pipeline/`.
- **New render orchestration step:** put it in `src/pipeline/`. Keep `pipeline/render-lyric-video.ts` and `pipeline/preview-session.ts` thin — extract reusable steps into sibling files.
- **New frame state helper:** put it in `src/scene-prep/`, `src/react-ssr/`, or `src/assets/` depending on the concern.
- **Profiling / measurement:** use the helpers in `src/profiling.ts`.
- **Subprocess output capture:** use `createBoundedOutputBuffer` from `src/ffmpeg/bounded-output-buffer.ts`.
- **Do not modify `src/live-dom.ts` lightly.** It runs inside Chromium and is hard to test. When adding a new built-in scene component, only add the matching `runtimeRegistry` entry — do not refactor surrounding code.

## Extension Points

- New built-in scene: copy the structure of `single-image-lyrics`, register it in `packages/scene-registry/src/index.ts`, and add it to the scene list used by Electron bootstrap data.
- New scene component: add a folder under `packages/scene-registry/src/components/<name>/`, export it from `src/components/index.ts`, **and add a matching `runtimeRegistry` entry to `packages/renderer/src/live-dom.ts`** so it can run in the live DOM renderer.
- New option type: add it in `packages/core/src/types/scene-options.ts`, validate it in `packages/core/src/scenes/option-validation.ts`, and surface it through the schema-driven scene editor UI.
- Render behavior changes: keep the render-job contract stable unless the UI and tests are updated together.

## Things To Avoid

- Do not edit `dist/` or `dist-electron/` directly. They are build outputs.
- Do not edit `node_modules/`.
- Do not move scene-specific form logic into React UI components. The UI is intentionally schema-driven from scene `options`.
- Do not put expensive async work in a scene component render path. Use `prepare`.
- Do not change `apps/desktop/vite.config.ts` away from relative asset loading unless packaged `file://` startup is reverified.
- Do not switch Electron preload back to ESM without reworking how Electron loads it. The current preload is built as CommonJS on purpose.

## Known Constraints

- v1 is a single-scene, full-song renderer. There is no timeline editor.
- Scene modules are local and built-in only for now, but the contract is meant to support future external modules.
- HTML/CSS is the primary scene runtime. Canvas can exist inside a scene later, but should not replace the scene contract.
- The default video target is `1920x1080` at `30fps`.
- Font selection is currently limited to the supported list in `packages/core/src/constants.ts`.

## Testing Expectations

For most changes, run:

1. `npm run typecheck`
2. `npm test`
3. `npm run build`

Also run the gated smoke test when you change:

- `packages/renderer/src/index.ts`
- scene rendering behavior
- temp-file handling
- Playwright or `ffmpeg` invocation
- render-job timing or duration logic

## Agent Notes

- Prefer reading source files under `apps/desktop/src`, `apps/desktop/electron`, and `packages/*/src` before touching anything.
- If you need to debug a blank Electron window, check preload format, asset paths in built `index.html`, and whether the app is loading from `file://` or a dev server.
- If you need to debug render failures, inspect `ffprobe`, `ffmpeg`, and Playwright Chromium availability first.
- If you need to add a new scene or component, reuse the existing scene registry structure rather than inventing a separate registration path.
