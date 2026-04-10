import { useCallback, useEffect, useState } from "react";
import type { RenderHistoryEntry } from "@lyric-video-maker/core";
import type { ComposerState } from "./composer-types";
import { lyricVideoApp } from "../ipc/lyric-video-app";
import { mergeRenderEntry } from "../lib/render-history";

const ACTIVE_RENDER_STATUSES = new Set(["queued", "preparing", "rendering", "muxing"]);

export interface RenderJobState {
  dialogEntry: RenderHistoryEntry | null;
  isDialogOpen: boolean;
  isSubmitting: boolean;
  hasActiveRender: boolean;
  submit(composer: ComposerState): Promise<void>;
  cancel(jobId: string): Promise<void>;
  dismiss(): void;
}

/**
 * Owns the render job dialog state, render-progress subscription, and the
 * submit/cancel/dismiss handlers. `onError` is invoked with validation or
 * submission failure messages so the host can surface them in its banner.
 */
export function useRenderJob(onError: (message: string) => void): RenderJobState {
  const [dialogEntry, setDialogEntry] = useState<RenderHistoryEntry | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = lyricVideoApp.onRenderProgress((event) => {
      setDialogEntry((current) => mergeRenderEntry(current, event));
      setIsDialogOpen(true);
      setIsSubmitting(false);
    });
    return () => unsubscribe();
  }, []);

  const submit = useCallback(
    async (composer: ComposerState) => {
      if (!composer.audioPath || !composer.subtitlePath || !composer.outputPath) {
        onError("Audio, subtitles, and output path are required.");
        return;
      }

      if (!composer.scene) {
        onError("Select or create a scene before rendering.");
        return;
      }

      onError("");
      setIsSubmitting(true);
      setIsDialogOpen(true);
      await lyricVideoApp.disposePreview();

      try {
        const entry = await lyricVideoApp.startRender({
          audioPath: composer.audioPath,
          subtitlePath: composer.subtitlePath,
          outputPath: composer.outputPath,
          scene: composer.scene,
          video: composer.video
        });
        setDialogEntry(entry);
        setIsSubmitting(false);
      } catch (submissionError) {
        onError(
          submissionError instanceof Error ? submissionError.message : String(submissionError)
        );
        setIsSubmitting(false);
        setIsDialogOpen(false);
      }
    },
    [onError]
  );

  const cancel = useCallback(async (jobId: string) => {
    await lyricVideoApp.cancelRender(jobId);
  }, []);

  const dismiss = useCallback(() => {
    setIsDialogOpen(false);
    setDialogEntry(null);
  }, []);

  const hasActiveRender =
    isSubmitting || (dialogEntry ? ACTIVE_RENDER_STATUSES.has(dialogEntry.status) : false);

  return {
    dialogEntry,
    isDialogOpen,
    isSubmitting,
    hasActiveRender,
    submit,
    cancel,
    dismiss
  };
}
