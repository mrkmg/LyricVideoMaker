import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { workerData } from "node:worker_threads";
import {
  createPluginAssetUri,
  createRenderJob,
  msToFrame,
  type LyricCue
} from "@lyric-video-maker/core";
import {
  createFramePreviewSession,
  createPreviewComputationCache,
  type FramePreviewSession
} from "@lyric-video-maker/renderer";
import { builtInSceneComponents } from "@lyric-video-maker/scene-registry";
import type { RenderPreviewRequest, RenderPreviewResponse } from "../../../src/electron-api";
import { createPluginAssetResolver } from "../plugin-asset-resolver";
import { createLatestOnlyPreviewRenderQueue } from "./render-queue";
import { clamp } from "../../shared/clamp";
import { createAudioDurationLoader, createSubtitleCueLoader } from "../../shared/media-cache";
import { loadInstalledPlugins } from "../plugin-library";

interface PreviewSessionState {
  key: string;
  session: FramePreviewSession;
  job: ReturnType<typeof createRenderJob>;
  cues: LyricCue[];
  durationMs: number;
}

const PREVIEW_MAX_WIDTH = 960;
const PREVIEW_MAX_HEIGHT = 540;

const previewProfilerEnabled = process.env.LYRIC_VIDEO_PREVIEW_PROFILE === "1";
let fontCacheDir =
  workerData && typeof workerData.fontCacheDir === "string" ? workerData.fontCacheDir : undefined;
let userDataPath =
  workerData && typeof workerData.userDataPath === "string" ? workerData.userDataPath : undefined;
const getSubtitleCues = createSubtitleCueLoader();
const getAudioDuration = createAudioDurationLoader();
const previewComputationCache = createPreviewComputationCache();

let previewSessionState: PreviewSessionState | null = null;

export async function configurePreviewFontCacheDir(nextFontCacheDir: string | undefined) {
  if (!nextFontCacheDir || nextFontCacheDir === fontCacheDir) {
    return;
  }

  fontCacheDir = nextFontCacheDir;
  await disposePreviewSession();
}

export async function configurePreviewUserDataPath(nextUserDataPath: string | undefined) {
  if (!nextUserDataPath || nextUserDataPath === userDataPath) {
    return;
  }

  userDataPath = nextUserDataPath;
  await disposePreviewSession();
}

export const previewRenderQueue = createLatestOnlyPreviewRenderQueue<
  RenderPreviewRequest,
  FramePreviewSession,
  RenderPreviewResponse
>({
  getSessionKey: (request) => getPreviewSessionKey(request),
  createSession: async (request) => {
    const sessionInfo = await getOrCreatePreviewSession(request);
    return {
      key: sessionInfo.key,
      session: sessionInfo.session
    };
  },
  disposeSession: async (sessionState) => {
    if (previewSessionState?.key === sessionState.key) {
      await disposePreviewSession();
      return;
    }

    await sessionState.session.dispose();
  },
  render: async (sessionState, request) => {
    const timingStartMs = performance.now();
    const activeSessionState =
      previewSessionState?.key === sessionState.key
        ? previewSessionState
        : await getOrCreatePreviewSession(request);
    const requestedFrame = Math.max(
      0,
      Math.min(
        activeSessionState.job.video.durationInFrames - 1,
        msToFrame(
          clamp(request.timeMs, 0, activeSessionState.durationMs),
          activeSessionState.job.video.fps
        )
      )
    );

    const preview = await activeSessionState.session.renderFrame({ frame: requestedFrame });
    const cueSummary = getPreviewCueSummary(activeSessionState.cues, preview.timeMs);
    const imageBytes = new Uint8Array(preview.png);
    const response = {
      imageBytes,
      imageMimeType: "image/png",
      frame: preview.frame,
      timeMs: preview.timeMs,
      durationMs: activeSessionState.durationMs,
      currentCue: cueSummary.currentCue,
      previousCue: cueSummary.previousCue,
      nextCue: cueSummary.nextCue
    } satisfies RenderPreviewResponse;

    if (previewProfilerEnabled) {
      console.info(
        `[preview-profile:ipc] ${JSON.stringify({
          reusedSession: activeSessionState.key === sessionState.key,
          requestedFrame,
          payloadBytes: imageBytes.byteLength,
          totalResponseMs: roundPreviewMs(performance.now() - timingStartMs)
        })}`
      );
    }

    return {
      response,
      sessionKey: activeSessionState.key,
      reusedSession: activeSessionState.key === sessionState.key
    };
  }
});

