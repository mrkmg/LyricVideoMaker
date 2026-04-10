import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  RenderHistoryEntry,
  SceneComponentInstance
} from "@lyric-video-maker/core";
import {
  cloneComponent,
  cloneScene,
  createInstanceId,
  createSceneComponentInstance,
  emptyComposerState,
  FPS_PRESETS,
  getFileName,
  stripExtension,
  upsertScene,
  VIDEO_SIZE_PRESETS
} from "./app-utils";
import { ComponentDetailsEditor } from "./components/component-details-editor";
import { GeneralDetailsEditor } from "./components/general-details-editor";
import { PreviewPanel } from "./components/preview-panel";
import { RenderProgressDialog } from "./components/render-progress-dialog";
import { SceneDetailsEditor } from "./components/scene-details-editor";
import { WorkspaceNavPanel } from "./components/workspace-nav-panel";
import type { ComposerState } from "./composer-types";
import type { AppBootstrapData, FilePickKind } from "./electron-api";
import type { WorkspaceSelection } from "./workspace-types";
import { isComponentSelection } from "./workspace-types";

const ACTIVE_RENDER_STATUSES = new Set(["queued", "preparing", "rendering", "muxing"]);
const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_GUTTER = 540;
const INSPECTOR_MIN_HEIGHT = 250;
const INSPECTOR_MAX_GUTTER = 240;

