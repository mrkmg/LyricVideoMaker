/**
 * @vitest-environment jsdom
 */

import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { frameToMs, type SerializedSceneDefinition } from "@lyric-video-maker/core";
import type { ComposerState } from "./state/composer-types";
import { useFramePreview } from "./hooks/use-frame-preview";

describe("useFramePreview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:preview"),
        revokeObjectURL: vi.fn()
      })
    );
    window.lyricVideoApp = {
      getBootstrapData: vi.fn(),
      pickPath: vi.fn(),
      pickPaths: vi.fn(),
      startRender: vi.fn(),
      startSubtitleGeneration: vi.fn(),
      cancelSubtitleGeneration: vi.fn(),
      renderPreviewFrame: vi.fn(),
      saveScene: vi.fn(),
      deleteScene: vi.fn(),
      importScene: vi.fn(),
      exportScene: vi.fn(),
      listPlugins: vi.fn(),
      importPlugin: vi.fn(),
      removePlugin: vi.fn(),
      updatePlugin: vi.fn(),
      savePaneLayout: vi.fn(),
      setupFfmpeg: vi.fn().mockResolvedValue({ available: true }),
      disposePreview: vi.fn().mockResolvedValue(undefined),
      cancelRender: vi.fn(),
      onRenderProgress: vi.fn(() => () => undefined),
      onSubtitleGenerationProgress: vi.fn(() => () => undefined)
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("requests preview frames without requiring an output path and debounces changes", async () => {
    const renderPreviewFrame = vi.mocked(window.lyricVideoApp.renderPreviewFrame);
    renderPreviewFrame.mockResolvedValue(createPreviewResponse(0));

    render(createElement(PreviewHarness, { composer: createComposer(), paused: false }));

    await act(async () => {
      vi.advanceTimersByTime(249);
    });
    expect(renderPreviewFrame).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await flushMicrotasks();
    });

    expect(renderPreviewFrame).toHaveBeenCalledTimes(1);
    expect(renderPreviewFrame).toHaveBeenCalledWith({
      audioPath: "song.mp3",
      subtitlePath: "lyrics.srt",
      scene: expect.objectContaining({ id: "scene-1" }),
      video: expect.objectContaining({ width: 1920, height: 1080, fps: 30 }),
      timeMs: 0
    });
  });

  it("coalesces rapid time changes into one active request plus one queued latest target", async () => {
    let resolveFirst: ((value: ReturnType<typeof createPreviewResponse>) => void) | undefined;
    const renderPreviewFrame = vi
      .mocked(window.lyricVideoApp.renderPreviewFrame)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce(createPreviewResponse(2000));

    render(createElement(PreviewHarness, { composer: createComposer(), paused: false }));

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    fireEvent.click(screen.getByRole("button", { name: "Jump 1000" }));
    fireEvent.click(screen.getByRole("button", { name: "Jump 2000" }));

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(renderPreviewFrame).toHaveBeenCalledTimes(1);
    expect(renderPreviewFrame).toHaveBeenNthCalledWith(1, expect.objectContaining({ timeMs: 0 }));
    expect(screen.getByTestId("requested-time").textContent).toBe("2000");

    await act(async () => {
      resolveFirst?.(createPreviewResponse(0));
      await flushMicrotasks();
    });

    expect(renderPreviewFrame).toHaveBeenCalledTimes(2);
    expect(renderPreviewFrame).toHaveBeenNthCalledWith(2, expect.objectContaining({ timeMs: 2000 }));
  });

  it("togglePlayback starts sequential frame rendering", async () => {
    const renderPreviewFrame = vi.mocked(window.lyricVideoApp.renderPreviewFrame);

    let resolveFrame!: (value: ReturnType<typeof createPreviewResponse>) => void;
    function mockPendingFrame() {
      return new Promise<ReturnType<typeof createPreviewResponse>>((resolve) => {
        resolveFrame = resolve;
      });
    }

    renderPreviewFrame.mockImplementationOnce(mockPendingFrame);

    render(createElement(PreviewHarness, { composer: createComposer(), paused: false }));

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await act(async () => {
      resolveFrame(createPreviewResponse(0));
      await flushMicrotasks();
    });

    expect(renderPreviewFrame).toHaveBeenCalledTimes(1);

    renderPreviewFrame.mockImplementationOnce(mockPendingFrame);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.getByTestId("is-playing").textContent).toBe("true");
    expect(renderPreviewFrame).toHaveBeenCalledTimes(2);

    renderPreviewFrame.mockImplementationOnce(mockPendingFrame);

    await act(async () => {
      resolveFrame(createPreviewResponse(0));
      await flushMicrotasks();
    });

    // FPS-cap delay may require advancing timers
    await act(async () => {
      vi.advanceTimersByTime(Math.ceil(1000 / 30));
      await flushMicrotasks();
    });

    expect(renderPreviewFrame).toHaveBeenCalledTimes(3);
    expect(renderPreviewFrame).toHaveBeenNthCalledWith(3, expect.objectContaining({ timeMs: frameToMs(1, 30) }));
  });

  it("stops playback when updatePreviewTime is called", async () => {
    const renderPreviewFrame = vi.mocked(window.lyricVideoApp.renderPreviewFrame);

    let resolveFrame!: (value: ReturnType<typeof createPreviewResponse>) => void;
    renderPreviewFrame.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFrame = resolve;
        })
    );

    render(createElement(PreviewHarness, { composer: createComposer(), paused: false }));

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await act(async () => {
      resolveFrame(createPreviewResponse(0));
      await flushMicrotasks();
    });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.getByTestId("is-playing").textContent).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Jump 1000" }));

    expect(screen.getByTestId("is-playing").textContent).toBe("false");
  });

  it("stepForward advances by one frame", async () => {
    const renderPreviewFrame = vi.mocked(window.lyricVideoApp.renderPreviewFrame);
    renderPreviewFrame.mockResolvedValue(createPreviewResponse(0));

    render(createElement(PreviewHarness, { composer: createComposer(), paused: false }));

    await act(async () => {
      vi.advanceTimersByTime(250);
      await flushMicrotasks();
    });

    fireEvent.click(screen.getByRole("button", { name: "Step Forward" }));

    const expectedTimeMs = frameToMs(1, 30);
    expect(screen.getByTestId("requested-time").textContent).toBe(String(expectedTimeMs));
  });

  it("stepBackward retreats by one frame and clamps at zero", async () => {
    const renderPreviewFrame = vi.mocked(window.lyricVideoApp.renderPreviewFrame);
    renderPreviewFrame.mockResolvedValue(createPreviewResponse(0));

    render(createElement(PreviewHarness, { composer: createComposer(), paused: false }));

    await act(async () => {
      vi.advanceTimersByTime(250);
      await flushMicrotasks();
    });

    fireEvent.click(screen.getByRole("button", { name: "Step Backward" }));
    expect(screen.getByTestId("requested-time").textContent).toBe("0");
  });

  it("keeps the latest requested time and eventually displays the latest resolved frame", async () => {
    let resolveFirst: ((value: ReturnType<typeof createPreviewResponse>) => void) | undefined;
    let resolveSecond: ((value: ReturnType<typeof createPreviewResponse>) => void) | undefined;
    const renderPreviewFrame = vi
      .mocked(window.lyricVideoApp.renderPreviewFrame)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    render(createElement(PreviewHarness, { composer: createComposer(), paused: false }));

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    fireEvent.click(screen.getByRole("button", { name: "Jump 1000" }));
    fireEvent.click(screen.getByRole("button", { name: "Jump 2000" }));

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await act(async () => {
      resolveFirst?.(createPreviewResponse(0));
      await flushMicrotasks();
    });

    expect(screen.getByTestId("requested-time").textContent).toBe("2000");
    expect(screen.getByTestId("resolved-time").textContent).toBe("0");

    await act(async () => {
      resolveSecond?.(createPreviewResponse(2000));
      await flushMicrotasks();
    });

    expect(screen.getByTestId("resolved-time").textContent).toBe("2000");
    expect(screen.getByTestId("requested-time").textContent).toBe("2000");
  });
});

