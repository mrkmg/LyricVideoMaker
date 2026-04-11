import { dialog, ipcMain } from "electron";
import type { FilePickKind } from "../../src/electron-api";
import type { RenderEncoding } from "@lyric-video-maker/core";
import type { IpcDeps } from "./register-ipc-handlers";

export function registerDialogHandlers({ getMainWindow }: IpcDeps) {
  ipcMain.handle(
    "dialog:pick-path",
    async (
      _event,
      args: { kind: FilePickKind; suggestedName?: string; outputEncoding?: RenderEncoding }
    ) => {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        return null;
      }

      if (args.kind === "output") {
        const outputFilter = getOutputFileFilter(args.outputEncoding ?? "x264");
        const result = await dialog.showSaveDialog(mainWindow, {
          defaultPath: args.suggestedName ?? `lyric-video.${outputFilter.extensions[0]}`,
          filters: [outputFilter, { name: "All Video Files", extensions: ["mp4", "webm"] }]
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

function getOutputFileFilter(encoding: RenderEncoding) {
  if (encoding === "webm") {
    return { name: "WebM Video", extensions: ["webm"] };
  }

  return { name: "MP4 Video", extensions: ["mp4"] };
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
    case "video":
      return [{ name: "Video Files", extensions: ["mp4", "webm", "mov", "mkv"] }];
    default:
      return [];
  }
}
