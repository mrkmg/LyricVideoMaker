import React from "react";
import type {
  SerializedSceneComponentDefinition,
  SerializedSceneDefinition
} from "@lyric-video-maker/core";
import { InfoTip } from "./form-fields";

export function SceneDetailsEditor({
  builtInScenes,
  userScenes,
  selectedScene,
  components,
  componentCatalog,
  onSceneChange,
  onSceneNameChange,
  onSceneDescriptionChange,
  onImportScene,
  onExportScene,
  onSaveScene,
  onDeleteScene
}: {
  builtInScenes: SerializedSceneDefinition[];
  userScenes: SerializedSceneDefinition[];
  selectedScene: SerializedSceneDefinition;
  components: SerializedSceneComponentDefinition[];
  componentCatalog: ReadonlyMap<string, SerializedSceneComponentDefinition>;
  onSceneChange: (sceneId: string) => void;
  onSceneNameChange: (name: string) => void;
  onSceneDescriptionChange: (description: string) => void;
  onImportScene: () => void | Promise<void>;
  onExportScene: () => void | Promise<void>;
  onSaveScene: () => void | Promise<void>;
  onDeleteScene: () => void | Promise<void>;
}) {
  return (
    <section className="panel inspector-panel">

      <div className="inspector-layout">
        <section className="inspector-section">
          <div className="inspector-section-header">
            <div className="section-title-row">
              <h3>Saved Scenes</h3>
              <InfoTip text="Switch between built-in and user scenes, then save or export changes." />
            </div>
          </div>

          <div className="inspector-grid inspector-grid-two">
            <label className="field">
              <span>Scene preset</span>
              <select value={selectedScene.id} onChange={(event) => onSceneChange(event.target.value)}>
                <optgroup label="Built-in">
                  {builtInScenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {scene.name}
                    </option>
                  ))}
                </optgroup>
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
              <strong>{selectedScene.source === "built-in" ? "Built-in scene" : "User scene"}</strong>
              <p>
                {selectedScene.source === "built-in"
                  ? "Changes stay local until you save a user-owned copy."
                  : "Stored locally and available for future renders."}
              </p>
            </div>
          </div>

          <div className="button-row">
            <button type="button" className="secondary" onClick={onImportScene}>
              Import JSON
            </button>
            <button type="button" className="secondary" onClick={onExportScene}>
              Export JSON
            </button>
            <button type="button" className="secondary" onClick={onSaveScene}>
              {selectedScene.source === "user" ? "Save Scene" : "Save as User Scene"}
            </button>
            {selectedScene.source === "user" ? (
              <button type="button" className="secondary danger" onClick={onDeleteScene}>
                Delete Scene
              </button>
            ) : null}
          </div>
        </section>

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
        </section>
      
      </div>
    </section>
  );
}
