import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { PreviewWorkerClient } from "../electron/services/preview/worker-client";

class MockWorker extends EventEmitter {
  public readonly postedMessages: unknown[] = [];
  public terminated = false;

  postMessage(message: unknown) {
    this.postedMessages.push(message);
  }

  async terminate() {
    this.terminated = true;
    return 0;
  }
}

describe("PreviewWorkerClient", () => {
  it("proxies render and dispose requests to the worker", async () => {
    const worker = new MockWorker();
    const client = new PreviewWorkerClient({
      workerPath: "preview-worker.js",
      createWorker: () => worker as never
    });

    const renderPromise = client.renderFrame({
      audioPath: "song.mp3",
      subtitlePath: "lyrics.srt",
      scene: {
        id: "scene-1",
        name: "Scene 1",
        source: "built-in",
        readOnly: true,
        components: []
      },
      timeMs: 250
    });
    worker.emit("message", {
      type: "success",
      requestId: 1,
      payload: {
        imageBytes: new Uint8Array([1]),
        imageMimeType: "image/png",
        frame: 7,
        timeMs: 250,
        durationMs: 1000,
        currentCue: null,
        previousCue: null,
        nextCue: null
      }
    });

    await expect(renderPromise).resolves.toMatchObject({ frame: 7, timeMs: 250 });

    const disposePromise = client.disposePreview();
    worker.emit("message", {
      type: "success",
      requestId: 2,
      payload: null
    });
    await expect(disposePromise).resolves.toBeUndefined();
    expect(worker.postedMessages).toHaveLength(2);
  });

  it("recreates the worker after an unexpected exit", async () => {
    const workers = [new MockWorker(), new MockWorker()];
    let workerIndex = 0;
    const client = new PreviewWorkerClient({
      workerPath: "preview-worker.js",
      createWorker: () => workers[workerIndex++] as never
    });

    const firstRender = client.renderFrame({
      audioPath: "song.mp3",
      subtitlePath: "lyrics.srt",
      scene: {
        id: "scene-1",
        name: "Scene 1",
        source: "built-in",
        readOnly: true,
        components: []
      },
      timeMs: 0
    });
    workers[0].emit("exit", 1);

    await expect(firstRender).rejects.toThrow("Preview worker exited unexpectedly with code 1.");

    const secondRender = client.renderFrame({
      audioPath: "song.mp3",
      subtitlePath: "lyrics.srt",
      scene: {
        id: "scene-1",
        name: "Scene 1",
        source: "built-in",
        readOnly: true,
        components: []
      },
      timeMs: 500
    });
    workers[1].emit("message", {
      type: "success",
      requestId: 2,
      payload: {
        imageBytes: new Uint8Array([2]),
        imageMimeType: "image/png",
        frame: 15,
        timeMs: 500,
        durationMs: 1000,
        currentCue: null,
        previousCue: null,
        nextCue: null
      }
    });

    await expect(secondRender).resolves.toMatchObject({ frame: 15, timeMs: 500 });
    expect(workerIndex).toBe(2);
  });
});
