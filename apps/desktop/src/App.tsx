import React, { useMemo, useState } from "react";
import { getFileName, replaceExtension, stripExtension } from "./lib/path-utils";
import { canStartSubtitleGeneration } from "./lib/subtitle-request";
import { lyricVideoApp } from "./ipc/lyric-video-app";
import { useBootstrap } from "./state/use-bootstrap";
import { useComposer } from "./state/use-composer";
import { useLayoutResize } from "./state/use-layout-resize";
import { useRenderJob } from "./state/use-render-job";
import { useSubtitleGeneration } from "./state/use-subtitle-generation";
import { useWorkspaceSelection } from "./state/use-workspace-selection";
import { ComponentDetailsEditor } from "./features/component-editor/component-details-editor";
import { GeneralDetailsEditor } from "./features/project-setup/general-details-editor";
import { PreviewPanel } from "./features/preview/preview-panel";
import { RenderProgressDialog } from "./features/render-progress/render-progress-dialog";
import { SceneDetailsEditor } from "./features/scene-editor/scene-details-editor";
import { SubtitleGenerationDialog } from "./features/subtitle-generation/subtitle-generation-dialog";
import { WorkspaceNavPanel } from "./features/workspace-nav/workspace-nav-panel";
import { FPS_PRESETS, VIDEO_SIZE_PRESETS } from "./lib/video-presets";
import type { FilePickKind } from "./electron-api";
import { isComponentSelection } from "./state/workspace-types";

