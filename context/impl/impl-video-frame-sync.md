---
created: "2026-04-11T00:00:00Z"
last_edited: "2026-04-11T00:00:00Z"
---
# Implementation Tracking: video-frame-sync

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T-042 | DONE | packages/renderer/src/browser/readiness.ts — createFrameReadinessHook, installFrameReadinessHook, FRAME_READINESS_INSTALL_SCRIPT injection script. 9 tests pass. Commit 66377c3. |
| T-043 | DONE | live-dom-session.ts awaits awaitFrameReadiness(page) after updateLiveDomScene, before captureFrameBuffer. Both preview and full-render paths share this session. Commit 871f003. |
| T-044 | DONE | __renderLiveDomFrame detects state.__videoSync, finds <video> in mounted layer, calls __syncVideoElement which compares currentTime with epsilon (1/240s), seeks if different, registers readiness Promise that resolves on "seeked"/"error". Commit 871f003. |
| T-045 | DONE | syncVideoElement wraps the seek in Promise with setTimeout(1000ms) → records event to readinessTimeoutEvents, finishes anyway. Node drains events and logger.warn() each. Test covers stuck-seek, drain, non-abort. Commit 871f003. |
| T-046 | DONE | frame-sync-interface.test.ts pins SceneComponentDefinition/SceneRenderProps/SceneBrowserRuntimeDefinition keys. |
| T-047 | DONE | Block comment near runtimeRegistry in live-dom.ts documents readiness mechanism + state shape. |
| T-048 | DONE | frame-sync-harness.test.ts drives fake video element through gate, no-video benchmark, stuck-timeout proof. |
