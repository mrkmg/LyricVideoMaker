import { useEffect, useMemo, useState } from "react";
import type {
  RenderHistoryEntry,
  SceneComponentInstance
} from "@lyric-video-maker/core";
import { isSceneOptionCategory } from "@lyric-video-maker/core";
import {
  cloneComponent,
  cloneScene,
  createInstanceId,
  createSceneComponentInstance,
  emptyComposerState,
  FPS_PRESETS,
  getCategoryStateKey,
  getFileName,
  stripExtension,
  upsertHistory,
  upsertScene,
  VIDEO_SIZE_PRESETS
} from "./app-utils";
import { RenderHistoryPanel } from "./components/render-history-panel";
import { SceneLibraryPanel } from "./components/scene-library-panel";
import { SourceFilesPanel } from "./components/source-files-panel";
import { VideoSettingsPanel } from "./components/video-settings-panel";
import type { ComposerState } from "./composer-types";
import type { AppBootstrapData, FilePickKind } from "./electron-api";
import { PreviewPanel } from "./components/preview-panel";
import { useFramePreview } from "./use-frame-preview";

export function App() {
  const [bootstrap, setBootstrap] = useState<AppBootstrapData | null>(null);
  const [composer, setComposer] = useState<ComposerState>(emptyComposerState);
  const [history, setHistory] = useState<RenderHistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [componentToAddId, setComponentToAddId] = useState("");

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    void window.lyricVideoApp.getBootstrapData().then((data) => {
      setBootstrap(data);
      setHistory(data.history);

      if (data.scenes[0]) {
        setComposer((current) => ({ ...current, scene: cloneScene(data.scenes[0]) }));
      }
      if (data.components[0]) {
        setComponentToAddId(data.components[0].id);
      }
    });

    unsubscribe = window.lyricVideoApp.onRenderProgress((event) => {
      setHistory((current) => upsertHistory(current, event));
      setIsSubmitting(false);
    });

    return () => unsubscribe?.();
  }, []);

  const scenes = bootstrap?.scenes ?? [];
  const components = bootstrap?.components ?? [];
  const selectedScene = composer.scene;
  const componentCatalog = useMemo(
    () => new Map(components.map((component) => [component.id, component])),
    [components]
  );
  const builtInScenes = useMemo(() => scenes.filter((scene) => scene.source === "built-in"), [scenes]);
  const userScenes = useMemo(() => scenes.filter((scene) => scene.source === "user"), [scenes]);
  const hasActiveRender = history.some((entry) =>
    ["queued", "preparing", "rendering", "muxing"].includes(entry.status)
  );
  const previewPaused = hasActiveRender || isSubmitting;
  const { enabled: previewEnabled, preview, updatePreviewTime } = useFramePreview({
    composer,
    paused: previewPaused
  });
  const selectedVideoSizePresetId =
    VIDEO_SIZE_PRESETS.find(
      (preset) => preset.width === composer.video.width && preset.height === composer.video.height
    )?.id ?? "custom";
  const selectedFpsPresetId =
    FPS_PRESETS.find((preset) => preset.fps === composer.video.fps)?.id ?? "custom";

  useEffect(() => {
    if (!selectedScene) {
      return;
    }

    setExpandedCategories((current) => {
      const next = { ...current };

      for (const instance of selectedScene.components) {
        const component = componentCatalog.get(instance.componentId);
        if (!component) {
          continue;
        }

        for (const option of component.options) {
          if (isSceneOptionCategory(option)) {
            const key = getCategoryStateKey(instance.id, option.id);
            if (next[key] === undefined) {
              next[key] = option.defaultExpanded ?? true;
            }
          }
        }
      }

      return next;
    });
  }, [componentCatalog, selectedScene]);

  if (!bootstrap || !selectedScene) {
    return <div className="app-shell loading">Loading composer...</div>;
  }

  async function handlePickPath(kind: FilePickKind, instanceId?: string, optionId?: string) {
    const suggestedName =
      kind === "output" && composer.audioPath
        ? `${stripExtension(getFileName(composer.audioPath))}.mp4`
        : undefined;
    const result = await window.lyricVideoApp.pickPath(kind, suggestedName);
    if (!result) {
      return;
    }

    setError("");

    if (kind === "audio") {
      setComposer((current) => ({ ...current, audioPath: result }));
      return;
    }
    if (kind === "subtitle") {
      setComposer((current) => ({ ...current, subtitlePath: result }));
      return;
    }
    if (kind === "output") {
      setComposer((current) => ({ ...current, outputPath: result }));
      return;
    }

    if (instanceId && optionId) {
      updateSceneComponent(instanceId, (current) => ({
        ...current,
        options: { ...current.options, [optionId]: result }
      }));
    }
  }

  async function handleSubmit() {
    if (!composer.audioPath || !composer.subtitlePath || !composer.outputPath) {
      setError("Audio, subtitles, and output path are required.");
      return;
    }

    if (!composer.scene) {
      setError("Select or create a scene before rendering.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    await window.lyricVideoApp.disposePreview();

    try {
      const entry = await window.lyricVideoApp.startRender({
        audioPath: composer.audioPath,
        subtitlePath: composer.subtitlePath,
        outputPath: composer.outputPath,
        scene: composer.scene,
        video: composer.video
      });
      setHistory((current) => upsertHistory(current, entry));
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : String(submissionError));
      setIsSubmitting(false);
    }
  }

  function handleSceneChange(sceneId: string) {
    const nextScene = scenes.find((scene) => scene.id === sceneId);
    if (!nextScene) {
      return;
    }

    setComposer((current) => ({ ...current, scene: cloneScene(nextScene) }));
  }

  async function handleSaveScene() {
    if (!composer.scene) {
      return;
    }

    const saved = await window.lyricVideoApp.saveScene(composer.scene);
    setBootstrap((current) =>
      current ? { ...current, scenes: upsertScene(current.scenes, saved) } : current
    );
    setComposer((current) => ({ ...current, scene: cloneScene(saved) }));
  }

  async function handleDeleteScene() {
    if (!composer.scene || composer.scene.source !== "user") {
      return;
    }

    await window.lyricVideoApp.deleteScene(composer.scene.id);
    const nextScenes = scenes.filter((scene) => scene.id !== composer.scene?.id);
    setBootstrap((current) => (current ? { ...current, scenes: nextScenes } : current));
    setComposer((current) => ({
      ...current,
      scene: nextScenes[0] ? cloneScene(nextScenes[0]) : null
    }));
  }

  async function handleImportScene() {
    const imported = await window.lyricVideoApp.importScene();
    if (!imported) {
      return;
    }

    setBootstrap((current) =>
      current ? { ...current, scenes: upsertScene(current.scenes, imported) } : current
    );
    setComposer((current) => ({ ...current, scene: cloneScene(imported) }));
  }

  async function handleExportScene() {
    if (composer.scene) {
      await window.lyricVideoApp.exportScene(composer.scene);
    }
  }

  function handleAddComponent() {
    if (!composer.scene || !componentToAddId) {
      return;
    }

    const component = componentCatalog.get(componentToAddId);
    if (!component) {
      return;
    }

    setComposer((current) => ({
      ...current,
      scene: current.scene
        ? {
            ...current.scene,
            components: [...current.scene.components, createSceneComponentInstance(component)]
          }
        : current.scene
    }));
  }

  function updateSceneComponent(
    instanceId: string,
    updater: (component: SceneComponentInstance) => SceneComponentInstance
  ) {
    setComposer((current) => ({
      ...current,
      scene: current.scene
        ? {
            ...current.scene,
            components: current.scene.components.map((component) =>
              component.id === instanceId ? updater(component) : component
            )
          }
        : current.scene
    }));
  }

  function moveSceneComponent(instanceId: string, direction: -1 | 1) {
    setComposer((current) => {
      if (!current.scene) {
        return current;
      }

      const index = current.scene.components.findIndex((component) => component.id === instanceId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.scene.components.length) {
        return current;
      }

      const nextComponents = [...current.scene.components];
      const [component] = nextComponents.splice(index, 1);
      nextComponents.splice(nextIndex, 0, component);

      return {
        ...current,
        scene: { ...current.scene, components: nextComponents }
      };
    });
  }

  function duplicateSceneComponent(instanceId: string) {
    if (!selectedScene) {
      return;
    }

    const component = selectedScene.components.find((entry) => entry.id === instanceId);
    if (!component) {
      return;
    }

    setComposer((current) => ({
      ...current,
      scene: current.scene
        ? {
            ...current.scene,
            components: [
              ...current.scene.components,
              { ...cloneComponent(component), id: createInstanceId(component.componentId) }
            ]
          }
        : current.scene
    }));
  }

  function removeSceneComponent(instanceId: string) {
    setComposer((current) => ({
      ...current,
      scene: current.scene
        ? {
            ...current.scene,
            components: current.scene.components.filter((component) => component.id !== instanceId)
          }
        : current.scene
    }));
  }

  return (
    <div className="app-shell">
      <main className="workspace">
        <SourceFilesPanel composer={composer} onPickPath={(kind) => void handlePickPath(kind)} />

        <VideoSettingsPanel
          video={composer.video}
          selectedVideoSizePresetId={selectedVideoSizePresetId}
          selectedFpsPresetId={selectedFpsPresetId}
          onVideoSizePresetChange={(value) => {
            if (value === "custom") {
              return;
            }

            const preset = VIDEO_SIZE_PRESETS.find((entry) => entry.id === value);
            if (!preset) {
              return;
            }

            setComposer((current) => ({
              ...current,
              video: {
                ...current.video,
                width: preset.width,
                height: preset.height
              }
            }));
          }}
          onFpsPresetChange={(value) => {
            if (value === "custom") {
              return;
            }

            const preset = FPS_PRESETS.find((entry) => entry.id === value);
            if (!preset) {
              return;
            }

            setComposer((current) => ({
              ...current,
              video: { ...current.video, fps: preset.fps }
            }));
          }}
          onWidthChange={(value) =>
            setComposer((current) => ({
              ...current,
              video: { ...current.video, width: value }
            }))
          }
          onHeightChange={(value) =>
            setComposer((current) => ({
              ...current,
              video: { ...current.video, height: value }
            }))
          }
          onFpsChange={(value) =>
            setComposer((current) => ({
              ...current,
              video: { ...current.video, fps: value }
            }))
          }
        />

        <PreviewPanel
          video={composer.video}
          preview={preview}
          enabled={previewEnabled}
          paused={previewPaused}
          onTimeChange={updatePreviewTime}
        />

        <SceneLibraryPanel
          builtInScenes={builtInScenes}
          userScenes={userScenes}
          selectedScene={selectedScene}
          components={components}
          componentCatalog={componentCatalog}
          fonts={bootstrap.fonts}
          expandedCategories={expandedCategories}
          componentToAddId={componentToAddId}
          onComponentToAddIdChange={setComponentToAddId}
          onSceneChange={handleSceneChange}
          onSceneNameChange={(name) =>
            setComposer((current) => ({
              ...current,
              scene: current.scene ? { ...current.scene, name } : current.scene
            }))
          }
          onSceneDescriptionChange={(description) =>
            setComposer((current) => ({
              ...current,
              scene: current.scene ? { ...current.scene, description } : current.scene
            }))
          }
          onImportScene={() => void handleImportScene()}
          onExportScene={() => void handleExportScene()}
          onSaveScene={() => void handleSaveScene()}
          onDeleteScene={() => void handleDeleteScene()}
          onAddComponent={handleAddComponent}
          onToggleComponentEnabled={(instanceId) =>
            updateSceneComponent(instanceId, (current) => ({
              ...current,
              enabled: !current.enabled
            }))
          }
          onMoveComponent={moveSceneComponent}
          onDuplicateComponent={duplicateSceneComponent}
          onRemoveComponent={removeSceneComponent}
          onComponentOptionChange={(instanceId, optionId, value) =>
            updateSceneComponent(instanceId, (current) => ({
              ...current,
              options: { ...current.options, [optionId]: value }
            }))
          }
          onPickComponentImage={(instanceId, optionId) =>
            void handlePickPath("image", instanceId, optionId)
          }
          onToggleCategory={(instanceId, categoryId) =>
            setExpandedCategories((current) => ({
              ...current,
              [getCategoryStateKey(instanceId, categoryId)]:
                !(current[getCategoryStateKey(instanceId, categoryId)] ?? true)
            }))
          }
        />

        <RenderHistoryPanel
          error={error}
          history={history}
          hasActiveRender={hasActiveRender}
          isSubmitting={isSubmitting}
          onSubmit={() => void handleSubmit()}
          onCancelRender={(jobId) => void window.lyricVideoApp.cancelRender(jobId)}
        />
      </main>
    </div>
  );
}
