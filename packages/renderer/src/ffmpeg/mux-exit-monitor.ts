export type MuxExitListener = (error: Error | null) => void;

export interface MuxExitMonitor {
  /** Returns the recorded error if the muxer exited with one, otherwise null. */
  getExitError(): Error | null;
  /** True once the underlying ffmpeg process has exited (success or failure). */
  hasExited(): boolean;
  /**
   * Subscribe to the next exit event. If the muxer has already exited the
   * listener fires synchronously. Returns a function that removes the listener;
   * callers MUST invoke it when their work completes so that the listener set
   * does not grow with frame count.
   */
  addExitListener(listener: MuxExitListener): () => void;
  /**
   * Internal entry point used by the muxer to record the exit outcome and
   * notify all current subscribers exactly once.
   */
  markExited(error: Error | null): void;
}

export function createMuxExitMonitor(): MuxExitMonitor {
  let exited = false;
  let exitError: Error | null = null;
  const listeners = new Set<MuxExitListener>();

  return {
    getExitError() {
      return exitError;
    },
    hasExited() {
      return exited;
    },
    addExitListener(listener) {
      if (exited) {
        listener(exitError);
        return () => {};
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    markExited(error) {
      if (exited) {
        return;
      }
      exited = true;
      exitError = error;
      const pending = Array.from(listeners);
      listeners.clear();
      for (const listener of pending) {
        listener(error);
      }
    }
  };
}