function PreviewHarness({
  composer,
  paused
}: {
  composer: ComposerState;
  paused: boolean;
}) {
  const { preview, isPlaying, updatePreviewTime, togglePlayback, stepForward, stepBackward } =
    useFramePreview({ composer, paused });

  return createElement(
    "div",
    null,
    createElement("button", { onClick: () => updatePreviewTime(1000) }, "Jump 1000"),
    createElement("button", { onClick: () => updatePreviewTime(2000) }, "Jump 2000"),
    createElement("button", { onClick: togglePlayback }, isPlaying ? "Pause" : "Play"),
    createElement("button", { onClick: stepForward }, "Step Forward"),
    createElement("button", { onClick: stepBackward }, "Step Backward"),
    createElement("div", { "data-testid": "requested-time" }, String(preview.requestedTimeMs)),
    createElement("div", { "data-testid": "resolved-time" }, String(preview.result?.timeMs ?? "")),
    createElement("div", { "data-testid": "is-playing" }, String(isPlaying))
  );
}

function createComposer(): ComposerState {
  return {
    audioPath: "song.mp3",
    subtitlePath: "lyrics.srt",
    outputPath: "",
    scene: createScene(),
    video: {
      width: 1920,
      height: 1080,
      fps: 30
    },
    render: { threads: 4, encoding: "x264", quality: "balanced" }
  };
}

function createScene(): SerializedSceneDefinition {
  return {
    id: "scene-1",
    name: "Scene 1",
    source: "built-in",
    readOnly: true,
    components: []
  };
}

function createPreviewResponse(timeMs: number) {
  return {
    imageBytes: new Uint8Array([1, 2, 3]),
    imageMimeType: "image/png",
    frame: Math.round(timeMs / 33.33),
    timeMs,
    durationMs: 5000,
    currentCue: null,
    previousCue: null,
    nextCue: null
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}
