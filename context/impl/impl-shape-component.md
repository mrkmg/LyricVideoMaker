---
created: "2026-04-11T00:00:00Z"
last_edited: "2026-04-11T00:00:00Z"
---
# Implementation Tracking: shape-component

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T-017 | DONE | Minimal stub in packages/scene-registry/src/components/shape/. Registered in builtInSceneComponents. Commit 8be7b50. |
| T-018 | DONE | options.ts: ShapeComponentOptions, DEFAULT_SHAPE_OPTIONS, shapeOptionsSchema. |
| T-019 | DONE | Schema order Geometry/Transform/Fill/Stroke/Effects/Timing; Timing collapsed via timingCategory.defaultExpanded=false. Verified via tests. |
| T-020 | DONE | Default rectangle, fillEnabled=true, fillMode="solid", visible. |
| T-021 | DONE | buildShapeInitialState renders box-style shapes (rectangle/circle/ellipse/line) with gradient + stroke as CSS. |
| T-022 | DONE | Polygon + triangle as inline SVG with computed points; shadow/glow/blur compose via filter chain. |
| T-023-SHAPE | DONE | browserRuntime.getFrameState returns opacity from computeTimingOpacity; static-fx-layer runtime applies it; markup stable. |
| T-024 | DONE | Tests assert no image/video fields in flattened options. |
