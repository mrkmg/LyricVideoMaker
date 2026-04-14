import { readFile } from "node:fs/promises";
import { ipcMain } from "electron";

export function registerFileHandlers() {
  ipcMain.handle("file:read-bytes", async (_event, filePath: string) => {
    return new Uint8Array(await readFile(filePath));
  });
}
