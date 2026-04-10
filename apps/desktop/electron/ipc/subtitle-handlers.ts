import { ipcMain } from "electron";
import type { StartSubtitleGenerationRequest } from "../../src/electron-api";
import { createGeneratedSubtitlePath } from "../services/subtitle-generator";
import type { IpcDeps } from "./register-ipc-handlers";

export function registerSubtitleHandlers({
  getMainWindow,
  subtitleGenerationRunner
}: IpcDeps) {
  ipcMain.handle(
    "subtitle:start-generation",
    async (_event, request: StartSubtitleGenerationRequest) => {
      const outputPath =
        request.outputPath ||
        (await createGeneratedSubtitlePath({
          audioPath: request.audioPath,
          mode: request.mode
        }));

      return await subtitleGenerationRunner.run(
        {
          ...request,
          outputPath
        },
        (event) => {
          getMainWindow()?.webContents.send("subtitle:progress", {
            ...event,
            outputPath: event.outputPath ?? outputPath
          });
        }
      );
    }
  );

  ipcMain.handle("subtitle:cancel-generation", async () => {
    subtitleGenerationRunner.cancel();
  });
}
