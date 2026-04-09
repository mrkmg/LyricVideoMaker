import React, { type ReactNode } from "react";
import type {
  SceneOptionCategory,
  SceneOptionField
} from "@lyric-video-maker/core";

export function OptionCategorySection({
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

export function NumberField({
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
      <input
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function SelectField({
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

export function FileField({
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

export function OptionField({
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
            <input
              id={inputId}
              type="checkbox"
              checked={Boolean(value ?? field.defaultValue ?? false)}
              onChange={(event) => onChange(event.target.checked)}
            />
          </div>
        </div>
      );
    case "number":
      return (
        <div className="option-row">
          <label className="option-label" htmlFor={inputId}>{field.label}</label>
          <div className="option-input">
            <input
              id={inputId}
              type="number"
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={typeof value === "number" ? value : field.defaultValue ?? 0}
              onChange={(event) => onChange(Number(event.target.value))}
            />
          </div>
        </div>
      );
    case "text":
      return (
        <div className="option-row option-row-multiline">
          <label className="option-label" htmlFor={inputId}>{field.label}</label>
          <div className="option-input">
            {field.multiline ? (
              <textarea
                id={inputId}
                value={String(value ?? field.defaultValue ?? "")}
                onChange={(event) => onChange(event.target.value)}
              />
            ) : (
              <input
                id={inputId}
                value={String(value ?? field.defaultValue ?? "")}
                onChange={(event) => onChange(event.target.value)}
              />
            )}
          </div>
        </div>
      );
    case "color":
      return (
        <div className="option-row">
          <label className="option-label" htmlFor={inputId}>{field.label}</label>
          <div className="option-input">
            <input
              id={inputId}
              type="color"
              value={String(value ?? field.defaultValue ?? "#ffffff")}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
        </div>
      );
    case "font":
      return (
        <div className="option-row">
          <label className="option-label" htmlFor={inputId}>{field.label}</label>
          <div className="option-input">
            <select
              id={inputId}
              value={String(value ?? field.defaultValue ?? fonts[0])}
              onChange={(event) => onChange(event.target.value)}
            >
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
            <select
              id={inputId}
              value={String(value ?? field.defaultValue ?? "")}
              onChange={(event) => onChange(event.target.value)}
            >
              {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
      );
    default:
      return null;
  }
}
