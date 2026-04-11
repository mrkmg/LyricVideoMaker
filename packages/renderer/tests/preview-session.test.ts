import { vi } from "vitest";
import type { RenderJob, SceneComponentDefinition } from "@lyric-video-maker/core";

const previewRuntime = vi.hoisted(() => {
  const cdpSession = {
    send: vi.fn(async (command: string) => {
      if (command === "Page.captureScreenshot") {
        return {
          data: Buffer.from("preview-frame").toString("base64")
        };
      }

      return {};
    }),
    detach: vi.fn(async () => undefined)
  };

  const page = {
    route: vi.fn(async () => undefined),
    unroute: vi.fn(async () => undefined),
    setContent: vi.fn(async () => undefined),
    evaluate: vi.fn(async (_handler: unknown, payload: unknown) => {
      if (
        payload &&
        typeof payload === "object" &&
        "components" in (payload as Record<string, unknown>) &&
        Array.isArray((payload as { components: unknown[] }).components)
      ) {
        const candidate = payload as { components: Array<Record<string, unknown>> };
        if (candidate.components[0]?.runtimeId) {
          return { warnings: [] };
        }
      }

      // awaitFrameReadiness (no payload) — return the no-hook fallback shape.
      if (payload === undefined) {
        return { timeouts: [] };
      }

      return undefined;
    }),
    on: vi.fn(),
    context: vi.fn()
  };

  const context = {
    newPage: vi.fn(async () => page),
    newCDPSession: vi.fn(async () => cdpSession),
    close: vi.fn(async () => undefined)
  };

  page.context.mockReturnValue(context);

  const browser = {
    newContext: vi.fn(async () => context),
    newBrowserCDPSession: vi.fn(),
    close: vi.fn(async () => undefined)
  };

  const launchMock = vi.fn(async () => browser);

  return {
    browser,
    cdpSession,
    context,
    launchMock,
    page
  };
});

vi.mock("playwright", () => ({
  chromium: {
    launch: previewRuntime.launchMock
  }
}));

import { createFramePreviewSession, createPreviewComputationCache } from "../src/index";

