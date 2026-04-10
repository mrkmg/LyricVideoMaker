import { ipcMain } from "electron";
import type { StartRenderRequest } from "../../src/electron-api";
import {
  buildInitialRenderHistoryEntry,
  buildRenderJob,
  createAbortRegistry,
  runRenderJob
} from "../services/render-job-runner";
import {
  createAudioDurationLoader,
  createSubtitleCueLoader
} from "../shared/media-cache";
import type { IpcDeps } from "./register-ipc-handlers";

const abortRegistry = createAbortRegistry();
const getSubtitleCues = createSubtitleCueLoader();
const getAudioDuration = createAudioDurationLoader();

export function registerRenderHandlers({
  getMainWindow,
  previewWorkerClient,
  renderHistory
}: IpcDeps) {
  ipcMain.handle("render:start", async (_event, request: StartRenderRequest) => {
    await previewWorkerClient.disposePreview();

    const cues = await getSubtitleCues(request.subtitlePath);
    const durationMs = await getAudioDuration(request.audioPath);
    const job = buildRenderJob({ request, cues, durationMs });

    const controller = new AbortController();
    abortRegistry.set(job.id, controller);

    const entry = buildInitialRenderHistoryEntry(job);
    renderHistory.upsert(entry);

    void runRenderJob({
      job,
      controller,
      renderHistory,
      abortRegistry,
      getMainWindow
    });

    return entry;
  });

  ipcMain.handle("render:cancel", async (_event, jobId: string) => {
    abortRegistry.get(jobId)?.abort();
  });
}
