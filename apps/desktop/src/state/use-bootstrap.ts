import { useEffect, useState } from "react";
import type { AppBootstrapData } from "../electron-api";
import { lyricVideoApp } from "../ipc/lyric-video-app";

export interface BootstrapResult {
  bootstrap: AppBootstrapData | null;
  setBootstrap: React.Dispatch<React.SetStateAction<AppBootstrapData | null>>;
}

/**
 * Loads the initial bootstrap payload from the main process. Returns the
 * cached value plus a setter so callers can patch the cache after scene
 * save/delete/import operations.
 */
export function useBootstrap(
  onLoaded: (data: AppBootstrapData) => void
): BootstrapResult {
  const [bootstrap, setBootstrap] = useState<AppBootstrapData | null>(null);

  useEffect(() => {
    void lyricVideoApp.getBootstrapData().then((data) => {
      setBootstrap(data);
      onLoaded(data);
    });
    // onLoaded is intentionally excluded; bootstrap should run exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { bootstrap, setBootstrap };
}
