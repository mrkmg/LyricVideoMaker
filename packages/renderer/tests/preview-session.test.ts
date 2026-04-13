import { vi } from "vitest";
import type { RenderJob, SceneComponentDefinition } from "@lyric-video-maker/core";

const previewRuntime = vi.hoisted(() => {
  const page = {
    targetId: "mock-target",
    send: vi.fn(async (command: string) => {
      if (command === "Page.captureScreenshot") {
        return {
          data: Buffer.from("preview-frame").toString("base64")
        };
      }
      return {};
    }),
    on: vi.fn(() => () => {}),
    setContent: vi.fn(async () => undefined),
    evaluate: vi.fn(async (_handler: unknown, payload: unknown) => {
      if (
        payload &&
        typeof payload === "object" &&
        "components" in (payload as Record<string, unknown>) &&
        Array.isArray((payload as { components: unknown[] }).components)
      ) {
        const candidate = payload as { components: Array<Record<string, unknown>> };
        if (candidate.components[0]?.componentId) {
          return { warnings: [] };
        }
      }

      // awaitFrameReadiness (no payload) — return the no-hook fallback shape.
      if (payload === undefined) {
        return { timeouts: [] };
      }

      return undefined;
    }),
    close: vi.fn(async () => undefined)
  };

  const browser = {
    client: {},
    port: 9999,
    close: vi.fn(async () => undefined)
  };

  const launched = {
    process: { kill: vi.fn() },
    port: 9999,
    wsEndpoint: "ws://127.0.0.1:9999/devtools/browser/mock",
    userDataDir: "/tmp/lvm-mock",
    kill: vi.fn(async () => undefined)
  };

  const launchMock = vi.fn(async () => launched);
  const connectBrowserMock = vi.fn(async () => browser);
  const createPageMock = vi.fn(async () => page);
  const resolveExecutableMock = vi.fn(async () => "/mock/chromium");

  return {
    page,
    browser,
    launched,
    launchMock,
    connectBrowserMock,
    createPageMock,
    resolveExecutableMock
  };
});

vi.mock("../src/browser/launch", () => ({
  launchChromium: previewRuntime.launchMock
}));

vi.mock("../src/browser/chromium-loader", () => ({
  resolveChromiumExecutable: previewRuntime.resolveExecutableMock,
  CHROMIUM_BUILD_ID: "mock"
}));

vi.mock("../src/browser/cdp-session", () => ({
  connectBrowser: previewRuntime.connectBrowserMock,
  createPage: previewRuntime.createPageMock
}));

import { createFramePreviewSession, createPreviewComputationCache } from "../src/index";

describe("createFramePreviewSession", () => {
  beforeEach(() => {
    previewRuntime.launchMock.mockClear();
    previewRuntime.connectBrowserMock.mockClear();
    previewRuntime.createPageMock.mockClear();
    previewRuntime.resolveExecutableMock.mockClear();
    previewRuntime.browser.close.mockClear();
    previewRuntime.launched.kill.mockClear();
    previewRuntime.page.send.mockClear();
    previewRuntime.page.on.mockClear();
    previewRuntime.page.setContent.mockClear();
    previewRuntime.page.evaluate.mockClear();
    previewRuntime.page.close.mockClear();
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
    expect(previewRuntime.connectBrowserMock).toHaveBeenCalledTimes(1);
    expect(previewRuntime.createPageMock).toHaveBeenCalledTimes(1);
    // 1 mount + 2 (updateLiveDomScene + awaitFrameReadiness) per rendered frame = 5
    expect(previewRuntime.page.evaluate).toHaveBeenCalledTimes(5);
    expect(previewRuntime.page.send).toHaveBeenCalledWith("Fetch.enable", expect.any(Object));
    expect(previewRuntime.page.send).toHaveBeenCalledWith(
      "Page.captureScreenshot",
      expect.any(Object)
    );
    expect(first.frame).toBe(0);
    expect(first.timeMs).toBe(0);
    expect(second.frame).toBe(30);
    expect(second.timeMs).toBe(1000);
    expect(second.png.length).toBeGreaterThan(0);

    await session.dispose();

    expect(previewRuntime.page.send).toHaveBeenCalledWith("Fetch.disable");
    expect(previewRuntime.page.close).toHaveBeenCalledTimes(1);
    expect(previewRuntime.browser.close).toHaveBeenCalledTimes(1);
    expect(previewRuntime.launched.kill).toHaveBeenCalledTimes(1);

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