export function App() {
  const [error, setError] = useState("");
  const [componentToAddId, setComponentToAddId] = useState("");
  const { bootstrap, setBootstrap } = useBootstrap((data) => {
    if (data.scenes[0]) {
      composer.setComposer((current) => ({
        ...current,
        scene: structuredClone(data.scenes[0])
      }));
    }
    if (data.components[0]) {
      setComponentToAddId(data.components[0].id);
    }
  });
  const { selection, setSelection } = useWorkspaceSelection();
  const composer = useComposer(setBootstrap, setSelection);
  const renderJob = useRenderJob(setError);
  const subtitleGeneration = useSubtitleGeneration(composer.setComposer, setError);
  const {
    generalPaneWidth,
    sidebarWidth,
    inspectorHeight,
    isLayoutReady,
    activeResizeHandle,
    workspaceRef,
    mainPaneRef,
    startResize
  } = useLayoutResize({
    bootstrapLoaded: bootstrap !== null,
    initialPaneLayout: bootstrap?.layoutPreferences?.panes
  });

  const scenes = bootstrap?.scenes ?? [];
  const components = bootstrap?.components ?? [];
  const selectedScene = composer.composer.scene;
  const componentCatalog = useMemo(
    () => new Map(components.map((component) => [component.id, component])),
    [components]
  );
  const builtInScenes = useMemo(
    () => scenes.filter((scene) => scene.source === "built-in"),
    [scenes]
  );
  const pluginScenes = useMemo(
    () => scenes.filter((scene) => scene.source === "plugin"),
    [scenes]
  );
  const userScenes = useMemo(() => scenes.filter((scene) => scene.source === "user"), [scenes]);
  const selectedVideoSizePresetId =
    VIDEO_SIZE_PRESETS.find(
      (preset) =>
        preset.width === composer.composer.video.width &&
        preset.height === composer.composer.video.height
    )?.id ?? "custom";
  const selectedFpsPresetId =
    FPS_PRESETS.find((preset) => preset.fps === composer.composer.video.fps)?.id ?? "custom";
  const selectedComponent =
    selectedScene && isComponentSelection(selection)
      ? selectedScene.components.find((component) => component.id === selection.instanceId) ?? null
      : null;
  const selectedComponentDefinition = selectedComponent
    ? componentCatalog.get(selectedComponent.componentId) ?? null
    : null;

  if (!bootstrap || !selectedScene || !isLayoutReady) {
    return <div className="app-shell loading">Loading composer...</div>;
  }

  const loadedBootstrap = bootstrap;
  const loadedSelectedScene = selectedScene;

  async function handlePickPath(kind: FilePickKind, instanceId?: string, optionId?: string) {
    const outputExtension = composer.composer.render.encoding === "webm" ? "webm" : "mp4";
    const suggestedName =
      kind === "output" && composer.composer.audioPath
        ? `${stripExtension(getFileName(composer.composer.audioPath))}.${outputExtension}`
        : undefined;
    const result = await lyricVideoApp.pickPath(
      kind,
      suggestedName,
      kind === "output" ? composer.composer.render.encoding : undefined
    );
    if (!result) {
      return;
    }

    setError("");

    if (kind === "audio") {
      composer.setAudioPath(result);
      return;
    }
    if (kind === "subtitle") {
      composer.setSubtitlePath(result);
      return;
    }
    if (kind === "lyrics-text") {
      subtitleGeneration.setRequest((current) => ({ ...current, lyricsTextPath: result }));
      return;
    }
    if (kind === "output") {
      composer.setOutputPath(result);
      return;
    }
    if (instanceId && optionId) {
      composer.updateComponent(instanceId, (current) => ({
        ...current,
        options: { ...current.options, [optionId]: result }
      }));
    }
  }

  function handleRenderEncodingChange(encoding: typeof composer.composer.render.encoding) {
    composer.setRenderEncoding(encoding);
    composer.setComposer((current) => {
      if (!current.outputPath) {
        return current;
      }
      const extension = encoding === "webm" ? "webm" : "mp4";
      return {
        ...current,
        outputPath: replaceExtension(current.outputPath, extension)
      };
    });
  }

  async function handleSetupFfmpeg() {
    const result = await lyricVideoApp.setupFfmpeg();
    if (result.available) {
      window.location.reload();
    }
  }

  function handleAddComponent() {
    if (!componentToAddId) {
      return;
    }
    const component = componentCatalog.get(componentToAddId);
    if (component) {
      composer.addComponent(component);
    }
  }

  async function handleImportPlugin(url: string) {
    const nextBootstrap = await lyricVideoApp.importPlugin(url);
    setBootstrap(nextBootstrap);
    if (nextBootstrap.components[0]) {
      setComponentToAddId((current) =>
        nextBootstrap.components.some((component) => component.id === current)
          ? current
          : nextBootstrap.components[0].id
      );
    }
  }

  async function handleUpdatePlugin(pluginId: string) {
    const nextBootstrap = await lyricVideoApp.updatePlugin(pluginId);
    setBootstrap(nextBootstrap);
    const selectedSceneStillExists = nextBootstrap.scenes.some(
      (scene) => scene.id === composer.composer.scene?.id
    );
    if (!selectedSceneStillExists && nextBootstrap.scenes[0]) {
      composer.selectScene(nextBootstrap.scenes, nextBootstrap.scenes[0].id);
    }
    setComponentToAddId((current) =>
      nextBootstrap.components.some((component) => component.id === current)
        ? current
        : nextBootstrap.components[0]?.id ?? ""
    );
  }

  async function handleRemovePlugin(pluginId: string) {
    const nextBootstrap = await lyricVideoApp.removePlugin(pluginId);
    setBootstrap(nextBootstrap);
    const selectedSceneStillExists = nextBootstrap.scenes.some(
      (scene) => scene.id === composer.composer.scene?.id
    );
    if (!selectedSceneStillExists && nextBootstrap.scenes[0]) {
      composer.selectScene(nextBootstrap.scenes, nextBootstrap.scenes[0].id);
    }
    setComponentToAddId((current) =>
      nextBootstrap.components.some((component) => component.id === current)
        ? current
        : nextBootstrap.components[0]?.id ?? ""
    );
  }

  function renderInspector() {
    if (selection.type === "scene") {
      return (
        <SceneDetailsEditor
          builtInScenes={builtInScenes}
          pluginScenes={pluginScenes}
          userScenes={userScenes}
          plugins={loadedBootstrap.plugins}
          selectedScene={loadedSelectedScene}
          components={components}
          componentCatalog={componentCatalog}
          onSceneChange={(sceneId) => composer.selectScene(scenes, sceneId)}
          onMergeSceneComponents={(sceneId) => composer.mergeSceneComponents(scenes, sceneId)}
          onSceneNameChange={composer.setSceneName}
          onSceneDescriptionChange={composer.setSceneDescription}
          onImportScene={() => void composer.importScene()}
          onImportPlugin={(url) => void handleImportPlugin(url)}
          onUpdatePlugin={(pluginId) => void handleUpdatePlugin(pluginId)}
          onRemovePlugin={(pluginId) => void handleRemovePlugin(pluginId)}
          onExportScene={() => void composer.exportScene()}
          onSaveScene={() => void composer.saveScene()}
          onSaveSceneAsNew={() => void composer.saveSceneAsNew()}
          onDeleteScene={() => void composer.deleteScene(scenes)}
        />
      );
    }

    if (selectedComponent && selectedComponentDefinition) {
      return (
        <ComponentDetailsEditor
          component={selectedComponentDefinition}
          instance={selectedComponent}
          fonts={loadedBootstrap.fonts}
          onOptionChange={(optionId, value) =>
            composer.updateComponent(selectedComponent.id, (current) => ({
              ...current,
              options: { ...current.options, [optionId]: value }
            }))
          }
          onPickFile={(optionId, kind) => void handlePickPath(kind, selectedComponent.id, optionId)}
        />
      );
    }

    return null;
  }

  return (
    <div className={`app-shell${activeResizeHandle ? ` is-resizing-${activeResizeHandle}` : ""}`}>
      <main className="workspace-shell" ref={workspaceRef}>
        <aside className="workspace-pane workspace-general-pane" style={{ width: generalPaneWidth }}>
          <GeneralDetailsEditor
            composer={composer.composer}
            selectedVideoSizePresetId={selectedVideoSizePresetId}
            selectedFpsPresetId={selectedFpsPresetId}
            eyebrow="Workspace"
            className="workspace-general-panel"
            error={error}
            isSubmitting={renderJob.isSubmitting}
            hasActiveRender={renderJob.hasActiveRender}
            ffmpegAvailable={loadedBootstrap.ffmpegAvailable}
            onPickPath={(kind) => void handlePickPath(kind)}
            onOpenSubtitleGenerator={() => subtitleGeneration.open(composer.composer.audioPath)}
            onSetupFfmpeg={() => void handleSetupFfmpeg()}
            onVideoSizePresetChange={composer.applyVideoSizePresetId}
            onFpsPresetChange={composer.applyFpsPresetId}
            onWidthChange={composer.setVideoWidth}
            onHeightChange={composer.setVideoHeight}
            onFpsChange={composer.setVideoFps}
            onRenderThreadsChange={composer.setRenderThreads}
            onRenderEncodingChange={handleRenderEncodingChange}
            onRenderQualityChange={composer.setRenderQuality}
            onSubmit={() => void renderJob.submit(composer.composer)}
          />
        </aside>

        <div
          className="workspace-splitter workspace-splitter-vertical"
          role="separator"
          aria-label="Resize general panel"
          aria-orientation="vertical"
          onMouseDown={(event) => startResize("general", event)}
        />

        <aside className="workspace-pane workspace-sidebar-pane" style={{ width: sidebarWidth }}>
          <WorkspaceNavPanel
            selectedScene={selectedScene}
            selection={selection}
            componentCatalog={componentCatalog}
            componentToAddId={componentToAddId}
            onSelectScene={() => setSelection({ type: "scene" })}
            onSelectComponent={(instanceId) => setSelection({ type: "component", instanceId })}
            onComponentToAddIdChange={setComponentToAddId}
            onAddComponent={handleAddComponent}
            onToggleComponentEnabled={(instanceId) =>
              composer.updateComponent(instanceId, (current) => ({
                ...current,
                enabled: !current.enabled
              }))
            }
            onMoveComponent={composer.moveComponent}
            onDuplicateComponent={composer.duplicateComponent}
            onRemoveComponent={composer.removeComponent}
          />
        </aside>

        <div
          className="workspace-splitter workspace-splitter-vertical"
          role="separator"
          aria-label="Resize navigation panel"
          aria-orientation="vertical"
          onMouseDown={(event) => startResize("sidebar", event)}
        />

        <section className="workspace-main-pane" ref={mainPaneRef}>
          <div className="workspace-pane workspace-preview-pane">
            <PreviewPanel
              composer={composer.composer}
              paused={renderJob.hasActiveRender}
              profilerEnabled={bootstrap.previewProfilerEnabled}
              ffmpegAvailable={bootstrap.ffmpegAvailable}
            />
          </div>

          <div
            className="workspace-splitter workspace-splitter-horizontal"
            role="separator"
            aria-label="Resize inspector panel"
            aria-orientation="horizontal"
            onMouseDown={(event) => startResize("inspector", event)}
          />

          <div className="workspace-pane workspace-inspector-pane" style={{ height: inspectorHeight }}>
            {renderInspector()}
          </div>
        </section>
      </main>

      <RenderProgressDialog
        entry={renderJob.dialogEntry}
        isOpen={renderJob.isDialogOpen}
        onCancelRender={(jobId) => void renderJob.cancel(jobId)}
        onDismiss={renderJob.dismiss}
      />
      <SubtitleGenerationDialog
        isOpen={subtitleGeneration.isDialogOpen}
        request={subtitleGeneration.request}
        progress={subtitleGeneration.progress}
        canStart={canStartSubtitleGeneration(composer.composer.audioPath, subtitleGeneration.request)}
        isGenerating={subtitleGeneration.isGenerating}
        onRequestChange={subtitleGeneration.setRequest}
        onPickLyricsText={() => void handlePickPath("lyrics-text")}
        onStart={() => void subtitleGeneration.start(composer.composer.audioPath)}
        onCancel={() => void subtitleGeneration.cancel()}
        onDismiss={subtitleGeneration.dismiss}
      />
    </div>
  );
}
