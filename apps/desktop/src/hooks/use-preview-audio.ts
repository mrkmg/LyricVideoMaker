import { useEffect, useRef } from "react";
import { lyricVideoApp } from "../ipc/lyric-video-app";

export function usePreviewAudio({
  audioPath,
  isPlaying,
  requestedTimeMs
}: {
  audioPath: string;
  isPlaying: boolean;
  requestedTimeMs: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const requestedTimeMsRef = useRef(requestedTimeMs);
  isPlayingRef.current = isPlaying;
  requestedTimeMsRef.current = requestedTimeMs;

  if (!audioRef.current) {
    audioRef.current = new Audio();
  }

  // Load audio bytes when audioPath changes
  useEffect(() => {
    const audio = audioRef.current!;
    if (!audioPath) {
      audio.pause();
      audio.removeAttribute("src");
      revokeBlobUrl(blobUrlRef);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const bytes = await lyricVideoApp.readFileBytes(audioPath);
        if (cancelled) return;

        const mimeType = audioMimeType(audioPath);
        const blobUrl = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: mimeType }));
        revokeBlobUrl(blobUrlRef);
        blobUrlRef.current = blobUrl;
        audio.src = blobUrl;

        if (isPlayingRef.current) {
          audio.currentTime = requestedTimeMsRef.current / 1000;
          audio.play().catch(swallowPlaybackError);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to load audio for preview:", error);
        }
      }
    })();

    return () => {
      cancelled = true;
      audio.pause();
      audio.removeAttribute("src");
      revokeBlobUrl(blobUrlRef);
    };
  }, [audioPath]);

  // Play/pause sync
  useEffect(() => {
    const audio = audioRef.current!;
    if (!audio.src) return;

    if (isPlaying) {
      audio.currentTime = requestedTimeMsRef.current / 1000;
      audio.play().catch(swallowPlaybackError);
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Scrub sync (only when paused)
  useEffect(() => {
    if (isPlaying) return;
    const audio = audioRef.current!;
    if (!audio.src) return;
    audio.currentTime = requestedTimeMs / 1000;
  }, [requestedTimeMs, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
      }
      revokeBlobUrl(blobUrlRef);
    };
  }, []);
}

function revokeBlobUrl(ref: React.MutableRefObject<string | null>) {
  if (ref.current) {
    URL.revokeObjectURL(ref.current);
    ref.current = null;
  }
}

function audioMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp3": return "audio/mpeg";
    case "wav": return "audio/wav";
    case "ogg": return "audio/ogg";
    case "flac": return "audio/flac";
    case "aac": return "audio/aac";
    case "m4a": return "audio/mp4";
    default: return "audio/mpeg";
  }
}

function swallowPlaybackError(error: unknown) {
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "NotAllowedError")) {
    return;
  }
  console.warn("Audio playback error:", error);
}