async function getOrCreatePreviewSession(request: RenderPreviewRequest) {
  const timingStartMs = performance.now();
    const cues = await getSubtitleCues(request.subtitlePath);
    const durationMs = await getAudioDuration(request.audioPath);
    const loadedPlugins = userDataPath
      ? await loadInstalledPlugins(userDataPath)
      : [];
    const pluginComponents = loadedPlugins.flatMap((plugin) => plugin.components);
    const pluginBundleSources = loadedPlugins.map((plugin) => plugin.bundleSource);
    const pluginRepoDirs = new Map(
      loadedPlugins.map((plugin) => [plugin.summary.id, plugin.summary.repoDir])
    );
    pluginRepoDirs.set(
      "scene-registry",
      join(dirname(require.resolve("@lyric-video-maker/scene-registry")), "..")
    );
    const resolver = createPluginAssetResolver(() => pluginRepoDirs);
    const componentDefinitions = [...builtInSceneComponents, ...pluginComponents];
    const job = createRenderJob({
    audioPath: request.audioPath,
    subtitlePath: request.subtitlePath,
    outputPath: join(tmpdir(), "lyric-video-preview.mp4"),
    scene: request.scene,
      componentDefinitions,
    cues,
    durationMs,
    video: getPreviewVideoSettings(request),
    validationContext: {
      isFileAccessible: existsSync,
      isPluginAssetAccessible: (pluginId, relativePath) =>
        resolver.exists(createPluginAssetUri(pluginId, relativePath))
    }
  });
  const key = getPreviewSessionKey(request, job.video.width, job.video.height);
  const reusedExistingSession = Boolean(previewSessionState && previewSessionState.key === key);

  if (!reusedExistingSession) {
    await disposePreviewSession();
    previewSessionState = {
      key,
      session: await createFramePreviewSession({
        job,
        componentDefinitions,
        pluginBundleSources,
        previewCache: previewComputationCache,
        fontCacheDir,
        resolvePluginAsset: (uri) => resolver.resolve(uri)
      }),
      job,
      cues,
      durationMs
    };
  }

  if (previewProfilerEnabled) {
    console.info(
      `[preview-profile:session] ${JSON.stringify({
        reusedExistingSession,
        key,
        width: job.video.width,
        height: job.video.height,
        getOrCreatePreviewSessionMs: roundPreviewMs(performance.now() - timingStartMs)
      })}`
    );
  }

  if (!previewSessionState) {
    throw new Error("Preview session was not created.");
  }

  return previewSessionState;
}

async function disposePreviewSession() {
  const activeSession = previewSessionState;
  previewSessionState = null;
  await activeSession?.session.dispose();
}

function getPreviewCueSummary(cues: LyricCue[], timeMs: number) {
  let currentCue: LyricCue | null = null;
  let previousCue: LyricCue | null = null;
  let nextCue: LyricCue | null = null;

  for (const cue of cues) {
    if (timeMs >= cue.startMs && timeMs < cue.endMs) {
      currentCue = cue;
      continue;
    }

    if (cue.endMs <= timeMs) {
      previousCue = cue;
      continue;
    }

    if (cue.startMs > timeMs) {
      nextCue = cue;
      break;
    }
  }

  if (currentCue) {
    const currentIndex = cues.findIndex((cue) => cue.index === currentCue?.index);
    previousCue = currentIndex > 0 ? cues[currentIndex - 1] ?? null : null;
    nextCue = currentIndex >= 0 ? cues[currentIndex + 1] ?? null : nextCue;
  }

  return {
    currentCue,
    previousCue,
    nextCue
  };
}

function getPreviewSessionKey(
  request: RenderPreviewRequest,
  width = getPreviewSize(request.video?.width, request.video?.height).width,
  height = getPreviewSize(request.video?.width, request.video?.height).height
) {
  return JSON.stringify({
    audioPath: request.audioPath,
    subtitlePath: request.subtitlePath,
    scene: request.scene,
    video: {
      width,
      height,
      fps: request.video?.fps
    }
  });
}

function getPreviewVideoSettings(request: RenderPreviewRequest) {
  const previewSize = getPreviewSize(request.video?.width, request.video?.height);
  return {
    ...request.video,
    width: previewSize.width,
    height: previewSize.height
  };
}

function getPreviewSize(width = PREVIEW_MAX_WIDTH * 2, height = PREVIEW_MAX_HEIGHT * 2) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = Math.min(1, PREVIEW_MAX_WIDTH / safeWidth, PREVIEW_MAX_HEIGHT / safeHeight);
  return {
    width: Math.max(2, Math.round((safeWidth * scale) / 2) * 2),
    height: Math.max(2, Math.round((safeHeight * scale) / 2) * 2)
  };
}

function roundPreviewMs(value: number) {
  return Number(value.toFixed(2));
}
