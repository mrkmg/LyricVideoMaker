import React from "react";
import type {
  SceneComponentInstance,
  SerializedSceneComponentDefinition
} from "@lyric-video-maker/core";
import { isSceneOptionCategory } from "@lyric-video-maker/core";
import { InfoTip, OptionCategorySection, OptionField } from "../../components/ui/form-fields";

export function ComponentDetailsEditor({
  component,
  instance,
  fonts,
  onOptionChange,
  onPickImage
}: {
  component: SerializedSceneComponentDefinition;
  instance: SceneComponentInstance;
  fonts: string[];
  onOptionChange: (optionId: string, value: unknown) => void;
  onPickImage: (optionId: string) => void;
}) {
  const topLevelOptions = component.options.filter((option) => !isSceneOptionCategory(option));
  const categorizedOptions = component.options.filter(isSceneOptionCategory);

  return (
    <section className="panel inspector-panel">

      <div className="inspector-layout">
        {topLevelOptions.length > 0 ? (
          <section className="inspector-section">
            <div className="inspector-section-header">
              <div className="section-title-row">
                <h3>Core Options</h3>
                <InfoTip text="Change the primary fields for this component instance." />
              </div>
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
            <OptionCategorySection category={category}>
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
