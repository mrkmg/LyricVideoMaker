import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  RenderHistoryEntry,
  RenderProgressEvent,
  SceneComponentInstance,
  SceneOptionCategory,
  SceneOptionField,
  SerializedSceneComponentDefinition,
  SerializedSceneDefinition,
  VideoSettings
} from "@lyric-video-maker/core";
import {
  DEFAULT_VIDEO_FPS,
  DEFAULT_VIDEO_HEIGHT,
  DEFAULT_VIDEO_WIDTH,
  isSceneOptionCategory
} from "@lyric-video-maker/core";
import type { AppBootstrapData } from "./electron-api";

interface ComposerState {
  audioPath: string;
  subtitlePath: string;
  outputPath: string;
  scene: SerializedSceneDefinition | null;
  video: Pick<VideoSettings, "width" | "height" | "fps">;
}

interface VideoSizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

interface FpsPreset {
  id: string;
  label: string;
  fps: number;
}

const VIDEO_SIZE_PRESETS: VideoSizePreset[] = [
  { id: "4k", label: "4K (3840x2160)", width: 3840, height: 2160 },
  { id: "2k", label: "2K (2560x1440)", width: 2560, height: 1440 },
  { id: "1080", label: "1080p (1920x1080)", width: 1920, height: 1080 },
  { id: "720", label: "720p (1280x720)", width: 1280, height: 720 },
  { id: "1024-square", label: "1024 Square (1024x1024)", width: 1024, height: 1024 }
];

const FPS_PRESETS: FpsPreset[] = [
  { id: "15", label: "15 fps", fps: 15 },
  { id: "20", label: "20 fps", fps: 20 },
  { id: "30", label: "30 fps", fps: 30 },
  { id: "60", label: "60 fps", fps: 60 }
];

const emptyState: ComposerState = {
  audioPath: "",
  subtitlePath: "",
  outputPath: "",
  scene: null,
  video: {
    width: DEFAULT_VIDEO_WIDTH,
    height: DEFAULT_VIDEO_HEIGHT,
    fps: DEFAULT_VIDEO_FPS
  }
};

