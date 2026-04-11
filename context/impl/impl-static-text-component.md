---
created: "2026-04-11T00:00:00Z"
last_edited: "2026-04-11T00:00:00Z"
---
# Implementation Tracking: static-text-component

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T-025 | DONE | Minimal stub in packages/scene-registry/src/components/static-text/. Registered in builtInSceneComponents. Commit 8be7b50. |
| T-033 | DONE | Test asserts flattened options contain no image/video fields (empty options). Commit 8be7b50. |
| T-026 | DONE | options.ts: StaticTextComponentOptions, DEFAULT_STATIC_TEXT_OPTIONS, staticTextOptionsSchema. |
| T-027 | DONE | Schema order Content/Typography/Color/Transform/Box/Effects/Timing. |
| T-028 | DONE | Default text "Static Text" + 72px Montserrat 600 white. |
| T-029 | DONE | applyTokenSubstitution: replaces {key} with metadata when enableTokens, leaves literal otherwise. |
| T-030 | DONE | Solid + gradient color via background-clip:text. Case transform: as-typed/upper/lower/title. |
| T-031 | DONE | Border via 8-direction text-shadow stack; drop-shadow + glow as additional text-shadows; backdrop as positioned layer with opacity + radius. |
| T-032 | DONE | Tokens resolved once at mount (stable across frames); browserRuntime.getFrameState returns opacity from timing helper. |
