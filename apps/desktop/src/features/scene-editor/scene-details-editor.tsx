import React, { useState } from "react";
import type {
  SerializedSceneComponentDefinition,
  SerializedSceneDefinition
} from "@lyric-video-maker/core";
import type { InstalledPluginSummary } from "../../electron-api";
import { InfoTip } from "../../components/ui/form-fields";

export function SceneDetailsEditor({
  builtInScenes,
  pluginScenes,
  userScenes,
  plugins,
  selectedScene,
  components,
  componentCatalog,
  onSceneChange,
  onMergeSceneComponents,
  onSceneNameChange,
  onSceneDescriptionChange,
  onImportScene,
  onImportPlugin,
  onUpdatePlugin,
  onRemovePlugin,
  onExportScene,
  onSaveScene,
  onSaveSceneAsNew,
  onDeleteScene
}: {
  builtInScenes: SerializedSceneDefinition[];
  pluginScenes: SerializedSceneDefinition[];
  userScenes: SerializedSceneDefinition[];
  plugins: InstalledPluginSummary[];
  selectedScene: SerializedSceneDefinition;
  components: SerializedSceneComponentDefinition[];
  componentCatalog: ReadonlyMap<string, SerializedSceneComponentDefinition>;
  onSceneChange: (sceneId: string) => void;
  onMergeSceneComponents: (sceneId: string) => void;
  onSceneNameChange: (name: string) => void;
  onSceneDescriptionChange: (description: string) => void;
  onImportScene: () => void | Promise<void>;
  onImportPlugin: (url: string) => void | Promise<void>;
  onUpdatePlugin: (pluginId: string) => void | Promise<void>;
  onRemovePlugin: (pluginId: string) => void | Promise<void>;
  onExportScene: () => void | Promise<void>;
  onSaveScene: () => void | Promise<void>;
  onSaveSceneAsNew: () => void | Promise<void>;
  onDeleteScene: () => void | Promise<void>;
}) {
  const [pendingSceneId, setPendingSceneId] = useState<string | null>(null);
  const [pluginUrl, setPluginUrl] = useState("");
  const [pluginError, setPluginError] = useState("");
  const [isPluginImporting, setIsPluginImporting] = useState(false);
  const [pluginUpdatingId, setPluginUpdatingId] = useState<string | null>(null);

  function handleScenePickerChange(nextSceneId: string) {
    if (nextSceneId === selectedScene.id) {
      return;
    }
    if (selectedScene.components.length === 0) {
      onSceneChange(nextSceneId);
      return;
    }
    setPendingSceneId(nextSceneId);
  }

  async function handleImportPlugin() {
    const url = pluginUrl.trim();
    if (!url) {
      setPluginError("Paste a GitHub URL or local plugin folder path.");
      return;
    }
    const confirmed = window.confirm(
      "External plugins run trusted code from the cloned repository and can access local files through the app process. Import only plugins you trust."
    );
    if (!confirmed) {
      return;
    }
    setIsPluginImporting(true);
    setPluginError("");
    try {
      await onImportPlugin(url);
      setPluginUrl("");
    } catch (error) {
      setPluginError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPluginImporting(false);
    }
  }

  async function handleUpdatePlugin(pluginId: string) {
    setPluginUpdatingId(pluginId);
    setPluginError("");
    try {
      await onUpdatePlugin(pluginId);
    } catch (error) {
      setPluginError(error instanceof Error ? error.message : String(error));
    } finally {
      setPluginUpdatingId(null);
    }
  }

  async function handleRemovePlugin(pluginId: string) {
    setPluginError("");
    try {
      await onRemovePlugin(pluginId);
    } catch (error) {
      setPluginError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className="panel inspector-panel">

      <div className="inspector-layout">
        <section className="inspector-section">
          <div className="inspector-section-header">
            <div className="section-title-row">
              <h3>Metadata</h3>
              <InfoTip text="Update the local scene name and description used by the composer." />
            </div>
          </div>

          <div className="inspector-grid inspector-grid-two">
            <label className="field">
              <span>Scene name</span>
              <input
                value={selectedScene.name}
                onChange={(event) => onSceneNameChange(event.target.value)}
              />
            </label>

            <div className="scene-status-card">
              <span className="eyebrow">Stack Summary</span>
              <strong>{selectedScene.components.length} components</strong>
              <p>
                {selectedScene.components
                  .map((instance) => componentCatalog.get(instance.componentId)?.name)
                  .filter(Boolean)
                  .join(", ") || "No components in this scene."}
              </p>
            </div>
          </div>

          <label className="field">
            <span>Description</span>
            <textarea
              value={selectedScene.description ?? ""}
              onChange={(event) => onSceneDescriptionChange(event.target.value)}
            />
          </label>

          <div className="button-row">
            {selectedScene.source === "user" ? (
              <>
                <button type="button" className="secondary" onClick={onSaveScene}>
                  Replace
                </button>
                <button type="button" className="secondary" onClick={onSaveSceneAsNew}>
                  Save as New
                </button>
                <button type="button" className="secondary danger" onClick={onDeleteScene}>
                  Delete
                </button>
              </>
            ) : (
              <button type="button" className="secondary" onClick={onSaveScene}>
                Save as User Scene
              </button>
            )}
            <button type="button" className="secondary" onClick={onImportScene}>
              Import JSON
            </button>
            <button type="button" className="secondary" onClick={onExportScene}>
              Export JSON
            </button>
          </div>
        </section>

        <section className="inspector-section">
          <div className="inspector-section-header">
            <div className="section-title-row">
              <h3>Saved Scenes</h3>
              <InfoTip text="Switch between built-in and user scenes." />
            </div>
          </div>

          <div className="inspector-grid inspector-grid-two">
            <label className="field">
              <span>Scene preset</span>
              <select value={selectedScene.id} onChange={(event) => handleScenePickerChange(event.target.value)}>
                <optgroup label="Built-in">
                  {builtInScenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {scene.name}
                    </option>
                  ))}
                </optgroup>
                {pluginScenes.length > 0 ? (
                  <optgroup label="Plugin Scenes">
                    {pluginScenes.map((scene) => (
                      <option key={scene.id} value={scene.id}>
                        {scene.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {userScenes.length > 0 ? (
                  <optgroup label="User Scenes">
                    {userScenes.map((scene) => (
                      <option key={scene.id} value={scene.id}>
                        {scene.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>

            <div className="scene-status-card">
              <span className="eyebrow">Status</span>
              <strong>{getSceneStatusTitle(selectedScene.source)}</strong>
              <p>
                {selectedScene.source === "built-in"
                  ? "Changes stay local until you save a user-owned copy."
                  : selectedScene.source === "plugin"
                    ? "Loaded from an installed plugin. Save a user copy to make it editable."
                    : "Stored locally and available for future renders."}
              </p>
            </div>
          </div>
        </section>

        <section className="inspector-section">
          <div className="inspector-section-header">
            <div className="section-title-row">
              <h3>External Plugins</h3>
              <InfoTip text="Import trusted prebuilt scene/component plugins from GitHub or local plugin folders." />
            </div>
          </div>

          <div className="plugin-import-row">
            <label className="field">
              <span>GitHub URL or local folder</span>
              <input
                value={pluginUrl}
                placeholder="https://github.com/owner/repo"
                onChange={(event) => setPluginUrl(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="secondary"
              disabled={isPluginImporting}
              onClick={() => void handleImportPlugin()}
            >
              {isPluginImporting ? "Importing..." : "Import Plugin"}
            </button>
          </div>

          {pluginError ? <div className="error-banner">{pluginError}</div> : null}

          <div className="plugin-list">
            {plugins.length === 0 ? (
              <div className="workspace-empty-state">No external plugins installed.</div>
            ) : (
              plugins.map((plugin) => (
                <div key={plugin.id} className="plugin-row">
                  <div>
                    <strong>{plugin.name}</strong>
                    <p>
                      {plugin.version} - {plugin.componentCount} components - {plugin.sceneCount} scenes
                    </p>
                  </div>
                  <div className="button-row">
                    <button
                      type="button"
                      className="secondary"
                      disabled={pluginUpdatingId !== null}
                      onClick={() => void handleUpdatePlugin(plugin.id)}
                    >
                      {pluginUpdatingId === plugin.id ? "Updating..." : "Update"}
                    </button>
                    <button
                      type="button"
                      className="secondary danger"
                      onClick={() => void handleRemovePlugin(plugin.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </div>

      {pendingSceneId !== null && (
        <div className="dialog-backdrop" role="presentation">
          <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="scene-change-dialog-title">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Scene Change</p>
                <h2 id="scene-change-dialog-title">Replace or Add Components?</h2>
              </div>
            </div>
            <div className="dialog-body">
              <p>
                The current scene has {selectedScene.components.length} component{selectedScene.components.length !== 1 ? "s" : ""}.
                You can replace the entire scene or add the new scene's components to the existing stack.
              </p>
            </div>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={() => setPendingSceneId(null)}>
                Cancel
              </button>
              <button type="button" className="secondary" onClick={() => {
                onMergeSceneComponents(pendingSceneId);
                setPendingSceneId(null);
              }}>
                Add to Existing
              </button>
              <button type="button" className="primary" onClick={() => {
                onSceneChange(pendingSceneId);
                setPendingSceneId(null);
              }}>
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function getSceneStatusTitle(source: SerializedSceneDefinition["source"]) {
  if (source === "built-in") {
    return "Built-in scene";
  }
  if (source === "plugin") {
    return "Plugin scene";
  }
  return "User scene";
}
