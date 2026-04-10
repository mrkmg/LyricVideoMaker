import { dialog, ipcMain } from "electron";
import type { FilePickKind } from "../../src/electron-api";
import type { IpcDeps } from "./register-ipc-handlers";

export function registerDialogHandlers({ getMainWindow }: IpcDeps) {
  ipcMain.handle(
    "dialog:pick-path",
    async (_event, args: { kind: FilePickKind; suggestedName?: string }) => {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        return null;
      }

      if (args.kind === "output") {
        const result = await dialog.showSaveDialog(mainWindow, {
          defaultPath: args.suggestedName ?? "lyric-video.mp4",
          filters: [{ name: "MP4 Video", extensions: ["mp4"] }]
        });

        return result.canceled ? null : result.filePath;
      }

      const filters = getFileFilters(args.kind);
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters
      });

      return result.canceled ? null : result.filePaths[0] ?? null;
    }
  );
}

function getFileFilters(kind: FilePickKind) {
  switch (kind) {
    case "audio":
      return [{ name: "Audio Files", extensions: ["mp3"] }];
    case "subtitle":
      return [{ name: "Subtitle Files", extensions: ["srt"] }];
    case "lyrics-text":
      return [{ name: "Text Files", extensions: ["txt"] }];
    case "image":
      return [{ name: "Image Files", extensions: ["png", "jpg", "jpeg", "webp"] }];
    default:
      return [];
  }
}
