import React from "react";
import type {
  SceneComponentInstance,
  SerializedSceneComponentDefinition
} from "@lyric-video-maker/core";
import { isSceneOptionCategory } from "@lyric-video-maker/core";
import { getCategoryStateKey } from "../app-utils";
import { OptionCategorySection, OptionField } from "./form-fields";

export function SceneComponentCard({
  component,
  instance,
  index,
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
    <section className="component-card">
      <div className="component-card-header">
        <div>
          <p className="eyebrow">Layer {index + 1}</p>
          <h3>{component.name}</h3>
          {component.description ? <p className="scene-description">{component.description}</p> : null}
        </div>
        <div className="button-row">
          <button className="secondary" onClick={onToggleEnabled}>
            {instance.enabled ? "Disable" : "Enable"}
          </button>
          <button className="secondary" onClick={() => onMove(-1)}>
            Move Up
          </button>
          <button className="secondary" onClick={() => onMove(1)}>
            Move Down
          </button>
          <button className="secondary" onClick={onDuplicate}>
            Duplicate
          </button>
          <button className="secondary danger" onClick={onRemove}>
            Remove
          </button>
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
              fonts={fonts}
              onChange={(value) => onOptionChange(field.id, value)}
              onPickImage={() => onPickImage(field.id)}
            />
          ))}
        </div>
      ) : null}

      {categorizedOptions.map((category) => (
        <OptionCategorySection
          key={category.id}
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
      ))}
    </section>
  );
}