export function App() {
  const [bootstrap, setBootstrap] = useState<AppBootstrapData | null>(null);
  const [composer, setComposer] = useState<ComposerState>(emptyState);
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
  const selectedVideoSizePresetId =
    VIDEO_SIZE_PRESETS.find(
      (preset) =>
        preset.width === composer.video.width && preset.height === composer.video.height
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

  async function handlePickPath(
    kind: "audio" | "subtitle" | "image" | "output",
    instanceId?: string,
    optionId?: string
  ) {
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
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Import</p>
              <h2>Source files</h2>
            </div>
            <button className="secondary" onClick={() => handlePickPath("output")}>
              Choose output
            </button>
          </div>

          <div className="field-grid">
            <FileField label="Song audio" value={composer.audioPath} buttonLabel="Pick MP3" onPick={() => handlePickPath("audio")} />
            <FileField label="Lyric subtitles" value={composer.subtitlePath} buttonLabel="Pick SRT" onPick={() => handlePickPath("subtitle")} />
            <FileField label="Output MP4" value={composer.outputPath} buttonLabel="Save As" onPick={() => handlePickPath("output")} />
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Video</p>
              <h2>Video parameters</h2>
            </div>
          </div>

          <div className="video-param-grid">
            <SelectField
              label="Size preset"
              value={selectedVideoSizePresetId}
              options={[
                { value: "custom", label: "Custom" },
                ...VIDEO_SIZE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))
              ]}
              onChange={(value) => {
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
            />
            <SelectField
              label="FPS preset"
              value={selectedFpsPresetId}
              options={[
                { value: "custom", label: "Custom" },
                ...FPS_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))
              ]}
              onChange={(value) => {
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
            />
            <NumberField label="Width" value={composer.video.width} min={16} step={1} onChange={(value) => setComposer((current) => ({ ...current, video: { ...current.video, width: value } }))} />
            <NumberField label="Height" value={composer.video.height} min={16} step={1} onChange={(value) => setComposer((current) => ({ ...current, video: { ...current.video, height: value } }))} />
            <NumberField label="Frame rate" value={composer.video.fps} min={1} step={1} onChange={(value) => setComposer((current) => ({ ...current, video: { ...current.video, fps: value } }))} />
          </div>

          <p className="video-param-hint">
            Default render target is {DEFAULT_VIDEO_WIDTH}x{DEFAULT_VIDEO_HEIGHT} at {DEFAULT_VIDEO_FPS} fps.
          </p>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Scene Library</p>
              <h2>Scene stacks</h2>
            </div>
            <div className="button-row">
              <button className="secondary" onClick={handleImportScene}>Import JSON</button>
              <button className="secondary" onClick={handleExportScene}>Export JSON</button>
              <button className="secondary" onClick={handleSaveScene}>
                {selectedScene.source === "user" ? "Save Scene" : "Save as User Scene"}
              </button>
              {selectedScene.source === "user" ? (
                <button className="secondary danger" onClick={handleDeleteScene}>Delete Scene</button>
              ) : null}
            </div>
          </div>

          <div className="scene-library-grid">
            <label className="field">
              <span>Scene preset</span>
              <select value={selectedScene.id} onChange={(event) => handleSceneChange(event.target.value)}>
                <optgroup label="Built-in">
                  {builtInScenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
                </optgroup>
                {userScenes.length > 0 ? (
                  <optgroup label="User Scenes">
                    {userScenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
                  </optgroup>
                ) : null}
              </select>
            </label>

            <label className="field">
              <span>Scene name</span>
              <input value={selectedScene.name} onChange={(event) => setComposer((current) => ({ ...current, scene: current.scene ? { ...current.scene, name: event.target.value } : current.scene }))} />
            </label>
          </div>

          <label className="field">
            <span>Description</span>
            <textarea value={selectedScene.description ?? ""} onChange={(event) => setComposer((current) => ({ ...current, scene: current.scene ? { ...current.scene, description: event.target.value } : current.scene }))} />
          </label>

          <p className="scene-description">
            {selectedScene.source === "built-in"
              ? "Built-in template. Editing is local until you save a user-owned copy."
              : "User scene stored locally and reusable across renders."}
          </p>

          <div className="component-toolbar">
            <label className="field">
              <span>Add component</span>
              <select value={componentToAddId} onChange={(event) => setComponentToAddId(event.target.value)}>
                {components.map((component) => <option key={component.id} value={component.id}>{component.name}</option>)}
              </select>
            </label>
            <button className="primary" onClick={handleAddComponent}>Add to stack</button>
          </div>

          <div className="component-stack">
            {selectedScene.components.length === 0 ? (
              <div className="history-empty">No components in this scene.</div>
            ) : (
              selectedScene.components.map((instance, index) => {
                const component = componentCatalog.get(instance.componentId);
                if (!component) {
                  return null;
                }

                const topLevelOptions = component.options.filter(
                  (option): option is SceneOptionField => !isSceneOptionCategory(option)
                );
                const categorizedOptions = component.options.filter(isSceneOptionCategory);

                return (
                  <section key={instance.id} className="component-card">
                    <div className="component-card-header">
                      <div>
                        <p className="eyebrow">Layer {index + 1}</p>
                        <h3>{component.name}</h3>
                        {component.description ? <p className="scene-description">{component.description}</p> : null}
                      </div>
                      <div className="button-row">
                        <button className="secondary" onClick={() => updateSceneComponent(instance.id, (current) => ({ ...current, enabled: !current.enabled }))}>
                          {instance.enabled ? "Disable" : "Enable"}
                        </button>
                        <button className="secondary" onClick={() => moveSceneComponent(instance.id, -1)}>Move Up</button>
                        <button className="secondary" onClick={() => moveSceneComponent(instance.id, 1)}>Move Down</button>
                        <button className="secondary" onClick={() => duplicateSceneComponent(instance.id)}>Duplicate</button>
                        <button className="secondary danger" onClick={() => removeSceneComponent(instance.id)}>Remove</button>
                      </div>
                    </div>

                    {topLevelOptions.length > 0 ? (
                      <div className="option-list top-level-options">
                        {topLevelOptions.map((field) => (
                          <OptionField
                            key={field.id}
                            field={field}
                            inputPrefix={instance.id}
                            value={instance.options[field.id]}
                            fonts={bootstrap.fonts}
                            onChange={(value) => updateSceneComponent(instance.id, (current) => ({ ...current, options: { ...current.options, [field.id]: value } }))}
                            onPickImage={() => handlePickPath("image", instance.id, field.id)}
                          />
                        ))}
                      </div>
                    ) : null}

                    {categorizedOptions.map((category) => (
                      <OptionCategorySection
                        key={category.id}
                        category={category}
                        isExpanded={expandedCategories[getCategoryStateKey(instance.id, category.id)] ?? category.defaultExpanded ?? true}
                        onToggle={() => setExpandedCategories((current) => ({ ...current, [getCategoryStateKey(instance.id, category.id)]: !(current[getCategoryStateKey(instance.id, category.id)] ?? category.defaultExpanded ?? true) }))}
                      >
                        {category.options.map((field) => (
                          <OptionField
                            key={field.id}
                            field={field}
                            inputPrefix={instance.id}
                            value={instance.options[field.id]}
                            fonts={bootstrap.fonts}
                            onChange={(value) => updateSceneComponent(instance.id, (current) => ({ ...current, options: { ...current.options, [field.id]: value } }))}
                            onPickImage={() => handlePickPath("image", instance.id, field.id)}
                          />
                        ))}
                      </OptionCategorySection>
                    ))}
                  </section>
                );
              })
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Render</p>
              <h2>Job control</h2>
            </div>
            <button className="primary" disabled={isSubmitting || hasActiveRender} onClick={handleSubmit}>
              {isSubmitting || hasActiveRender ? "Rendering..." : "Render MP4"}
            </button>
          </div>

          {error ? <p className="error-banner">{error}</p> : null}

          <ul className="history-list">
            {history.length === 0 ? (
              <li className="history-empty">No renders yet.</li>
            ) : (
              history.map((entry) => {
                const active = ["queued", "preparing", "rendering", "muxing"].includes(entry.status);

                return (
                  <li key={entry.id} className="history-item">
                    <div className="history-meta">
                      <div>
                        <strong>{entry.sceneName}</strong>
                        <p>{getFileName(entry.outputPath)}</p>
                      </div>
                      <span className={`status status-${entry.status}`}>{entry.status}</span>
                    </div>
                    <p className="history-message">{entry.message}</p>
                    <div className="progress-track">
                      <div className="progress-value" style={{ width: `${Math.max(0, Math.min(100, entry.progress))}%` }} />
                    </div>
                    {entry.status === "rendering" ? (
                      <div className="history-stats">
                        <span>{entry.renderFps ? `${entry.renderFps.toFixed(2)} fps` : "Measuring speed..."}</span>
                        <span>{entry.etaMs !== undefined ? `ETA ${formatEta(entry.etaMs)}` : "ETA calculating..."}</span>
                      </div>
                    ) : null}
                    <div className="history-footer">
                      <span>{new Date(entry.createdAt).toLocaleString()}</span>
                      {active ? <button className="secondary danger" onClick={() => window.lyricVideoApp.cancelRender(entry.id)}>Cancel</button> : null}
                    </div>
                    {entry.error ? <p className="history-error">{entry.error}</p> : null}
                    {entry.logs && entry.logs.length > 0 ? (
                      <details className="history-logs">
                        <summary>Logs ({entry.logs.length})</summary>
                        <div className="history-log-list">
                          {entry.logs.map((log, index) => (
                            <div key={`${log.timestamp}-${index}`} className={`history-log history-log-${log.level}`}>
                              <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                              <strong>{log.level}</strong>
                              <p>{log.message}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}

function OptionCategorySection({
  category,
  isExpanded,
  onToggle,
  children
}: {
  category: SceneOptionCategory;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="option-category">
      <button type="button" className="option-category-toggle" onClick={onToggle}>
        <span>{category.label}</span>
        <span className="option-category-chevron">{isExpanded ? "−" : "+"}</span>
      </button>
      {isExpanded ? <div className="option-list">{children}</div> : null}
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" min={min} max={max} step={step ?? 1} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FileField({
  label,
  value,
  buttonLabel,
  onPick
}: {
  label: string;
  value: string;
  buttonLabel: string;
  onPick: () => void;
}) {
  return (
    <div className="field file-field">
      <span>{label}</span>
      <div className="file-pill">{value || "Not selected"}</div>
      <button className="secondary" onClick={onPick}>{buttonLabel}</button>
    </div>
  );
}

function OptionField({
  field,
  inputPrefix,
  value,
  fonts,
  onChange,
  onPickImage
}: {
  field: SceneOptionField;
  inputPrefix: string;
  value: unknown;
  fonts: string[];
  onChange: (value: unknown) => void;
  onPickImage: () => void;
}) {
  const inputId = `${inputPrefix}-${field.id}`;

  switch (field.type) {
    case "boolean":
      return (
        <div className="option-row">
          <label className="option-label" htmlFor={inputId}>{field.label}</label>
          <div className="option-input checkbox-input">
            <input id={inputId} type="checkbox" checked={Boolean(value ?? field.defaultValue ?? false)} onChange={(event) => onChange(event.target.checked)} />
          </div>
        </div>
      );
    case "number":
      return (
        <div className="option-row">
          <label className="option-label" htmlFor={inputId}>{field.label}</label>
          <div className="option-input">
            <input id={inputId} type="number" min={field.min} max={field.max} step={field.step ?? 1} value={typeof value === "number" ? value : field.defaultValue ?? 0} onChange={(event) => onChange(Number(event.target.value))} />
          </div>
        </div>
      );
    case "text":
      return (
        <div className="option-row option-row-multiline">
          <label className="option-label" htmlFor={inputId}>{field.label}</label>
          <div className="option-input">
            {field.multiline ? (
              <textarea id={inputId} value={String(value ?? field.defaultValue ?? "")} onChange={(event) => onChange(event.target.value)} />
            ) : (
              <input id={inputId} value={String(value ?? field.defaultValue ?? "")} onChange={(event) => onChange(event.target.value)} />
            )}
          </div>
        </div>
      );
    case "color":
      return (
        <div className="option-row">
          <label className="option-label" htmlFor={inputId}>{field.label}</label>
          <div className="option-input">
            <input id={inputId} type="color" value={String(value ?? field.defaultValue ?? "#ffffff")} onChange={(event) => onChange(event.target.value)} />
          </div>
        </div>
      );
    case "font":
      return (
        <div className="option-row">
          <label className="option-label" htmlFor={inputId}>{field.label}</label>
          <div className="option-input">
            <select id={inputId} value={String(value ?? field.defaultValue ?? fonts[0])} onChange={(event) => onChange(event.target.value)}>
              {fonts.map((font) => <option key={font} value={font}>{font}</option>)}
            </select>
          </div>
        </div>
      );
    case "image":
      return (
        <div className="option-row option-row-multiline">
          <div className="option-label">{field.label}</div>
          <div className="option-input file-picker-input">
            <div className="file-pill">{String(value ?? "") || "Not selected"}</div>
            <button className="secondary" onClick={onPickImage}>Pick image</button>
          </div>
        </div>
      );
    case "select":
      return (
        <div className="option-row">
          <label className="option-label" htmlFor={inputId}>{field.label}</label>
          <div className="option-input">
            <select id={inputId} value={String(value ?? field.defaultValue ?? "")} onChange={(event) => onChange(event.target.value)}>
              {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
      );
    default:
      return null;
  }
}

function upsertHistory(history: RenderHistoryEntry[], event: RenderProgressEvent | RenderHistoryEntry) {
  const currentEntry =
    "sceneId" in event ? history.find((entry) => entry.id === event.id) : history.find((entry) => entry.id === event.jobId);
  const nextEntry: RenderHistoryEntry =
    "sceneId" in event
      ? event
      : {
          id: event.jobId,
          sceneId: currentEntry?.sceneId ?? "unknown-scene",
          sceneName: currentEntry?.sceneName ?? "Unknown Scene",
          outputPath: event.outputPath ?? currentEntry?.outputPath ?? "",
          createdAt: currentEntry?.createdAt ?? new Date().toISOString(),
          status: Number.isFinite(event.progress) ? event.status : currentEntry?.status ?? event.status,
          progress: Number.isFinite(event.progress) ? event.progress : currentEntry?.progress ?? 0,
          message: event.logEntry && !Number.isFinite(event.progress) ? currentEntry?.message ?? event.message : event.message,
          etaMs: Number.isFinite(event.progress) ? event.etaMs : currentEntry?.etaMs,
          renderFps: Number.isFinite(event.progress) ? event.renderFps : currentEntry?.renderFps,
          error: event.error ?? currentEntry?.error,
          logs: event.logEntry ? [...(currentEntry?.logs ?? []), event.logEntry] : currentEntry?.logs
        };

  const withoutEntry = history.filter((entry) => entry.id !== nextEntry.id);
  return [nextEntry, ...withoutEntry].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function getFileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function formatEta(etaMs: number) {
  const totalSeconds = Math.max(0, Math.round(etaMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getCategoryStateKey(instanceId: string, categoryId: string) {
  return `${instanceId}:${categoryId}`;
}

function upsertScene(scenes: SerializedSceneDefinition[], nextScene: SerializedSceneDefinition) {
  const withoutScene = scenes.filter((scene) => scene.id !== nextScene.id);
  return [...withoutScene, nextScene].sort((left, right) => left.name.localeCompare(right.name));
}

function cloneScene(scene: SerializedSceneDefinition): SerializedSceneDefinition {
  return structuredClone(scene);
}

function cloneComponent(component: SceneComponentInstance): SceneComponentInstance {
  return structuredClone(component);
}

function createSceneComponentInstance(component: SerializedSceneComponentDefinition): SceneComponentInstance {
  return {
    id: createInstanceId(component.id),
    componentId: component.id,
    enabled: true,
    options: structuredClone(component.defaultOptions)
  };
}

function createInstanceId(componentId: string) {
  return `${componentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