describe("createFramePreviewSession", () => {
  beforeEach(() => {
    previewRuntime.launchMock.mockClear();
    previewRuntime.browser.newContext.mockClear();
    previewRuntime.browser.close.mockClear();
    previewRuntime.context.newCDPSession.mockClear();
    previewRuntime.context.close.mockClear();
    previewRuntime.page.route.mockClear();
    previewRuntime.page.unroute.mockClear();
    previewRuntime.page.setContent.mockClear();
    previewRuntime.page.evaluate.mockClear();
    previewRuntime.page.on.mockClear();
    previewRuntime.cdpSession.send.mockClear();
    previewRuntime.cdpSession.detach.mockClear();
  });

  it("captures successive preview frames and disposes cleanly", async () => {
    const component = createPreviewComponent();
    const session = await createFramePreviewSession({
      job: createJob(),
      componentDefinitions: [component]
    });

    const first = await session.renderFrame({ frame: 0 });
    const second = await session.renderFrame({ frame: 30 });

    expect(previewRuntime.launchMock).toHaveBeenCalledTimes(1);
    // 1 mount + 2 (updateLiveDomScene + awaitFrameReadiness) per rendered frame = 5
    expect(previewRuntime.page.evaluate).toHaveBeenCalledTimes(5);
    expect(previewRuntime.cdpSession.send).toHaveBeenCalledWith("Page.enable");
    expect(previewRuntime.cdpSession.send).toHaveBeenCalledWith(
      "Page.captureScreenshot",
      expect.any(Object)
    );
    expect(first.frame).toBe(0);
    expect(first.timeMs).toBe(0);
    expect(second.frame).toBe(30);
    expect(second.timeMs).toBe(1000);
    expect(second.png.length).toBeGreaterThan(0);

    await session.dispose();

    expect(previewRuntime.page.unroute).toHaveBeenCalledTimes(1);
    expect(previewRuntime.cdpSession.detach).toHaveBeenCalledTimes(1);
    expect(previewRuntime.context.close).toHaveBeenCalledTimes(1);
    expect(previewRuntime.browser.close).toHaveBeenCalledTimes(1);

    await expect(session.renderFrame({ frame: 1 })).rejects.toThrow(
      "Preview session has already been disposed."
    );
  });

  it("reuses cached prepare results across preview session recreation when the cache key is stable", async () => {
    const prepare = vi.fn(async () => ({ token: "prepared" }));
    const component = createPreparedPreviewComponent(prepare, () => "stable");
    const previewCache = createPreviewComputationCache();

    const firstSession = await createFramePreviewSession({
      job: createJob(),
      componentDefinitions: [component],
      previewCache
    });
    await firstSession.dispose();

    const secondSession = await createFramePreviewSession({
      job: createJob(),
      componentDefinitions: [component],
      previewCache
    });
    await secondSession.dispose();

    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("does not reuse prepared results when the component has no prepare cache key", async () => {
    const prepare = vi.fn(async () => ({ token: "prepared" }));
    const component = createPreparedPreviewComponent(prepare);
    const previewCache = createPreviewComputationCache();

    const firstSession = await createFramePreviewSession({
      job: createJob(),
      componentDefinitions: [component],
      previewCache
    });
    await firstSession.dispose();

    const secondSession = await createFramePreviewSession({
      job: createJob(),
      componentDefinitions: [component],
      previewCache
    });
    await secondSession.dispose();

    expect(prepare).toHaveBeenCalledTimes(2);
  });

  it("invalidates cached prepare results when the prepare cache key changes", async () => {
    const prepare = vi.fn(async () => ({ token: "prepared" }));
    const component = createPreparedPreviewComponent(prepare, ({ options }) => String(options.version));
    const previewCache = createPreviewComputationCache();

    const firstSession = await createFramePreviewSession({
      job: createJob([{ version: 1 }]),
      componentDefinitions: [component],
      previewCache
    });
    await firstSession.dispose();

    const secondSession = await createFramePreviewSession({
      job: createJob([{ version: 2 }]),
      componentDefinitions: [component],
      previewCache
    });
    await secondSession.dispose();

    expect(prepare).toHaveBeenCalledTimes(2);
  });
});

function createPreviewComponent(): SceneComponentDefinition<Record<string, unknown>> {
  return {
    id: "preview-component",
    name: "Preview Component",
    staticWhenMarkupUnchanged: false,
    options: [],
    defaultOptions: {},
    browserRuntime: {
      runtimeId: "background-color",
      getInitialState() {
        return {
          background: "transparent"
        };
      },
      getFrameState({ frame, timeMs }) {
        return {
          frame,
          timeMs
        };
      }
    },
    Component: () => null
  };
}

function createPreparedPreviewComponent(
  prepare: SceneComponentDefinition<Record<string, unknown>>["prepare"],
  getPrepareCacheKey?: SceneComponentDefinition<Record<string, unknown>>["getPrepareCacheKey"]
): SceneComponentDefinition<Record<string, unknown>> {
  return {
    ...createPreviewComponent(),
    prepare,
    getPrepareCacheKey
  };
}

function createJob(
  optionOverrides: Array<Record<string, unknown>> = [{}]
): RenderJob {
  return {
    id: "job-preview",
    audioPath: "song.mp3",
    subtitlePath: "lyrics.srt",
    outputPath: "preview.mp4",
    sceneId: "scene-1",
    sceneName: "Scene 1",
    components: [
      {
        id: "instance-1",
        componentId: "preview-component",
        componentName: "Preview Component",
        enabled: true,
        options: optionOverrides[0] ?? {}
      }
    ],
    video: {
      width: 1920,
      height: 1080,
      fps: 30,
      durationMs: 2000,
      durationInFrames: 60
    },
    render: { threads: 4, encoding: "x264", quality: "balanced" },
    lyrics: [],
    createdAt: new Date().toISOString()
  };
}
