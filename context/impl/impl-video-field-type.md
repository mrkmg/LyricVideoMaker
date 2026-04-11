---
created: "2026-04-11T00:00:00Z"
last_edited: "2026-04-11T00:00:00Z"
---
# Implementation Tracking: video-field-type

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T-007 | DONE | Added `video` variant to SceneOptionField union in packages/core/src/types/scene-options.ts. Commit a05c0c6. |
| T-009 | DONE | Extended getMimeType with mp4/webm/mov/mkv; image behavior preserved. Commit a05c0c6. |
| T-013 | DONE | Added `video` to FilePickKind and getFileFilters (mp4/webm/mov/mkv). Commit a05c0c6. |
| T-008 | DONE | Added "video" branch to validateField; extracted validateFileField shared helper used by both image and video. Test added. Commit 897972d. |
| T-010 | DONE | createCachedAssetBody + loadCachedAssetBody now accept kind parameter. Video path reads bytes directly + content-type from MIME. Image path unchanged. Cache-key format stable. 5 tests. Commit 897972d. |
| T-011 | DONE | preloadSceneAssets flattens categories and iterates image+video field types, calls loadCachedAssetBody with kind. 3 tests. Commit 51b0ce3. |
| T-012 | DONE | asset-routes.ts serves asset.contentType (covers mp4/webm/mov/mkv). Range support deferred to Phase-B per kit AC2. 4 tests. |
| T-014 | DONE | OptionField and ComponentDetailsEditor now use onPickFile(fieldId, kind) unified callback. Image call sites pass "image" kind. No image-specific callback remains. Commit 897972d. |
| T-015 | DONE | OptionField "video" case renders pill with onClick=onPickFile("video"). 4 jsdom tests. Commit 51b0ce3. |
| T-016 | DONE | video-field-end-to-end.test.ts uses throwaway component declared inside the test file only (never registered in builtInSceneComponents). 5 tests. Commit f9a21bb. |
