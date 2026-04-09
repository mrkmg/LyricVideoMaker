import type {
  SerializedSceneComponentDefinition,
  SerializedSceneDefinition
} from "@lyric-video-maker/core";
import { SceneComponentCard } from "./scene-component-card";

export function SceneLibraryPanel({
  builtInScenes,
  userScenes,
  selectedScene,
  components,
  componentCatalog,
  fonts,
  expandedCategories,
  componentToAddId,
  onComponentToAddIdChange,
  onSceneChange,
  onSceneNameChange,
  onSceneDescriptionChange,
  onImportScene,
  onExportScene,
  onSaveScene,
  onDeleteScene,
  onAddComponent,
  onToggleComponentEnabled,
  onMoveComponent,
  onDuplicateComponent,
  onRemoveComponent,
  onComponentOptionChange,
  onPickComponentImage,
  onToggleCategory
}: {
  builtInScenes: SerializedSceneDefinition[];
  userScenes: SerializedSceneDefinition[];
  selectedScene: SerializedSceneDefinition;
  components: SerializedSceneComponentDefinition[];
  componentCatalog: ReadonlyMap<string, SerializedSceneComponentDefinition>;
  fonts: string[];
  expandedCategories: Record<string, boolean>;
  componentToAddId: string;
  onComponentToAddIdChange: (componentId: string) => void;
  onSceneChange: (sceneId: string) => void;
  onSceneNameChange: (name: string) => void;
  onSceneDescriptionChange: (description: string) => void;
  onImportScene: () => void | Promise<void>;
  onExportScene: () => void | Promise<void>;
  onSaveScene: () => void | Promise<void>;
  onDeleteScene: () => void | Promise<void>;
  onAddComponent: () => void;
  onToggleComponentEnabled: (instanceId: string) => void;
  onMoveComponent: (instanceId: string, direction: -1 | 1) => void;
  onDuplicateComponent: (instanceId: string) => void;
  onRemoveComponent: (instanceId: string) => void;
  onComponentOptionChange: (instanceId: string, optionId: string, value: unknown) => void;
  onPickComponentImage: (instanceId: string, optionId: string) => void;
  onToggleCategory: (instanceId: string, categoryId: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Scene Library</p>
          <h2>Scene stacks</h2>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={onImportScene}>
            Import JSON
          </button>
          <button className="secondary" onClick={onExportScene}>
            Export JSON
          </button>
          <button className="secondary" onClick={onSaveScene}>
            {selectedScene.source === "user" ? "Save Scene" : "Save as User Scene"}
          </button>
          {selectedScene.source === "user" ? (
            <button className="secondary danger" onClick={onDeleteScene}>
              Delete Scene
            </button>
          ) : null}
        </div>
      </div>

      <div className="scene-library-grid">
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

        <label className="field">
          <span>Scene name</span>
          <input
            value={selectedScene.name}
            onChange={(event) => onSceneNameChange(event.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span>Description</span>
        <textarea
          value={selectedScene.description ?? ""}
          onChange={(event) => onSceneDescriptionChange(event.target.value)}
        />
      </label>

      <p className="scene-description">
        {selectedScene.source === "built-in"
          ? "Built-in template. Editing is local until you save a user-owned copy."
          : "User scene stored locally and reusable across renders."}
      </p>

      <div className="component-toolbar">
        <label className="field">
          <span>Add component</span>
          <select
            value={componentToAddId}
            onChange={(event) => onComponentToAddIdChange(event.target.value)}
          >
            {components.map((component) => (
              <option key={component.id} value={component.id}>
                {component.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" onClick={onAddComponent}>
          Add to stack
        </button>
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

            return (
              <SceneComponentCard
                key={instance.id}
                component={component}
                instance={instance}
                index={index}
                fonts={fonts}
                expandedCategories={expandedCategories}
                onToggleEnabled={() => onToggleComponentEnabled(instance.id)}
                onMove={(direction) => onMoveComponent(instance.id, direction)}
                onDuplicate={() => onDuplicateComponent(instance.id)}
                onRemove={() => onRemoveComponent(instance.id)}
                onOptionChange={(optionId, value) =>
                  onComponentOptionChange(instance.id, optionId, value)
                }
                onPickImage={(optionId) => onPickComponentImage(instance.id, optionId)}
                onToggleCategory={(categoryId) => onToggleCategory(instance.id, categoryId)}
              />
            );
          })
        )}
      </div>
    </section>
  );
}
