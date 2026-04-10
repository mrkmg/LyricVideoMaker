import { join } from "node:path";
import { app } from "electron";

/**
 * Resolves the repository root for the desktop app, which holds the
 * `sidecars/` directory consumed by the subtitle generator. In development
 * `__dirname` is `apps/desktop/dist-electron`, three levels below the repo
 * root. When packaged the app sits one level above `dist-electron`.
 */
export function getAppRootDir() {
  return join(__dirname, app.isPackaged ? ".." : "../../..");
}
