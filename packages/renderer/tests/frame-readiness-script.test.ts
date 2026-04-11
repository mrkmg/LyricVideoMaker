import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FRAME_READINESS_SCRIPT_SOURCE } from "../src/live-dom";

// Minimal fake <video> element matching the subset of HTMLVideoElement that
// syncVideoElement touches.
class FakeVideo {
  public currentTime = 0;
  public duration = 10;
  public readyState = 2;
  private listeners = new Map<string, Array<(event?: unknown) => void>>();

  addEventListener(event: string, handler: (event?: unknown) => void, _options?: unknown) {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  removeEventListener(event: string, handler: (event?: unknown) => void) {
    const list = this.listeners.get(event);
    if (!list) return;
    const next = list.filter((h) => h !== handler);
    this.listeners.set(event, next);
  }

  load() {
    // Real HTMLVideoElement.load() starts async loading; metadata arrives later.
  }

  dispatchLoadedMetadata() {
    this.readyState = Math.max(this.readyState, 1);
    const list = this.listeners.get("loadedmetadata") ?? [];
    list.slice().forEach((handler) => handler());
  }

  dispatchLoadedData() {
    this.readyState = Math.max(this.readyState, 2);
    const list = this.listeners.get("loadeddata") ?? [];
    list.slice().forEach((handler) => handler());
  }

  dispatchSeeked() {
    const list = this.listeners.get("seeked") ?? [];
    list.slice().forEach((handler) => handler());
  }
}

interface FakeWindow {
  __frameReadiness: {
    register(task: Promise<unknown>, label?: string): void;
    awaitAll(): Promise<void>;
    pendingCount: number;
  };
  __syncVideoElement: (
    video: FakeVideo,
    targetTimeSeconds: number,
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

describe("FRAME_READINESS_SCRIPT_SOURCE — readiness hook contract (T-042, T-043)", () => {
  it("installs __frameReadiness with register/awaitAll/pendingCount", () => {
    const w = installScript();
    expect(typeof w.__frameReadiness.register).toBe("function");
    expect(typeof w.__frameReadiness.awaitAll).toBe("function");
    expect(w.__frameReadiness.pendingCount).toBe(0);
  });

  it("awaitAll resolves immediately when no tasks are pending (no added latency)", async () => {
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

  it("contract is component-agnostic — script does not reference video in public API surface", async () => {
    // The syncVideoElement helper names video, but the core readiness hook is
    // generic. Verify __frameReadiness.register accepts any promise shape.
    const w = installScript();
    w.__frameReadiness.register(Promise.resolve(42));
    w.__frameReadiness.register(Promise.resolve({ anything: "goes" }));
    // Pre-attach a no-op catch so the unhandled rejection does not leak into
    // the test runner before awaitAll settles it via Promise.allSettled.
    const rejected = Promise.reject(new Error("boom"));
    rejected.catch(() => {});
    w.__frameReadiness.register(rejected);
    expect(w.__frameReadiness.pendingCount).toBe(3);
    await w.__frameReadiness.awaitAll();
    expect(w.__frameReadiness.pendingCount).toBe(0);
  });
});

describe("__syncVideoElement — live-DOM seek handler (T-044)", () => {
  it("issues a seek when the desired time differs from currentTime", async () => {
    const w = installScript();
    const video = new FakeVideo();
    video.currentTime = 0.5;
    const readiness = w.__syncVideoElement(video, 2.0, "clip-a");
    expect(readiness).not.toBeNull();
    expect(video.currentTime).toBe(2.0);
    video.dispatchSeeked();
    await readiness!;
  });

  it("returns null (no seek, no task) when desired time equals current within epsilon", () => {
    const w = installScript();
    const video = new FakeVideo();
    video.currentTime = 1.0;
    // epsilon is 1/240 s ≈ 0.00417 — pass a difference smaller than that
    const readiness = w.__syncVideoElement(video, 1.001, "within-epsilon");
    expect(readiness).toBeNull();
    expect(video.currentTime).toBe(1.0);
  });

  it("waits for metadata before seeking an unloaded video", async () => {
    const w = installScript();
    const video = new FakeVideo();
    video.readyState = 0;
    video.currentTime = 0;
    const readiness = w.__syncVideoElement(video, 2.0, "unloaded");
    expect(readiness).not.toBeNull();
    expect(video.currentTime).toBe(0);
    video.dispatchLoadedMetadata();
    expect(video.currentTime).toBe(2.0);
    video.dispatchSeeked();
    video.dispatchLoadedData();
    await readiness!;
  });

  it("registers independent readiness tasks for two videos on the same frame", async () => {
    const w = installScript();
    const videoA = new FakeVideo();
    const videoB = new FakeVideo();
    videoA.currentTime = 0;
    videoB.currentTime = 0;

    const readinessA = w.__syncVideoElement(videoA, 1.5, "a");
    const readinessB = w.__syncVideoElement(videoB, 2.5, "b");
    expect(readinessA).not.toBeNull();
    expect(readinessB).not.toBeNull();

    w.__frameReadiness.register(readinessA!, "a");
    w.__frameReadiness.register(readinessB!, "b");
    expect(w.__frameReadiness.pendingCount).toBe(2);

    let resolved = false;
    const all = w.__frameReadiness.awaitAll().then(() => {
      resolved = true;
    });

    videoA.dispatchSeeked();
    await new Promise((r) => setTimeout(r, 0));
    expect(resolved).toBe(false);

    videoB.dispatchSeeked();
    await all;
    expect(resolved).toBe(true);
  });
});

describe("bounded timeout + logging (T-045)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a stuck seek resolves after the bounded timeout (capture proceeds)", async () => {
    const w = installScript();
    w.__frameReadinessSetCurrentFrame(42);
    const video = new FakeVideo();
    const readiness = w.__syncVideoElement(video, 5.0, "stuck-clip");
    expect(readiness).not.toBeNull();
    w.__frameReadiness.register(readiness!, "stuck-clip");

    let resolved = false;
    const all = w.__frameReadiness.awaitAll().then(() => {
      resolved = true;
    });

    // Advance the bounded timeout (1000ms)
    await vi.advanceTimersByTimeAsync(1100);
    await all;
    expect(resolved).toBe(true);
  });

  it("timeout events are drained with frame context for render logging", async () => {
    const w = installScript();
    w.__frameReadinessSetCurrentFrame(123);
    const video = new FakeVideo();
    const readiness = w.__syncVideoElement(video, 5.0, "lost-clip");
    w.__frameReadiness.register(readiness!, "lost-clip");

    const all = w.__frameReadiness.awaitAll();
    await vi.advanceTimersByTimeAsync(1100);
    await all;

    const drained = w.__frameReadinessDrainTimeoutEvents();
    expect(drained).toHaveLength(1);
    expect(drained[0].frame).toBe(123);
    expect(drained[0].label).toBe("lost-clip");
    expect(drained[0].timeoutMs).toBe(1000);

    // drain clears events
    const secondDrain = w.__frameReadinessDrainTimeoutEvents();
    expect(secondDrain).toHaveLength(0);
  });

  it("timeout does not abort the render — awaitAll still resolves", async () => {
    const w = installScript();
    const video = new FakeVideo();
    const readiness = w.__syncVideoElement(video, 9.0, "stuck");
    w.__frameReadiness.register(readiness!, "stuck");
    const all = w.__frameReadiness.awaitAll();
    await vi.advanceTimersByTimeAsync(1100);
    // should not throw
    await expect(all).resolves.toBeUndefined();
  });
});
