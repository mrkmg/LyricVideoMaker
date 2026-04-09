import React from "react";
import type {
  SceneComponentInstance,
  SerializedSceneComponentDefinition
} from "@lyric-video-maker/core";
import { isSceneOptionCategory } from "@lyric-video-maker/core";
import { getCategoryStateKey } from "../app-utils";
import { OptionCategorySection, OptionField } from "./form-fields";

export function ComponentDetailsEditor({
  component,
  instance,
  index,
  totalComponents,
  fonts,
  expandedCategories,
  onToggleEnabled,
  onMove,
  onDuplicate,
  onRemove,
  onOptionChange,
  onPickImage,
  onToggleCategory
}: {
  component: SerializedSceneComponentDefinition;
  instance: SceneComponentInstance;
  index: number;
  totalComponents: number;
  fonts: string[];
  expandedCategories: Record<string, boolean>;
  onToggleEnabled: () => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onOptionChange: (optionId: string, value: unknown) => void;
  onPickImage: (optionId: string) => void;
  onToggleCategory: (categoryId: string) => void;
}) {
  const topLevelOptions = component.options.filter((option) => !isSceneOptionCategory(option));
  const categorizedOptions = component.options.filter(isSceneOptionCategory);

  return (
    <section className="panel inspector-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Inspector</p>
          <h2>{component.name}</h2>
        </div>
      </div>

      <div className="inspector-layout">
        <section className="inspector-section">
          <div className="inspector-section-header">
            <h3>Component Controls</h3>
            <p>{component.description ?? "Adjust this component and its stack position."}</p>
          </div>

          <div className="component-header-grid">
            <div className="scene-status-card">
              <span className="eyebrow">Layer</span>
              <strong>
                {index + 1} of {totalComponents}
              </strong>
              <p>{instance.enabled ? "This component is enabled." : "This component is disabled."}</p>
            </div>

            <div className="button-row">
              <button type="button" className="secondary" onClick={onToggleEnabled}>
                {instance.enabled ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={index === 0}
                onClick={() => onMove(-1)}
              >
                Move Up
              </button>
              <button
                type="button"
                className="secondary"
                disabled={index === totalComponents - 1}
                onClick={() => onMove(1)}
              >
                Move Down
              </button>
              <button type="button" className="secondary" onClick={onDuplicate}>
                Duplicate
              </button>
              <button type="button" className="secondary danger" onClick={onRemove}>
                Remove
              </button>
            </div>
          </div>
        </section>

        {topLevelOptions.length > 0 ? (
          <section className="inspector-section">
            <div className="inspector-section-header">
              <h3>Core Options</h3>
              <p>Change the primary fields for this component instance.</p>
            </div>

            <div className="option-list top-level-options">
              {topLevelOptions.map((field) => (
                <OptionField
                  key={field.id}
                  field={field}
                  inputPrefix={instance.id}
                  value={instance.options[field.id]}
                  fonts={fonts}
                  onChange={(value) => onOptionChange(field.id, value)}
                  onPickImage={() => onPickImage(field.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {categorizedOptions.map((category) => (
          <section key={category.id} className="inspector-section">
            <OptionCategorySection
              category={category}
              isExpanded={
                expandedCategories[getCategoryStateKey(instance.id, category.id)] ??
                category.defaultExpanded ??
                true
              }
              onToggle={() => onToggleCategory(category.id)}
            >
              {category.options.map((field) => (
                <OptionField
                  key={field.id}
                  field={field}
                  inputPrefix={instance.id}
                  value={instance.options[field.id]}
                  fonts={fonts}
                  onChange={(value) => onOptionChange(field.id, value)}
                  onPickImage={() => onPickImage(field.id)}
                />
              ))}
            </OptionCategorySection>
          </section>
        ))}
      </div>
    </section>
  );
}
