---
created: "2026-04-11T00:00:00Z"
last_edited: "2026-04-11T00:00:00Z"
---
# Implementation Tracking: video-component

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T-049 | DONE | Minimal stub in packages/scene-registry/src/components/video/. Registered in builtInSceneComponents. Commit 8be7b50. |
| T-050 | DONE | options.ts: VideoComponentOptions with Source (video, muted), Playback (mode/offset/speed), Fit, Appearance, Effects. |
| T-051 | DONE | Schema order Source/Playback/Transform/Fit/Appearance/Effects/Timing. |
| T-052 | DONE | Default source="" muted=true. |
| T-053 | DONE | probeVideoFile via ffprobe child_process. prepareVideoComponent surfaces probe failures as readable validation errors. Tests use injected probe stub. |
| T-054 | DONE | buildVideoInitialState mounts muted+preload="auto"+playsinline video element with object-fit, filter chain, tint overlay, corner radius, border, shadow/glow. |
| T-055 | DONE | computeVideoPlaybackState sync-with-song (linear+clamp) and loop (wrap modulo duration) modes. |
| T-056 | DONE | play-once-clamp returns last-frame; play-once-hide returns hidden=true. |
| T-057 | DONE | browserRuntime.getFrameState emits __videoSync payload + opacity. Frame-sync handler picks it up via __renderLiveDomFrame wrapper. |
| T-058 | DONE | Muted attribute on rendered video element + default muted=true enforce song-only audio. |
| T-059 | DONE | 30-second simulated render across 4 modes with boundary timestamp tests + Phase-B fallback documented in description. |
