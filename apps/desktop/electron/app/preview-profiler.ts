import { app } from "electron";

/**
 * The preview profiler logs frame-render timings to the main process console.
 * It's gated behind an environment variable AND only enabled when running
 * unpackaged so we never ship verbose logging to end users.
 */
export const previewProfilerEnabled =
  !app.isPackaged && process.env.LYRIC_VIDEO_PREVIEW_PROFILE === "1";
