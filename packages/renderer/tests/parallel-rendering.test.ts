import { EventEmitter } from "node:events";
import { vi } from "vitest";
import {
  createBoundedOutputBuffer,
  createMuxExitMonitor,
  createOrderedFrameWriteQueue,
  renderFrameWithWorkerRecovery,
  resolveRenderParallelism,
  writeFrameToMuxerInput
} from "../src/index";

describe("parallel rendering helpers", () => {
  it("resolves worker counts from explicit input and default CPU fallback", () => {
    expect(resolveRenderParallelism({ parallelism: 3, totalFrames: 20 })).toBe(3);
    expect(resolveRenderParallelism({ totalFrames: 9 })).toBe(4);
    expect(resolveRenderParallelism({ totalFrames: 1 })).toBe(1);
  });

  it("retains only the bounded tail of accumulated process output", () => {
    const buffer = createBoundedOutputBuffer(8);

    buffer.append(Buffer.from("1234"));
    buffer.append(Buffer.from("5678"));
    buffer.append(Buffer.from("90"));

    expect(buffer.toString()).toBe("34567890");
  });

  it("writes out-of-order frames to the mux queue in frame order", async () => {
    const writes: string[] = [];
    const frameQueue = {
      enqueue: vi.fn(async (frame: Buffer) => {
        writes.push(frame.toString("utf8"));
      }),
      finish: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined)
    };

    const orderedQueue = createOrderedFrameWriteQueue({
      totalFrames: 4,
      frameQueue
    });

    await orderedQueue.enqueue({ frame: 1, buffer: Buffer.from("1") });
    await orderedQueue.enqueue({ frame: 3, buffer: Buffer.from("3") });
    expect(writes).toEqual([]);

    await orderedQueue.enqueue({ frame: 0, buffer: Buffer.from("0") });
    await waitForAsyncQueueWork();
    expect(writes).toEqual(["0", "1"]);

    await orderedQueue.enqueue({ frame: 2, buffer: Buffer.from("2") });
    await waitForAsyncQueueWork();
    expect(writes).toEqual(["0", "1", "2", "3"]);

    await orderedQueue.finish();
    expect(frameQueue.finish).toHaveBeenCalledTimes(1);
  });

  it("does not block workers on downstream mux writes until the pending window fills", async () => {
    let releaseFirstWrite: (() => void) | null = null;
    const writes: string[] = [];
    const frameQueue = {
      enqueue: vi.fn(async (frame: Buffer) => {
        writes.push(frame.toString("utf8"));
        if (writes.length === 1) {
          await new Promise<void>((resolve) => {
            releaseFirstWrite = resolve;
          });
        }
      }),
      finish: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined)
    };

    const orderedQueue = createOrderedFrameWriteQueue({
      totalFrames: 2,
      frameQueue,
      maxPendingFrames: 2
    });

    let firstSettled = false;
    let secondSettled = false;

    const first = orderedQueue.enqueue({ frame: 0, buffer: Buffer.from("0") }).then(() => {
      firstSettled = true;
    });
    const second = orderedQueue.enqueue({ frame: 1, buffer: Buffer.from("1") }).then(() => {
      secondSettled = true;
    });

    await Promise.resolve();
    await waitForAsyncQueueWork();

    expect(firstSettled).toBe(true);
    expect(secondSettled).toBe(true);
    expect(writes).toEqual(["0"]);

    releaseFirstWrite?.();

    await first;
    await second;
    await orderedQueue.finish();

    expect(writes).toEqual(["0", "1"]);
  });

  it("releases blocked producers when a downstream flush fails", async () => {
    let rejectFirstWrite: ((error: Error) => void) | null = null;
    const frameQueue = {
      enqueue: vi.fn(async () => {
        await new Promise<void>((_resolve, reject) => {
          rejectFirstWrite = reject;
        });
      }),
      finish: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined)
    };

    const orderedQueue = createOrderedFrameWriteQueue({
      totalFrames: 3,
      frameQueue,
      maxPendingFrames: 1
    });

    await orderedQueue.enqueue({ frame: 0, buffer: Buffer.from("0") });
    await orderedQueue.enqueue({ frame: 1, buffer: Buffer.from("1") });

    const blockedProducer = orderedQueue.enqueue({ frame: 2, buffer: Buffer.from("2") });
    rejectFirstWrite?.(new Error("mux failed"));

    await expect(blockedProducer).rejects.toThrow("mux failed");
    await expect(orderedQueue.finish()).rejects.toThrow("mux failed");
  });

  it("releases the next required frame when queue capacity stays full across a flush", async () => {
    let releaseFirstWrite: (() => void) | null = null;
    const writes: string[] = [];
    const frameQueue = {
      enqueue: vi.fn(async (frame: Buffer) => {
        writes.push(frame.toString("utf8"));
        if (writes.length === 1) {
          await new Promise<void>((resolve) => {
            releaseFirstWrite = resolve;
          });
        }
      }),
      finish: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined)
    };

    const orderedQueue = createOrderedFrameWriteQueue({
      totalFrames: 4,
      frameQueue,
      maxPendingFrames: 2
    });

    await orderedQueue.enqueue({ frame: 0, buffer: Buffer.from("0") });
    await orderedQueue.enqueue({ frame: 2, buffer: Buffer.from("2") });
    await orderedQueue.enqueue({ frame: 3, buffer: Buffer.from("3") });

    let nextFrameSettled = false;
    const nextFrame = orderedQueue.enqueue({ frame: 1, buffer: Buffer.from("1") }).then(() => {
      nextFrameSettled = true;
    });

    await waitForAsyncQueueWork();
    expect(nextFrameSettled).toBe(false);

    releaseFirstWrite?.();

    await nextFrame;
    await orderedQueue.finish();

    expect(nextFrameSettled).toBe(true);
    expect(writes).toEqual(["0", "1", "2", "3"]);
  });

  it("fails finish when frames are missing", async () => {
    const orderedQueue = createOrderedFrameWriteQueue({
      totalFrames: 3,
      frameQueue: {
        enqueue: vi.fn(async () => undefined),
        finish: vi.fn(async () => undefined),
        abort: vi.fn(async () => undefined)
      }
    });

    await orderedQueue.enqueue({ frame: 1, buffer: Buffer.from("1") });

    await expect(orderedQueue.finish()).rejects.toThrow(
      "Render finished with missing frames."
    );
  });

  it("times out stalled ffmpeg stdin writes with mux diagnostics", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    const stdin = new FakeWritable({
      acceptWrite: true
    });

    await expect(
      writeFrameToMuxerInput({
        stdin: stdin as never,
        frame: Buffer.from("frame"),
        logger,
        diagnostics: {
          orderedPendingFrames: 2,
          orderedNextFrameToWrite: 17,
          orderedLastFlushedFrame: 16,
          frameQueueBufferedFrames: 1,
          frameQueueLastCompletedFrame: 15,
          ffmpegFramesWritten: 16,
          ffmpegLastWriteStartedAtMs: Date.now(),
          ffmpegLastWriteCompletedAtMs: Date.now() - 1000,
          ffmpegPid: 1234
        },
        timeoutMs: 25
      })
    ).rejects.toThrow("ffmpeg stdin write timed out");

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toContain("ffmpeg stdin write stalled");
    expect(logger.error.mock.calls[0][0]).toContain("nextExpected=17");
  });

  it("waits for drain before completing a backpressured ffmpeg stdin write", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    const stdin = new FakeWritable({
      acceptWrite: false
    });

    let settled = false;
    const writePromise = writeFrameToMuxerInput({
      stdin: stdin as never,
      frame: Buffer.from("frame"),
      logger,
      diagnostics: {
        orderedPendingFrames: 0,
        orderedNextFrameToWrite: 1,
        orderedLastFlushedFrame: 0,
        frameQueueBufferedFrames: 1,
        frameQueueLastCompletedFrame: 0,
        ffmpegFramesWritten: 0,
        ffmpegLastWriteStartedAtMs: 0,
        ffmpegLastWriteCompletedAtMs: Date.now(),
        ffmpegPid: 4321
      },
      timeoutMs: 1000
    }).then(() => {
      settled = true;
    });

    stdin.completeWrite();
    await Promise.resolve();
    expect(settled).toBe(false);

    stdin.emitDrain();
    await writePromise;
    expect(settled).toBe(true);
  });

  it("does not accumulate exit monitor listeners across many frame writes", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    const exitMonitor = createMuxExitMonitor();
    const totalFrames = 200;

    for (let frame = 0; frame < totalFrames; frame += 1) {
      const stdin = new FakeWritable({ acceptWrite: true });
      const writePromise = writeFrameToMuxerInput({
        stdin: stdin as never,
        frame: Buffer.from(`frame-${frame}`),
        logger,
        exitMonitor,
        timeoutMs: 1000
      });
      stdin.completeWrite();
      await writePromise;
    }

    // After every write completes its listener must have been removed.
    // Triggering an exit now should not invoke any leftover per-frame listener
    // (which would have called fail() on an already-settled promise).
    const aborts: Error[] = [];
    exitMonitor.addExitListener((error) => {
      if (error) aborts.push(error);
    });
    exitMonitor.markExited(new Error("post-render exit"));
    expect(aborts).toHaveLength(1);
  });

  it("propagates a muxer exit to an in-flight backpressured write", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    const exitMonitor = createMuxExitMonitor();
    const stdin = new FakeWritable({ acceptWrite: false });

    const writePromise = writeFrameToMuxerInput({
      stdin: stdin as never,
      frame: Buffer.from("frame"),
      logger,
      exitMonitor,
      timeoutMs: 5000
    });

    exitMonitor.markExited(new Error("ffmpeg exited with code 1: bad input"));

    await expect(writePromise).rejects.toThrow("bad input");
  });

  it("rejects immediately when the muxer has already exited before the write starts", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    const exitMonitor = createMuxExitMonitor();
    exitMonitor.markExited(new Error("ffmpeg exited with code 1: previously"));

    const stdin = new FakeWritable({ acceptWrite: true });
    await expect(
      writeFrameToMuxerInput({
        stdin: stdin as never,
        frame: Buffer.from("frame"),
        logger,
        exitMonitor,
        timeoutMs: 5000
      })
    ).rejects.toThrow("previously");
  });

  it("recreates a worker session and retries a frame after a timed out render stage", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    const disposeFirst = vi.fn(async () => undefined);
    const firstWorker = {
      renderFrame: vi.fn(async () => {
        throw new Error("Chromium session worker-7 timed out during capture for frame 1335 after 15000ms.");
      }),
      dispose: disposeFirst
    };
    const secondWorker = {
      renderFrame: vi.fn(async ({ frame }: { frame: number }) => ({
        png: Buffer.from(String(frame)),
        frame,
        timeMs: frame * 10
      })),
      dispose: vi.fn(async () => undefined)
    };
    const workerHandle = {
      current: firstWorker
    };

    const result = await renderFrameWithWorkerRecovery({
      workerHandle,
      frame: 1335,
      workerIndex: 7,
      createWorkerSession: vi.fn(async () => secondWorker),
      logger,
      retryLimit: 2
    });

    expect(disposeFirst).toHaveBeenCalledTimes(1);
    expect(workerHandle.current).toBe(secondWorker);
    expect(secondWorker.renderFrame).toHaveBeenCalledWith({ frame: 1335 });
    expect(result.frame).toBe(1335);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

async function waitForAsyncQueueWork() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

class FakeWritable extends EventEmitter {
  private readonly acceptWrite: boolean;
  private callback: ((error?: Error | null) => void) | null = null;

  constructor({ acceptWrite }: { acceptWrite: boolean }) {
    super();
    this.acceptWrite = acceptWrite;
  }

  write(_chunk: Buffer, callback: (error?: Error | null) => void) {
    this.callback = callback;
    return this.acceptWrite;
  }

  completeWrite(error?: Error) {
    const callback = this.callback;
    this.callback = null;
    callback?.(error ?? null);
  }

  emitDrain() {
    this.emit("drain");
  }
}
