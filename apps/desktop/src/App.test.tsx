/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AppBootstrapData,
  ElectronApi,
  RenderPreviewResponse
} from "./electron-api";
import { App } from "./App";
import { useFramePreview } from "./use-frame-preview";

vi.mock("./use-frame-preview", () => ({
  useFramePreview: vi.fn()
}));

describe("App", () => {
  let progressListener:
    | ((event: {
        jobId: string;
        status: "queued" | "preparing" | "rendering" | "muxing" | "completed" | "failed" | "cancelled";
        progress: number;
        message: string;
        etaMs?: number;
        renderFps?: number;
        outputPath?: string;
        error?: string;
      }) => void)
    | undefined;

  beforeEach(() => {
    progressListener = undefined;
    vi.mocked(useFramePreview).mockReturnValue({
      enabled: true,
      preview: {
        requestedTimeMs: 1200,
        isLoading: false,
        error: "",
        result: createPreviewResponse()
      },
      updatePreviewTime: vi.fn()
    });

    const api: ElectronApi = {
      getBootstrapData: vi.fn().mockResolvedValue(createBootstrapData()),
      pickPath: vi.fn().mockImplementation(async (kind) => {
        switch (kind) {
          case "audio":
            return "song.mp3";
          case "subtitle":
            return "lyrics.srt";
          case "output":
            return "output.mp4";
          default:
            return "image.png";
        }
      }),
      startRender: vi.fn().mockResolvedValue({
        id: "job-1",
        sceneId: "scene-1",
        sceneName: "Scene 1",
        outputPath: "output.mp4",
        createdAt: "2026-04-09T12:00:00.000Z",
        status: "queued",
        progress: 0,
        message: "Queued",
        logs: []
      }),
      renderPreviewFrame: vi.fn<() => Promise<RenderPreviewResponse>>(),
      saveScene: vi.fn(async (scene) => ({ ...scene, source: "user" })),
      deleteScene: vi.fn().mockResolvedValue(undefined),
      importScene: vi.fn().mockResolvedValue(null),
      exportScene: vi.fn().mockResolvedValue(null),
      disposePreview: vi.fn().mockResolvedValue(undefined),
      cancelRender: vi.fn().mockResolvedValue(undefined),
      onRenderProgress: vi.fn((callback) => {
        progressListener = callback;
        return () => undefined;
      })
    };

    window.lyricVideoApp = api;
  });

  it("defaults to the General inspector and keeps the full preview controls visible", async () => {
    render(createElement(App));

    expect(await screen.findByRole("heading", { name: "General" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "General" })).toBeTruthy();
    expect(screen.getByText("Single-frame preview")).toBeTruthy();
    expect(screen.getByText("Timeline")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous Cue" })).toBeTruthy();
    expect(screen.getAllByText("Current Cue")).toHaveLength(2);
    expect(screen.getAllByText("Next Cue")).toHaveLength(2);
  });

  it("switches the bottom inspector when selecting scene and component items", async () => {
    render(createElement(App));

    await screen.findByRole("heading", { name: "General" });

    fireEvent.click(screen.getByRole("button", { name: "Scene" }));
    expect(await screen.findByRole("heading", { name: "Scene" })).toBeTruthy();
    expect(screen.getByText("Saved Scenes")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Select Lyrics component/i }));
    expect(await screen.findByRole("heading", { name: "Lyrics" })).toBeTruthy();
    expect(screen.getByText("Core Options")).toBeTruthy();
  });

  it("adds a component, auto-selects it, and falls back to Scene after removal", async () => {
    render(createElement(App));

    await screen.findByRole("heading", { name: "General" });

    expect(screen.getAllByRole("button", { name: /Select .* component/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Select .* component/i })).toHaveLength(2);
    });
    expect(screen.getByRole("heading", { name: "Background" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByRole("heading", { name: "Scene" })).toBeTruthy();
  });

  it("opens the render dialog and updates it from progress events", async () => {
    render(createElement(App));

    await screen.findByRole("heading", { name: "General" });

    fireEvent.click(screen.getByRole("button", { name: "Pick MP3" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick SRT" }));
    fireEvent.click(screen.getByRole("button", { name: "Save As" }));

    await waitFor(() => {
      expect(screen.getByText("song.mp3")).toBeTruthy();
      expect(screen.getByText("lyrics.srt")).toBeTruthy();
      expect(screen.getByText("output.mp4")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Render MP4" }));

    expect(await screen.findByRole("heading", { name: "Rendering MP4" })).toBeTruthy();
    expect(window.lyricVideoApp.startRender).toHaveBeenCalledTimes(1);

    await act(async () => {
      progressListener?.({
        jobId: "job-1",
        status: "completed",
        progress: 100,
        message: "Finished render"
      });
    });

    expect(await screen.findByRole("heading", { name: "Render Complete" })).toBeTruthy();
    expect(screen.getByText("100% complete")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Render Complete" })).toBeNull();
    });
  });
});

function createBootstrapData(): AppBootstrapData {
  return {
    scenes: [
      {
        id: "scene-1",
        name: "Scene 1",
        description: "Test scene",
        source: "built-in",
        readOnly: true,
        components: [
          {
            id: "lyrics-1",
            componentId: "lyrics",
            enabled: true,
            options: {
              textColor: "#ffffff",
              imagePath: ""
            }
          }
        ]
      }
    ],
    components: [
      {
        id: "background",
        name: "Background",
        description: "Background image layer",
        options: [
          {
            id: "imagePath",
            label: "Image",
            type: "image"
          }
        ],
        defaultOptions: {
          imagePath: ""
        }
      },
      {
        id: "lyrics",
        name: "Lyrics",
        description: "Lyrics layer",
        options: [
          {
            id: "textColor",
            label: "Text Color",
            type: "color",
            defaultValue: "#ffffff"
          }
        ],
        defaultOptions: {
          textColor: "#ffffff"
        }
      }
    ],
    fonts: ["DM Sans", "Arial"],
    history: []
  };
}

function createPreviewResponse(): RenderPreviewResponse {
  return {
    imageDataUrl: "data:image/png;base64,abc123",
    frame: 36,
    timeMs: 1200,
    durationMs: 5000,
    currentCue: {
      index: 2,
      startMs: 1000,
      endMs: 2000,
      text: "Current lyric",
      lines: ["Current lyric"]
    },
    previousCue: {
      index: 1,
      startMs: 0,
      endMs: 900,
      text: "Previous lyric",
      lines: ["Previous lyric"]
    },
    nextCue: {
      index: 3,
      startMs: 2100,
      endMs: 3000,
      text: "Next lyric",
      lines: ["Next lyric"]
    }
  };
}
