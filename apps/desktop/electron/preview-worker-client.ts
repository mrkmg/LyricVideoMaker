import { Worker } from "node:worker_threads";
import type { RenderPreviewRequest, RenderPreviewResponse } from "../src/electron-api";
import type { PreviewWorkerRequest, PreviewWorkerResponse } from "./preview-worker-protocol";

interface PendingRequest {
  resolve: (value: RenderPreviewResponse | void) => void;
  reject: (error: Error) => void;
}

export interface PreviewWorkerClientOptions {
  workerPath: string;
  createWorker?: (filename: string) => Worker;
}

export class PreviewWorkerClient {
  private readonly workerPath: string;
  private readonly createWorkerInstance: (filename: string) => Worker;
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private pending = new Map<number, PendingRequest>();
  private disposed = false;

  constructor({ workerPath, createWorker }: PreviewWorkerClientOptions) {
    this.workerPath = workerPath;
    this.createWorkerInstance = createWorker ?? ((filename) => new Worker(filename));
  }

  start() {
    if (!this.worker && !this.disposed) {
      this.worker = this.bindWorker(this.createWorkerInstance(this.workerPath));
    }
  }

  async renderFrame(request: RenderPreviewRequest) {
    return (await this.sendRequest({
      type: "render-frame",
      requestId: this.nextRequestId++,
      payload: request
    })) as RenderPreviewResponse;
  }

  async disposePreview() {
    await this.sendRequest({
      type: "dispose-preview",
      requestId: this.nextRequestId++
    });
  }

  async close() {
    this.disposed = true;
    const activeWorker = this.worker;
    this.worker = null;
    this.rejectPending(new Error("Preview worker closed."));
    await activeWorker?.terminate();
  }

  private async sendRequest(message: PreviewWorkerRequest) {
    if (this.disposed) {
      throw new Error("Preview worker client is closed.");
    }

    this.start();
    const activeWorker = this.worker;
    if (!activeWorker) {
      throw new Error("Preview worker is unavailable.");
    }

    return await new Promise<RenderPreviewResponse | void>((resolve, reject) => {
      this.pending.set(message.requestId, { resolve, reject });
      activeWorker.postMessage(message);
    });
  }

  private bindWorker(worker: Worker) {
    worker.on("message", (message: PreviewWorkerResponse) => {
      const pending = this.pending.get(message.requestId);
      if (!pending) {
        return;
      }

      this.pending.delete(message.requestId);
      if (message.type === "error") {
        const error = new Error(message.error.message);
        error.stack = message.error.stack;
        pending.reject(error);
        return;
      }

      pending.resolve(message.payload ?? undefined);
    });

    worker.on("error", (error) => {
      this.rejectPending(error instanceof Error ? error : new Error(String(error)));
    });

    worker.on("exit", (code) => {
      const crashed = !this.disposed && code !== 0;
      if (this.worker === worker) {
        this.worker = null;
      }
      if (crashed) {
        this.rejectPending(new Error(`Preview worker exited unexpectedly with code ${code}.`));
      }
    });

    return worker;
  }

  private rejectPending(error: Error) {
    const requests = [...this.pending.values()];
    this.pending.clear();
    for (const request of requests) {
      request.reject(error);
    }
  }
}