export function App() {
  const [bootstrap, setBootstrap] = useState<AppBootstrapData | null>(null);
  const [composer, setComposer] = useState<ComposerState>(emptyComposerState);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [componentToAddId, setComponentToAddId] = useState("");
  const [selection, setSelection] = useState<WorkspaceSelection>({ type: "scene" });
  const [renderDialogEntry, setRenderDialogEntry] = useState<RenderHistoryEntry | null>(null);
  const [isRenderDialogOpen, setIsRenderDialogOpen] = useState(false);
  const [generalPaneWidth, setGeneralPaneWidth] = useState(360);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [inspectorHeight, setInspectorHeight] = useState(300);
  const [activeResizeHandle, setActiveResizeHandle] = useState<
    "general" | "sidebar" | "inspector" | null
  >(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const mainPaneRef = useRef<HTMLElement | null>(null);
  const resizeStateRef = useRef<
    | {
        handle: "general" | "sidebar" | "inspector";
        startX: number;
        startY: number;
        startGeneralWidth: number;
        startWidth: number;
        startHeight: number;
      }
    | null
  >(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    void window.lyricVideoApp.getBootstrapData().then((data) => {
      setBootstrap(data);

      if (data.scenes[0]) {
        setComposer((current) => ({ ...current, scene: cloneScene(data.scenes[0]) }));
      }
      if (data.components[0]) {
        setComponentToAddId(data.components[0].id);
      }
    });

    unsubscribe = window.lyricVideoApp.onRenderProgress((event) => {
      setRenderDialogEntry((current) => mergeRenderEntry(current, event));
      setIsRenderDialogOpen(true);
      setIsSubmitting(false);
    });

    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    function handlePointerMove(event: MouseEvent) {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      if (resizeState.handle === "general" || resizeState.handle === "sidebar") {
        const containerWidth = workspaceRef.current?.clientWidth ?? window.innerWidth;
        const reservedWidth =
          resizeState.handle === "general" ? sidebarWidth : resizeState.startGeneralWidth;
        const maxWidth = Math.max(SIDEBAR_MIN_WIDTH, containerWidth - reservedWidth - SIDEBAR_MAX_GUTTER);
        const nextWidth = clamp(
          resizeState.startWidth + event.clientX - resizeState.startX,
          SIDEBAR_MIN_WIDTH,
          maxWidth
        );

        if (resizeState.handle === "general") {
          setGeneralPaneWidth(nextWidth);
          return;
        }

        setSidebarWidth(
          clamp(
            nextWidth,
            SIDEBAR_MIN_WIDTH,
            maxWidth
          )
        );
        return;
      }

      const containerHeight = mainPaneRef.current?.clientHeight ?? window.innerHeight;
      const maxHeight = Math.max(INSPECTOR_MIN_HEIGHT, containerHeight - INSPECTOR_MAX_GUTTER);
      setInspectorHeight(
        clamp(
          resizeState.startHeight - (event.clientY - resizeState.startY),
          INSPECTOR_MIN_HEIGHT,
          maxHeight
        )
      );
    }

    function stopResize() {
      resizeStateRef.current = null;
      setActiveResizeHandle(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", stopResize);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
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
  const hasActiveRender =
    isSubmitting ||
    (renderDialogEntry ? ACTIVE_RENDER_STATUSES.has(renderDialogEntry.status) : false);
  const previewPaused = hasActiveRender;
  const selectedVideoSizePresetId =
    VIDEO_SIZE_PRESETS.find(
      (preset) => preset.width === composer.video.width && preset.height === composer.video.height
    )?.id ?? "custom";
  const selectedFpsPresetId =
    FPS_PRESETS.find((preset) => preset.fps === composer.video.fps)?.id ?? "custom";
  const selectedComponent =
    selectedScene && isComponentSelection(selection)
      ? selectedScene.components.find((component) => component.id === selection.instanceId) ?? null
      : null;
  const selectedComponentDefinition = selectedComponent
    ? componentCatalog.get(selectedComponent.componentId) ?? null
    : null;
  const selectedComponentIndex = selectedComponent
    ? selectedScene?.components.findIndex((component) => component.id === selectedComponent.id) ?? -1
    : -1;

  useEffect(() => {
    if (!selectedScene || !isComponentSelection(selection)) {
      return;
    }

    const stillExists = selectedScene.components.some(
      (component) => component.id === selection.instanceId
    );

    if (!stillExists) {
      setSelection({ type: "scene" });
    }
  }, [selection, selectedScene]);

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
    setIsRenderDialogOpen(true);
    await window.lyricVideoApp.disposePreview();

    try {
      const entry = await window.lyricVideoApp.startRender({
        audioPath: composer.audioPath,
        subtitlePath: composer.subtitlePath,
        outputPath: composer.outputPath,
        scene: composer.scene,
        video: composer.video
      });
      setRenderDialogEntry(entry);
      setIsSubmitting(false);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : String(submissionError));
      setIsSubmitting(false);
      setIsRenderDialogOpen(false);
    }
  }

  function handleSceneChange(sceneId: string) {
    const nextScene = scenes.find((scene) => scene.id === sceneId);
    if (!nextScene) {
      return;
    }

    setComposer((current) => ({ ...current, scene: cloneScene(nextScene) }));
    setSelection({ type: "scene" });
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
    setSelection({ type: "scene" });
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
    setSelection({ type: "scene" });
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

    const nextInstance = createSceneComponentInstance(component);
    setComposer((current) => ({
      ...current,
      scene: current.scene
        ? {
            ...current.scene,
            components: [...current.scene.components, nextInstance]
          }
        : current.scene
    }));
    setSelection({ type: "component", instanceId: nextInstance.id });
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

    const duplicated = { ...cloneComponent(component), id: createInstanceId(component.componentId) };
    setComposer((current) => ({
      ...current,
      scene: current.scene
        ? {
            ...current.scene,
            components: [...current.scene.components, duplicated]
          }
        : current.scene
    }));
    setSelection({ type: "component", instanceId: duplicated.id });
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

    setSelection((current) =>
      current.type === "component" && current.instanceId === instanceId
        ? { type: "scene" }
        : current
    );
  }

  function renderInspector() {
    if (selection.type === "scene") {
      return (
        <SceneDetailsEditor
          builtInScenes={builtInScenes}
          userScenes={userScenes}
          selectedScene={selectedScene!}
          components={components}
          componentCatalog={componentCatalog}
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
        />
      );
    }

    if (selectedComponent && selectedComponentDefinition && selectedComponentIndex >= 0) {
      return (
        <ComponentDetailsEditor
          component={selectedComponentDefinition}
          instance={selectedComponent}
          fonts={bootstrap!.fonts}
          onOptionChange={(optionId, value) =>
            updateSceneComponent(selectedComponent.id, (current) => ({
              ...current,
              options: { ...current.options, [optionId]: value }
            }))
          }
          onPickImage={(optionId) => void handlePickPath("image", selectedComponent.id, optionId)}
        />
      );
    }

    return null;
  }

  function startResize(
    handle: "general" | "sidebar" | "inspector",
    event: React.MouseEvent<HTMLDivElement>
  ) {
    resizeStateRef.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startGeneralWidth: generalPaneWidth,
      startWidth: handle === "general" ? generalPaneWidth : sidebarWidth,
      startHeight: inspectorHeight
    };
    setActiveResizeHandle(handle);
    document.body.style.cursor = handle === "inspector" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <div className={`app-shell${activeResizeHandle ? ` is-resizing-${activeResizeHandle}` : ""}`}>
      <main className="workspace-shell" ref={workspaceRef}>
        <aside className="workspace-pane workspace-general-pane" style={{ width: generalPaneWidth }}>
          <GeneralDetailsEditor
            composer={composer}
            selectedVideoSizePresetId={selectedVideoSizePresetId}
            selectedFpsPresetId={selectedFpsPresetId}
            eyebrow="Workspace"
            className="workspace-general-panel"
            error={error}
            isSubmitting={isSubmitting}
            hasActiveRender={hasActiveRender}
            onPickPath={(kind) => void handlePickPath(kind)}
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
            onSubmit={() => void handleSubmit()}
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
              updateSceneComponent(instanceId, (current) => ({
                ...current,
                enabled: !current.enabled
              }))
            }
            onMoveComponent={moveSceneComponent}
            onDuplicateComponent={duplicateSceneComponent}
            onRemoveComponent={removeSceneComponent}
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
            <PreviewPanel composer={composer} paused={previewPaused} />
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
        entry={renderDialogEntry}
        isOpen={isRenderDialogOpen}
        onCancelRender={(jobId) => void window.lyricVideoApp.cancelRender(jobId)}
        onDismiss={() => {
          setIsRenderDialogOpen(false);
          setRenderDialogEntry(null);
        }}
      />
    </div>
  );
}

function mergeRenderEntry(
  current: RenderHistoryEntry | null,
  event: {
    jobId: string;
    status: RenderHistoryEntry["status"];
    progress: number;
    message: string;
    etaMs?: number;
    renderFps?: number;
    outputPath?: string;
    error?: string;
  }
) {
  if (!current || current.id !== event.jobId) {
    return current;
  }

  return {
    ...current,
    outputPath: event.outputPath ?? current.outputPath,
    status: Number.isFinite(event.progress) ? event.status : current.status,
    progress: Number.isFinite(event.progress) ? event.progress : current.progress,
    message: event.message,
    etaMs: Number.isFinite(event.progress) ? event.etaMs : current.etaMs,
    renderFps: Number.isFinite(event.progress) ? event.renderFps : current.renderFps,
    error: event.error ?? current.error
  } satisfies RenderHistoryEntry;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
