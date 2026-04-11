---
created: "2026-04-11T00:00:00Z"
last_edited: "2026-04-11T00:00:00Z"
---
# Implementation Tracking: image-component

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T-034 | DONE | Minimal stub with TODO image field so T-040 test passes. No collision with background-image. Commit 8be7b50. |
| T-040 | DONE | Test verifies flattened options contain an image-type field that the existing preload loop iterates. No new asset-pipeline code added. Commit 8be7b50. |
| T-035 | DONE | options.ts: ImageComponentOptions, DEFAULT_IMAGE_OPTIONS, imageOptionsSchema. Source field required. |
| T-036 | DONE | Schema order Source/Transform/Fit/Appearance/Effects/Timing. |
| T-037 | DONE | Default source="" (renders nothing). |
| T-038 | DONE | Fit modes (contain/cover/fill/none), filter chain (grayscale/blur/brightness/contrast/saturation), border-radius + overflow:hidden. |
| T-039 | DONE | Border via container border, drop-shadow + glow via filter chain, tint as multiply-blend overlay. |
| T-041 | DONE | Per-frame opacity = option opacity / 100 * computeTimingOpacity; static markup. |
