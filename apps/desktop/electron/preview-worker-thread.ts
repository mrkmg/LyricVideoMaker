import { parentPort } from "node:worker_threads";
import { previewRenderQueue } from "./services/preview/worker-runtime";
import type {
  PreviewWorkerRequest,
  PreviewWorkerResponse
} from "./services/preview/worker-protocol";

if (!parentPort) {
  throw new Error("Preview worker requires a parent port.");
}

parentPort.on("message", (message: PreviewWorkerRequest) => {
  void handleMessage(message);
});

async function handleMessage(message: PreviewWorkerRequest) {
  try {
    if (message.type === "render-frame") {
      const response = await previewRenderQueue.render(message.payload);
      parentPort?.postMessage({
        type: "success",
        requestId: message.requestId,
        payload: response
      } satisfies PreviewWorkerResponse);
      return;
    }

    await previewRenderQueue.dispose();
    parentPort?.postMessage({
      type: "success",
      requestId: message.requestId,
      payload: null
    } satisfies PreviewWorkerResponse);
  } catch (error) {
    parentPort?.postMessage({
      type: "error",
      requestId: message.requestId,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    } satisfies PreviewWorkerResponse);
  }
}
