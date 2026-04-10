import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
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

    if (!enabled || paused || !scene) {
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
    setPreview((current) => ({
      ...current,
      requestedTimeMs:
        current.result?.durationMs !== undefined
          ? clamp(nextTimeMs, 0, current.result.durationMs)
          : Math.max(0, nextTimeMs)
    }));
  }

  return {
    enabled,
    preview,
    updatePreviewTime,
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

      revokeImageUrl(previousImageUrl);
    } catch (previewError) {
      if (requestGenerationRef.current !== request.generation) {
        return;
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
