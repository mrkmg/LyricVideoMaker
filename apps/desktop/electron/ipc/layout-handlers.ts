import { ipcMain } from "electron";
import type { PaneLayoutPreferences } from "../../src/electron-api";
import type { IpcDeps } from "./register-ipc-handlers";

export function registerLayoutHandlers({ layoutPreferencesStore }: IpcDeps) {
  ipcMain.handle("layout:save-pane-layout", async (_event, panes: PaneLayoutPreferences) => {
    await layoutPreferencesStore.updatePanes(panes);
  });
}
