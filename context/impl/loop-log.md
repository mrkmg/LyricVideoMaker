---
created: "2026-04-11T00:00:00Z"
last_edited: "2026-04-11T00:00:00Z"
---
# Build Loop Log

Build site: context/plans/build-site.md

### Wave 1 — 2026-04-11 — Tier 0 complete
- T-001: transform options type — DONE. Files: shared/transform.ts, tests/shared-transform.test.ts. Build P, Tests P. Commit ca8549c.
- T-004: timing options type — DONE. Files: shared/timing.ts, tests/shared-timing.test.ts. Build P, Tests P. Commit ca8549c.
- T-007: video field variant — DONE. File: types/scene-options.ts. Commit a05c0c6.
- T-009: video MIME detection — DONE. Files: assets/mime.ts, tests/mime.test.ts. Commit a05c0c6.
- T-013: desktop video picker kind — DONE. Files: electron-api.ts, ipc/dialog-handlers.ts. Commit a05c0c6.
- T-017: shape identity — DONE. Files: components/shape/{index.ts,component.tsx}, components/index.ts. Commit 8be7b50.
- T-025: static-text identity — DONE. Files: components/static-text/{index.ts,component.tsx}. Commit 8be7b50.
- T-033: static-text no asset fields — DONE. Test flattens options, asserts no image/video. Commit 8be7b50.
- T-034: image identity — DONE. Stub coexists with background-image. Commit 8be7b50.
- T-040: image uses existing preload — DONE. Test asserts image field type present, no new asset-pipeline code. Commit 8be7b50.
- T-042: readiness hook — DONE. Files: browser/readiness.ts, tests/readiness.test.ts. Commit 66377c3.
- T-049: video identity — DONE. Files: components/video/{index.ts,component.tsx}. Commit 8be7b50.
- Validation: tsc -b P, full vitest 111 pass + 1 skipped.
- Next: Tier 1 — T-002, T-003, T-005 (shared-helpers rest); T-008, T-010, T-014 (video-field-type); T-043, T-044, T-045 (frame-sync).

**Note on subagent dispatch:** Initial attempts to delegate via `ck:task-builder` subagents stalled — agents emitted fake `<tool_use>` JSON strings instead of invoking tools. Switched to inline execution since parent model (opus) matches EXECUTION_MODEL.

### Wave 2 — 2026-04-11 — Tier 1 complete
- T-002: transform category export — DONE (already satisfied by T-001). Verified via runtime helper tests.
- T-003: transform runtime helper — DONE. Files: shared/transform-runtime.ts, tests/shared-transform-runtime.test.ts (24 tests). Commit 14b4e10.
- T-005: timing category collapsed — DONE (satisfied by T-004 default expanded: false).
- T-008: shared file validation helper — DONE. File: core/src/scenes/option-validation.ts (validateFileField extracted), core/tests/video-field-validation.test.ts (6 tests). Commit 897972d.
- T-010: kind-aware asset cache — DONE. File: renderer/src/assets/cache-body.ts + tests/cache-body-kind.test.ts (5 tests). Commit 897972d.
- T-014: generalized file-pick callback — DONE. Files: desktop form-fields.tsx, component-details-editor.tsx, App.tsx. Commit 897972d.
- T-043: capture loop gated on readiness — DONE. File: renderer/src/browser/live-dom-session.ts awaits awaitFrameReadiness. Commit 871f003.
- T-044: live-DOM video seek handler — DONE. Detects state.__videoSync, seeks element, registers readiness task. Commit 871f003.
- T-045: bounded timeout + logging — DONE. 1000ms timeout, drained events logged via logger.warn, capture proceeds. 3 timeout tests. Commit 871f003.
- Validation: tsc -b P, full vitest 157 pass + 1 skipped.
- Next: Tier 2 — T-023 (timing runtime helper); T-011 (preload video); T-015 (editor video pill); T-046, T-047 (frame-sync verification/docs); then T-006 (barrel) unblocks after T-023.

