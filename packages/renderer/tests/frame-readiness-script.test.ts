import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FRAME_READINESS_SCRIPT_SOURCE } from "../src/live-dom";

class FakeImage {
  public src = "";
  public currentSrc = "";
  public complete = false;
  public naturalWidth = 0;
  public decode = vi.fn(async () => undefined);
  private listeners = new Map<string, Array<(event?: unknown) => void>>();

  addEventListener(event: string, handler: (event?: unknown) => void, _options?: unknown) {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  removeEventListener(event: string, handler: (event?: unknown) => void) {
    const list = this.listeners.get(event);
    if (!list) return;
    this.listeners.set(event, list.filter((h) => h !== handler));
  }

  dispatchLoad() {
    this.complete = true;
    this.naturalWidth = 10;
    this.currentSrc = this.src;
    const list = this.listeners.get("load") ?? [];
    list.slice().forEach((handler) => handler());
  }
}

interface FakeWindow {
  __frameReadiness: {
    register(task: Promise<unknown>, label?: string): void;
    awaitAll(): Promise<void>;
    pendingCount: number;
  };
  __syncImageFrameElement: (
    image: FakeImage,
    src: string,
    label?: string
  ) => Promise<void> | null;
  __frameReadinessSetCurrentFrame: (frame: number) => void;
  __frameReadinessDrainTimeoutEvents: () => Array<{
    frame: number;
    label: string | null;
    timeoutMs: number;
    timestamp: number;
  }>;
}

function installScript(): FakeWindow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeWindow: any = {};
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const evaluator = new Function("window", FRAME_READINESS_SCRIPT_SOURCE);
  evaluator(fakeWindow);
  return fakeWindow as FakeWindow;
}

describe("FRAME_READINESS_SCRIPT_SOURCE readiness hook", () => {
  it("installs __frameReadiness with register/awaitAll/pendingCount", () => {
    const w = installScript();
    expect(typeof w.__frameReadiness.register).toBe("function");
    expect(typeof w.__frameReadiness.awaitAll).toBe("function");
    expect(w.__frameReadiness.pendingCount).toBe(0);
  });

  it("awaitAll resolves immediately when no tasks are pending", async () => {
    const w = installScript();
    const start = Date.now();
    await w.__frameReadiness.awaitAll();
    expect(Date.now() - start).toBeLessThan(20);
  });

  it("awaitAll blocks until registered tasks resolve", async () => {
    const w = installScript();
    let resolveA: () => void = () => {};
    w.__frameReadiness.register(
      new Promise<void>((resolve) => {
        resolveA = resolve;
      }),
      "task-a"
    );
    let done = false;
    const awaiting = w.__frameReadiness.awaitAll().then(() => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 5));
    expect(done).toBe(false);
    resolveA();
    await awaiting;
    expect(done).toBe(true);
  });

  it("clears pending list between frames", async () => {
    const w = installScript();
    w.__frameReadiness.register(Promise.resolve("frame-1"));
    await w.__frameReadiness.awaitAll();
    expect(w.__frameReadiness.pendingCount).toBe(0);
    w.__frameReadiness.register(Promise.resolve("frame-2"));
    expect(w.__frameReadiness.pendingCount).toBe(1);
    await w.__frameReadiness.awaitAll();
    expect(w.__frameReadiness.pendingCount).toBe(0);
  });

  it("register accepts arbitrary promises", async () => {
    const w = installScript();
    w.__frameReadiness.register(Promise.resolve(42));
    w.__frameReadiness.register(Promise.resolve({ anything: "goes" }));
    const rejected = Promise.reject(new Error("boom"));
    rejected.catch(() => {});
    w.__frameReadiness.register(rejected);
    expect(w.__frameReadiness.pendingCount).toBe(3);
    await w.__frameReadiness.awaitAll();
    expect(w.__frameReadiness.pendingCount).toBe(0);
  });
});

describe("__syncImageFrameElement", () => {
  it("returns null when same source is already decoded", () => {
    const w = installScript();
    const image = new FakeImage();
    image.src = "http://lyric-video.local/video-frames/a/frame-00000001.jpg";
    image.currentSrc = image.src;
    image.complete = true;
    image.naturalWidth = 10;

    const readiness = w.__syncImageFrameElement(image, image.src, "frame-a");

    expect(readiness).toBeNull();
  });

  it("changes src and waits for load/decode before readiness settles", async () => {
    const w = installScript();
    const image = new FakeImage();
    const nextSrc = "http://lyric-video.local/video-frames/a/frame-00000002.jpg";

    const readiness = w.__syncImageFrameElement(image, nextSrc, "frame-b");
    expect(readiness).not.toBeNull();
    expect(image.src).toBe(nextSrc);
    w.__frameReadiness.register(readiness!, "frame-b");

    let settled = false;
    const all = w.__frameReadiness.awaitAll().then(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);

    image.dispatchLoad();
    await all;
    expect(image.decode).toHaveBeenCalled();
    expect(settled).toBe(true);
  });
});

describe("bounded timeout + logging", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stuck image load resolves after bounded timeout", async () => {
    const w = installScript();
    w.__frameReadinessSetCurrentFrame(42);
    const image = new FakeImage();
    const readiness = w.__syncImageFrameElement(
      image,
      "http://lyric-video.local/video-frames/a/frame-00000003.jpg",
      "stuck-frame"
    );
    expect(readiness).not.toBeNull();
    w.__frameReadiness.register(readiness!, "stuck-frame");

    const all = w.__frameReadiness.awaitAll();
    await vi.advanceTimersByTimeAsync(1100);
    await expect(all).resolves.toBeUndefined();

    const drained = w.__frameReadinessDrainTimeoutEvents();
    expect(drained).toHaveLength(1);
    expect(drained[0].frame).toBe(42);
    expect(drained[0].label).toBe("stuck-frame");
    expect(drained[0].timeoutMs).toBe(1000);
  });
});
