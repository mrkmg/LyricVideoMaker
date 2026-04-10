import React from "react";
import type {
  SceneComponentInstance,
  SerializedSceneComponentDefinition,
  SerializedSceneDefinition
} from "@lyric-video-maker/core";
import type { WorkspaceSelection } from "../../state/workspace-types";

export function WorkspaceNavPanel({
  selectedScene,
  selection,
  componentCatalog,
  componentToAddId,
  onSelectScene,
  onSelectComponent,
  onComponentToAddIdChange,
  onAddComponent,
  onToggleComponentEnabled,
  onMoveComponent,
  onDuplicateComponent,
  onRemoveComponent
}: {
  selectedScene: SerializedSceneDefinition;
  selection: WorkspaceSelection;
  componentCatalog: ReadonlyMap<string, SerializedSceneComponentDefinition>;
  componentToAddId: string;
  onSelectScene: () => void;
  onSelectComponent: (instanceId: string) => void;
  onComponentToAddIdChange: (componentId: string) => void;
  onAddComponent: () => void;
  onToggleComponentEnabled: (instanceId: string) => void;
  onMoveComponent: (instanceId: string, direction: -1 | 1) => void;
  onDuplicateComponent: (instanceId: string) => void;
  onRemoveComponent: (instanceId: string) => void;
}) {
  return (
    <section className="panel workspace-sidebar">
      <div className="panel-header workspace-sidebar-header">
        <div>
          <p className="eyebrow">Workspace</p>
        </div>
        <span className="workspace-sidebar-badge">{selectedScene.components.length} components</span>
      </div>

      <div className="workspace-nav">
        <section className="workspace-nav-section">
          <div className="workspace-nav-section-label">Scene Builder</div>

          <button
            type="button"
            className={`workspace-nav-item ${selection.type === "scene" ? "is-selected" : ""}`}
            aria-label="Scene"
            onClick={onSelectScene}
          >
            <span className="workspace-nav-title">Scene</span>
            <span className="workspace-nav-subtitle">
              {selectedScene.name || "Unnamed scene"}
            </span>
          </button>

          <div className="workspace-component-list">
            {selectedScene.components.length === 0 ? (
              <div className="workspace-empty-state">No components in this scene.</div>
            ) : (
              selectedScene.components.map((instance, index) => {
                const component = componentCatalog.get(instance.componentId);
                if (!component) {
                  return null;
                }

                return (
                  <ComponentRow
                    key={instance.id}
                    instance={instance}
                    component={component}
                    index={index}
                    isSelected={
                      selection.type === "component" && selection.instanceId === instance.id
                    }
                    isFirst={index === 0}
                    isLast={index === selectedScene.components.length - 1}
                    onSelect={() => onSelectComponent(instance.id)}
                    onToggleEnabled={() => onToggleComponentEnabled(instance.id)}
                    onMove={(direction) => onMoveComponent(instance.id, direction)}
                    onDuplicate={() => onDuplicateComponent(instance.id)}
                    onRemove={() => onRemoveComponent(instance.id)}
                  />
                );
              })
            )}
          </div>

          <div className="workspace-add-component">
            <label className="field workspace-compact-field">
              <span>Add component</span>
              <select
                value={componentToAddId}
                onChange={(event) => onComponentToAddIdChange(event.target.value)}
              >
                {[...componentCatalog.values()].map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="primary workspace-add-button" onClick={onAddComponent}>
              Add
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

function ComponentRow({
  instance,
  component,
  index,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onToggleEnabled,
  onMove,
  onDuplicate,
  onRemove
}: {
  instance: SceneComponentInstance;
  component: SerializedSceneComponentDefinition;
  index: number;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onToggleEnabled: () => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`workspace-component-row ${isSelected ? "is-selected" : ""}`}>
      <button type="button" className="workspace-component-select" onClick={onSelect}>
        <span className="sr-only">{`Select ${component.name} component`}</span>
        <span className="workspace-component-copy">
          <span className="workspace-component-header">
            <span className="workspace-component-order">{index + 1}</span>
            <span className="workspace-nav-title">{component.name}</span>
          </span>
          <span className="workspace-nav-subtitle">
            {instance.enabled ? "Enabled" : "Disabled"}
          </span>
        </span>
      </button>

      <div className="workspace-component-actions">
        <button
          type="button"
          className={`secondary icon-button ${instance.enabled ? "is-active" : ""}`}
          aria-label={`${instance.enabled ? "Disable" : "Enable"} ${component.name}`}
          onClick={onToggleEnabled}
        >
          {instance.enabled ? "On" : "Off"}
        </button>
        <button
          type="button"
          className="secondary icon-button"
          aria-label={`Move ${component.name} up`}
          disabled={isFirst}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="secondary icon-button"
          aria-label={`Move ${component.name} down`}
          disabled={isLast}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
        <button
          type="button"
          className="secondary icon-button"
          aria-label={`Duplicate ${component.name}`}
          onClick={onDuplicate}
        >
          +
        </button>
        <button
          type="button"
          className="secondary danger icon-button"
          aria-label={`Remove ${component.name}`}
          onClick={onRemove}
        >
          ×
        </button>
      </div>
    </div>
  );
}
