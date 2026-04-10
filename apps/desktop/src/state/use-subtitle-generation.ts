import { useCallback, useEffect, useState } from "react";
import type {
  StartSubtitleGenerationRequest,
  SubtitleGenerationProgressEvent
} from "../electron-api";
import type { ComposerState } from "./composer-types";
import { lyricVideoApp } from "../ipc/lyric-video-app";
import { createInitialSubtitleGenerationRequest } from "../lib/subtitle-request";

export interface SubtitleGenerationState {
  isDialogOpen: boolean;
  isGenerating: boolean;
  request: StartSubtitleGenerationRequest;
  progress: SubtitleGenerationProgressEvent | null;
  setRequest: React.Dispatch<React.SetStateAction<StartSubtitleGenerationRequest>>;
  open(audioPath: string): void;
  start(audioPath: string): Promise<void>;
  cancel(): Promise<void>;
  dismiss(): void;
}

/**
 * Owns subtitle-generation dialog state, the active request payload, the
 * progress stream from the main process, and the start/cancel/dismiss handlers.
 *
 * `setComposer` is invoked with the resolved subtitle path on success so the
 * generated SRT auto-fills the composer's `subtitlePath`.
 *
 * `onError` lets the host clear or surface the renderer-wide error banner.
 */
export function useSubtitleGeneration(
  setComposer: React.Dispatch<React.SetStateAction<ComposerState>>,
  onError: (message: string) => void
): SubtitleGenerationState {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [request, setRequest] = useState<StartSubtitleGenerationRequest>(
    createInitialSubtitleGenerationRequest
  );
  const [progress, setProgress] = useState<SubtitleGenerationProgressEvent | null>(null);

  useEffect(() => {
    const unsubscribe = lyricVideoApp.onSubtitleGenerationProgress((event) => {
      setProgress(event);
      if (event.status === "failed" || event.status === "cancelled") {
        setIsGenerating(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const open = useCallback(
    (audioPath: string) => {
      if (!audioPath) {
        onError("Select song audio before generating subtitles.");
        return;
      }

      setRequest((current) => ({ ...current, audioPath }));
      setProgress(null);
      setIsDialogOpen(true);
    },
    [onError]
  );

  const start = useCallback(
    async (audioPath: string) => {
      if (!audioPath) {
        onError("Select song audio before generating subtitles.");
        return;
      }

      onError("");
      setIsGenerating(true);
      setProgress({
        status: "starting",
        progress: 0,
        message: "Starting subtitle generation"
      });

      try {
        const result = await lyricVideoApp.startSubtitleGeneration({
          ...request,
          audioPath
        });
        setComposer((current) => ({ ...current, subtitlePath: result.outputPath }));
        setRequest((current) => ({ ...current, outputPath: result.outputPath }));
        setProgress({
          status: "completed",
          progress: 100,
          message: "Subtitle generation complete",
          outputPath: result.outputPath
        });
        setIsGenerating(false);
        setIsDialogOpen(false);
      } catch (generationError) {
        const message =
          generationError instanceof Error ? generationError.message : String(generationError);
        const isCancelled =
          generationError instanceof DOMException && generationError.name === "AbortError";
        setProgress({
          status: isCancelled ? "cancelled" : "failed",
          progress: 0,
          message: isCancelled ? "Subtitle generation cancelled" : "Subtitle generation failed",
          error: isCancelled ? undefined : message
        });
        setIsGenerating(false);
      }
    },
    [request, setComposer, onError]
  );

  const cancel = useCallback(async () => {
    await lyricVideoApp.cancelSubtitleGeneration();
    setIsGenerating(false);
  }, []);

  const dismiss = useCallback(() => {
    if (isGenerating) {
      return;
    }
    setIsDialogOpen(false);
    setProgress(null);
  }, [isGenerating]);

  return {
    isDialogOpen,
    isGenerating,
    request,
    progress,
    setRequest,
    open,
    start,
    cancel,
    dismiss
  };
}
