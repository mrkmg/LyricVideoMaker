import { join } from "node:path";
import { BrowserWindow } from "electron";

export interface CreateMainWindowOptions {
  onClosed(): void;
}

export function createMainWindow({ onClosed }: CreateMainWindowOptions): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#0d1021",
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", onClosed);

  return mainWindow;
}