### Wave 3 — 2026-04-11 — Tier 2 complete
- T-023, T-006: timing runtime + shared barrel. 18 tests. Commit (T-023/T-006).
- T-011: preload loop iterates category-nested fields, picks up image+video kinds, calls cache with kind. 3 tests.
- T-015: video pill in OptionField dispatch. 4 jsdom tests.
- T-046: frame-sync R5 interface verification — pinned SceneComponentDefinition / SceneRenderProps / SceneBrowserRuntimeDefinition keys. 3 tests.
- T-047: source comment near runtimeRegistry describes readiness mechanism + state shape + Phase-A boundary.

### Wave 4 — 2026-04-11 — Tier 3 complete
- T-018: Shape options contract — geometry + fill + stroke + effects + shared transform/timing. Schema order Geometry/Transform/Fill/Stroke/Effects/Timing collapsed.
- T-026: Static Text options contract — content/typography/color/box/effects + shared. Schema order matches kit.
- T-035: Image options contract — source/transform/fit/appearance/effects + filters. Schema order matches kit.
- T-012: asset route serves video bodies with content-type via existing route handler; tests cover mp4/webm/mov/mkv. Range support documented as deferred.
- T-048: frame-sync verification harness — drives fake video element through gate, no-video benchmark, stuck timeout proof.
- 21 contract tests + 4 asset-route tests + 3 harness tests.

### Wave 5 — 2026-04-11 — Tier 4 complete
- Shape rendering (T-019..T-024 incl T-023-SHAPE): buildShapeInitialState produces HTML for 6 shape types via inline styled divs (rectangle/circle/ellipse/line) and inline SVG polygons (triangle/polygon side count 3..12). Gradient fill, stroke, shadow/glow/blur as composed CSS filters. 19 tests.
- Static Text rendering (T-027..T-032): buildStaticTextInitialState produces text markup with case transform, gradient/solid color, border via 8-direction text-shadow stack, drop-shadow + glow via additional text-shadows, optional backdrop layer. Token substitution via curly-brace replace using songTitle/songArtist metadata. 12 tests.
- Image rendering (T-036..T-041): buildImageInitialState wraps positioned img with object-fit, filter chain, optional border, shadow/glow drop-shadow filter, optional multiply-blend tint overlay. Per-frame opacity = option opacity * timing helper. 14 tests.
- Generic "static-fx-layer" runtime added to live-dom.ts runtimeRegistry — sets innerHTML from initialState.html and updates layer.style.opacity per frame. Used by shape, static-text, image, and (later) video components.
- T-016: end-to-end video-field-type plumbing test using throwaway component declared inside a test file (never registered in builtInSceneComponents). 5 tests.

### Wave 6 — 2026-04-11 — Tier 5 + 6 + 7 + 8 complete (Video component)
- T-050: Video options contract — source (video field, required), muted (default true), playback mode + offset + speed, fit, appearance, effects, transform, timing.
- T-051/T-052: schema order Source/Playback/Transform/Fit/Appearance/Effects/Timing; muted defaults true; no default source path.
- T-053: prepare phase via probeVideoFile (ffprobe child_process). Returns durationMs/width/height/frameRate. Failures surfaced as readable validation errors via prepareVideoComponent. Tests use injected probe stub.
- T-054: buildVideoInitialState mounts <video muted preload="auto" playsinline> with object-fit, filters, tint overlay, corner radius, border, shadow/glow.
- T-055: sync-with-song + loop playback math from probed duration. Speed scaling. Loop wrap.
- T-056: play-once-clamp holds last frame; play-once-hide returns hidden=true after end.
- T-057: getFrameState returns __videoSync payload consumed by live-DOM handler (T-044) — capture waits for seek to settle. Opacity zero before start time and during play-once-hide completion.
- T-058: muted default + muted attribute on element ensure song is only audio source.
- T-059: 30-second simulated render across all four modes with boundary timestamp checks (start/middle/end+1 frame). Phase-B fallback documented in description, not implemented.
- 28 video unit tests + 14 smoke tests.
- Validation: tsc -b P, full vitest 305 pass + 1 skipped.

═══ ALL 59 TASKS COMPLETE ═══
