import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { durationMsToFrameCount, frameToMs, msToFrame } from "@lyric-video-maker/core";
import type { RenderPreviewResponse } from "../electron-api";
import type { ComposerState } from "../state/composer-types";
import { lyricVideoApp } from "../ipc/lyric-video-app";

const PREVIEW_DEBOUNCE_MS = 250;

export interface ResolvedFramePreview {
  imageUrl: string;
  frame: number;
  timeMs: number;
  durationMs: number;
  currentCue: RenderPreviewResponse["currentCue"];
  previousCue: RenderPreviewResponse["previousCue"];
  nextCue: RenderPreviewResponse["nextCue"];
}

export interface FramePreviewState {
  result: ResolvedFramePreview | null;
  error: string;
  isLoading: boolean;
  requestedTimeMs: number;
  imageSwapStartedAtMs: number | null;
}

const emptyPreviewState: FramePreviewState = {
  result: null,
  error: "",
  isLoading: false,
  requestedTimeMs: 0,
  imageSwapStartedAtMs: null
};

export function useFramePreview({
  composer,
  paused,
  profilerEnabled = false
}: {
  composer: ComposerState;
  paused: boolean;
  profilerEnabled?: boolean;
}) {
  const [preview, setPreview] = useState<FramePreviewState>(emptyPreviewState);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackActiveRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const inFlightRequestRef = useRef<RenderPreviewRequestPayload | null>(null);
  const queuedRequestRef = useRef<RenderPreviewRequestPayload | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const enabled = Boolean(composer.audioPath && composer.subtitlePath && composer.scene);
  const deferredComposer = useDeferredValue(composer);
  const deferredRequestedTimeMs = useDeferredValue(preview.requestedTimeMs);

  useEffect(() => {
    return () => {
      revokeImageUrl(imageUrlRef.current);
      void lyricVideoApp.disposePreview();
    };
  }, []);

  useEffect(() => {
    if (enabled && !paused) {
      return;
    }

    playbackActiveRef.current = false;
    setIsPlaying(false);
    requestGenerationRef.current += 1;
    inFlightRequestRef.current = null;
    queuedRequestRef.current = null;
    revokeImageUrl(imageUrlRef.current);
    imageUrlRef.current = null;
    setPreview((current) =>
      enabled
        ? {
            ...current,
            isLoading: false
          }
        : emptyPreviewState
    );
    void lyricVideoApp.disposePreview();
  }, [enabled, paused]);

  useEffect(() => {
    if (!enabled || paused) {
      return;
    }

    requestGenerationRef.current += 1;
    inFlightRequestRef.current = null;
    queuedRequestRef.current = null;
    void lyricVideoApp.disposePreview();
  }, [composer.audioPath, composer.scene, composer.subtitlePath, composer.video, enabled, paused]);

  useEffect(() => {
    const scene = deferredComposer.scene;

    if (!enabled || paused || !scene || playbackActiveRef.current) {
      return;
    }

    const generation = requestGenerationRef.current;
    const safeTimeMs =
      preview.result?.durationMs !== undefined
        ? Math.min(deferredRequestedTimeMs, preview.result.durationMs)
        : deferredRequestedTimeMs;
    const request = {
      audioPath: deferredComposer.audioPath,
      subtitlePath: deferredComposer.subtitlePath,
      scene,
      video: deferredComposer.video,
      timeMs: safeTimeMs,
      generation
    } satisfies RenderPreviewRequestPayload;

    const timeout = window.setTimeout(() => {
      queuePreviewRequest(request);
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    deferredComposer.audioPath,
    deferredComposer.scene,
    deferredComposer.subtitlePath,
    deferredComposer.video,
    deferredRequestedTimeMs,
    enabled,
    paused,
    preview.result?.durationMs
  ]);

  useEffect(() => {
    return () => {
      revokeImageUrl(imageUrlRef.current);
      imageUrlRef.current = null;
    };
  }, []);

  function updatePreviewTime(nextTimeMs: number) {
    playbackActiveRef.current = false;
    setIsPlaying(false);
    setPreview((current) => ({
      ...current,
      requestedTimeMs:
        current.result?.durationMs !== undefined
          ? clamp(nextTimeMs, 0, current.result.durationMs)
          : Math.max(0, nextTimeMs)
    }));
  }

  function startPlayback() {
    if (!enabled || paused || !composer.scene) {
      return;
    }

    const fps = composer.video.fps;
    const durationMs = preview.result?.durationMs;
    let startTimeMs = preview.requestedTimeMs;

    if (durationMs !== undefined) {
      const totalFrames = durationMsToFrameCount(durationMs, fps);
      const currentFrame = msToFrame(startTimeMs, fps);
      if (currentFrame >= totalFrames - 1) {
        startTimeMs = 0;
      }
    }

    playbackActiveRef.current = true;
    setIsPlaying(true);

    const generation = requestGenerationRef.current;
    const safeTimeMs =
      durationMs !== undefined ? Math.min(startTimeMs, durationMs) : startTimeMs;
    const request: RenderPreviewRequestPayload = {
      audioPath: composer.audioPath,
      subtitlePath: composer.subtitlePath,
      scene: composer.scene,
      video: composer.video,
      timeMs: safeTimeMs,
      generation
    };

    setPreview((current) => ({ ...current, requestedTimeMs: safeTimeMs }));
    queuePreviewRequest(request);
  }

  function stepForward() {
    playbackActiveRef.current = false;
    setIsPlaying(false);
    if (!preview.result) return;
    const fps = composer.video.fps;
    const totalFrames = durationMsToFrameCount(preview.result.durationMs, fps);
    const nextFrame = preview.result.frame + 1;
    if (nextFrame >= totalFrames) return;
    updatePreviewTime(frameToMs(nextFrame, fps));
  }

  function stepBackward() {
    playbackActiveRef.current = false;
    setIsPlaying(false);
    if (!preview.result) return;
    const prevFrame = preview.result.frame - 1;
    if (prevFrame < 0) return;
    updatePreviewTime(frameToMs(prevFrame, composer.video.fps));
  }

  return {
    enabled,
    preview,
    isPlaying,
    updatePreviewTime,
    togglePlayback: () => (playbackActiveRef.current ? (playbackActiveRef.current = false, setIsPlaying(false)) : startPlayback()),
    stepForward,
    stepBackward,
    noteImagePainted
  };

  function queuePreviewRequest(request: RenderPreviewRequestPayload) {
    if (inFlightRequestRef.current) {
      queuedRequestRef.current = request;
      startTransition(() => {
        setPreview((current) => ({ ...current, isLoading: true }));
      });
      return;
    }

    void dispatchPreviewRequest(request);
  }

  async function dispatchPreviewRequest(request: RenderPreviewRequestPayload) {
    inFlightRequestRef.current = request;
    startTransition(() => {
      setPreview((current) => ({ ...current, isLoading: true }));
    });

    const requestStartMs = performance.now();
    let renderedDurationMs: number | undefined;

    try {
      const result = await lyricVideoApp.renderPreviewFrame({
        audioPath: request.audioPath,
        subtitlePath: request.subtitlePath,
        scene: request.scene,
        video: request.video,
        timeMs: request.timeMs
      });

      if (requestGenerationRef.current !== request.generation) {
        return;
      }

      const imageUrl = URL.createObjectURL(
        new Blob(
          [result.imageBytes.slice().buffer as ArrayBuffer],
          { type: result.imageMimeType }
        )
      );
      const previousImageUrl = imageUrlRef.current;
      imageUrlRef.current = imageUrl;

      if (profilerEnabled) {
        console.info(
          `[preview-profile:renderer] ${JSON.stringify({
            requestTimeMs: request.timeMs,
            responseTimeMs: result.timeMs,
            responseBytes: result.imageBytes.byteLength,
            responseMs: roundPreviewMs(performance.now() - requestStartMs)
          })}`
        );
      }

      startTransition(() => {
        setPreview((current) => ({
          ...current,
          result: {
            imageUrl,
            frame: result.frame,
            timeMs: result.timeMs,
            durationMs: result.durationMs,
            currentCue: result.currentCue,
            previousCue: result.previousCue,
            nextCue: result.nextCue
          },
          error: "",
          isLoading: queuedRequestRef.current !== null,
          requestedTimeMs: current.requestedTimeMs,
          imageSwapStartedAtMs: performance.now()
        }));
      });

      renderedDurationMs = result.durationMs;
      revokeImageUrl(previousImageUrl);
    } catch (previewError) {
      if (requestGenerationRef.current !== request.generation) {
        return;
      }

      if (playbackActiveRef.current) {
        playbackActiveRef.current = false;
        setIsPlaying(false);
      }

      startTransition(() => {
        setPreview((current) => ({
          ...current,
          error: previewError instanceof Error ? previewError.message : String(previewError),
          isLoading: queuedRequestRef.current !== null
        }));
      });
    } finally {
      inFlightRequestRef.current = null;
      const queuedRequest = queuedRequestRef.current;
      queuedRequestRef.current = null;

      if (queuedRequest && requestGenerationRef.current === queuedRequest.generation) {
        void dispatchPreviewRequest(queuedRequest);
        return;
      }

      if (playbackActiveRef.current && requestGenerationRef.current === request.generation && renderedDurationMs !== undefined) {
        const fps = request.video.fps;
        const currentFrame = msToFrame(request.timeMs, fps);
        const nextFrame = currentFrame + 1;
        const totalFrames = durationMsToFrameCount(renderedDurationMs, fps);

        if (nextFrame < totalFrames) {
          const nextTimeMs = frameToMs(nextFrame, fps);
          const nextRequest = {
            ...request,
            timeMs: nextTimeMs,
            generation: requestGenerationRef.current
          };

          const elapsedMs = performance.now() - requestStartMs;
          const frameIntervalMs = 1000 / fps;
          const delayMs = Math.max(0, frameIntervalMs - elapsedMs);

          const advancePlayback = () => {
            if (!playbackActiveRef.current || requestGenerationRef.current !== nextRequest.generation) {
              return;
            }
            startTransition(() => {
              setPreview((current) => ({ ...current, requestedTimeMs: nextTimeMs }));
            });
            void dispatchPreviewRequest(nextRequest);
          };

          if (delayMs > 1) {
            window.setTimeout(advancePlayback, delayMs);
          } else {
            advancePlayback();
          }
          return;
        }

        playbackActiveRef.current = false;
        setIsPlaying(false);
      }

      startTransition(() => {
        setPreview((current) => ({ ...current, isLoading: false }));
      });
    }
  }

  function noteImagePainted() {
    if (!profilerEnabled || preview.imageSwapStartedAtMs === null || !preview.result) {
      return;
    }

    console.info(
      `[preview-profile:image-swap] ${JSON.stringify({
        frame: preview.result.frame,
        timeMs: preview.result.timeMs,
        imageSwapMs: roundPreviewMs(performance.now() - preview.imageSwapStartedAtMs)
      })}`
    );
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function revokeImageUrl(imageUrl: string | null) {
  if (imageUrl) {
    URL.revokeObjectURL(imageUrl);
  }
}

function roundPreviewMs(value: number) {
  return Number(value.toFixed(2));
}

interface RenderPreviewRequestPayload {
  audioPath: string;
  subtitlePath: string;
  scene: NonNullable<ComposerState["scene"]>;
  video: ComposerState["video"];
  timeMs: number;
  generation: number;
}
