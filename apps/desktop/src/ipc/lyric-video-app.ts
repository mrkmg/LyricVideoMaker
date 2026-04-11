import type { ElectronApi } from "../electron-api";

/**
 * Thin wrapper around `window.lyricVideoApp` so components and hooks depend on
 * this module instead of reaching into the global directly. Uses dynamic lookup
 * (each call reads `window.lyricVideoApp` at call time) so tests that swap the
 * global between `beforeEach` blocks continue to work.
 */
export const lyricVideoApp: ElectronApi = {
  getBootstrapData: () => window.lyricVideoApp.getBootstrapData(),
  pickPath: (kind, suggestedName, outputEncoding) =>
    window.lyricVideoApp.pickPath(kind, suggestedName, outputEncoding),
  startRender: (request) => window.lyricVideoApp.startRender(request),
  renderPreviewFrame: (request) => window.lyricVideoApp.renderPreviewFrame(request),
  startSubtitleGeneration: (request) => window.lyricVideoApp.startSubtitleGeneration(request),
  cancelSubtitleGeneration: () => window.lyricVideoApp.cancelSubtitleGeneration(),
  saveScene: (scene) => window.lyricVideoApp.saveScene(scene),
  deleteScene: (sceneId) => window.lyricVideoApp.deleteScene(sceneId),
  importScene: () => window.lyricVideoApp.importScene(),
  exportScene: (scene) => window.lyricVideoApp.exportScene(scene),
  savePaneLayout: (panes) => window.lyricVideoApp.savePaneLayout(panes),
  disposePreview: () => window.lyricVideoApp.disposePreview(),
  cancelRender: (jobId) => window.lyricVideoApp.cancelRender(jobId),
  onRenderProgress: (callback) => window.lyricVideoApp.onRenderProgress(callback),
  onSubtitleGenerationProgress: (callback) =>
    window.lyricVideoApp.onSubtitleGenerationProgress(callback)
};
