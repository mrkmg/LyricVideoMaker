import { describe, expect, it, vi } from "vitest";
import { createLatestOnlyPreviewRenderQueue } from "../electron/preview-render-queue";

describe("createLatestOnlyPreviewRenderQueue", () => {
  it("keeps one active request and coalesces pending work to the latest target", async () => {
    type QueueRequest = { key: string; timeMs: number };
    const firstRender = createDeferred<{
      response: number;
      sessionKey: string;
      reusedSession: boolean;
    }>();
    const createSession = vi.fn(async (request: QueueRequest) => ({
      key: request.key,
      session: { key: request.key }
    }));
    const render = vi
      .fn()
      .mockImplementationOnce(async () => await firstRender.promise)
      .mockImplementationOnce(async (_session, request: QueueRequest) => ({
        response: request.timeMs,
        sessionKey: request.key,
        reusedSession: true
      }));

    const queue = createLatestOnlyPreviewRenderQueue({
      getSessionKey: (request: QueueRequest) => request.key,
      createSession,
      disposeSession: vi.fn(async () => undefined),
      render
    });

    const first = queue.render({ key: "same", timeMs: 0 });
    const second = queue.render({ key: "same", timeMs: 1000 });
    const third = queue.render({ key: "same", timeMs: 2000 });

    await Promise.resolve();
    expect(render).toHaveBeenCalledTimes(1);

    firstRender.resolve({ response: 0, sessionKey: "same", reusedSession: false });

    await expect(first).resolves.toBe(0);
    await expect(second).resolves.toBe(2000);
    await expect(third).resolves.toBe(2000);
    expect(render).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ key: "same" }),
      expect.objectContaining({ timeMs: 2000 })
    );
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it("reuses the same session for time-only changes and rebuilds once when the key changes", async () => {
    type QueueRequest = { key: string; timeMs: number };
    const disposeSession = vi.fn(async () => undefined);
    const createSession = vi.fn(async (request: QueueRequest) => ({
      key: request.key,
      session: { key: request.key }
    }));
    const render = vi.fn(async (_session, request: QueueRequest) => ({
      response: request.timeMs,
      sessionKey: request.key,
      reusedSession: true
    }));

    const queue = createLatestOnlyPreviewRenderQueue({
      getSessionKey: (request: QueueRequest) => request.key,
      createSession,
      disposeSession,
      render
    });

    await expect(queue.render({ key: "scene-a", timeMs: 0 })).resolves.toBe(0);
    await expect(queue.render({ key: "scene-a", timeMs: 500 })).resolves.toBe(500);
    await expect(queue.render({ key: "scene-b", timeMs: 0 })).resolves.toBe(0);

    expect(createSession).toHaveBeenCalledTimes(2);
    expect(disposeSession).toHaveBeenCalledTimes(1);
  });
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return {
    promise,
    resolve
  };
}
