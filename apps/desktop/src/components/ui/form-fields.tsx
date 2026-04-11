import React, { type ReactNode } from "react";
import type {
  SceneOptionCategory,
  SceneOptionField
} from "@lyric-video-maker/core";

export function InfoTip({
  text,
  label = "More information"
}: {
  text: string;
  label?: string;
}) {
  return (
    <span
      className="info-tip"
      tabIndex={0}
      role="note"
      title={text}
      aria-label={`${label}: ${text}`}
    >
      i
    </span>
  );
}

function FieldLabel({
  label,
  helpText
}: {
  label: string;
  helpText?: string;
}) {
  return (
    <span className="field-label">
      <span>{label}</span>
      {helpText ? <InfoTip text={helpText} label={label} /> : null}
    </span>
  );
}

export function OptionCategorySection({
  category,
  children
}: {
  category: SceneOptionCategory;
  children: ReactNode;
}) {
  return (
    <section className="option-category">
      <div className="option-category-toggle">
        <span>{category.label}</span>
      </div>
      <div className="option-list">{children}</div>
    </section>
  );
}

export function NumberField({
  label,
  helpText,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  helpText?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <FieldLabel label={label} helpText={helpText} />
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
  helpText,
  value,
  options,
  disabled = false,
  onChange
}: {
  label: string;
  helpText?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <FieldLabel label={label} helpText={helpText} />
      <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
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
  helpText,
  value,
  buttonLabel,
  disabled = false,
  onPick,
  compact = false
}: {
  label: string;
  helpText?: string;
  value: string;
  buttonLabel: string;
  disabled?: boolean;
  onPick: () => void;
  compact?: boolean;
}) {
  const hasValue = value.trim().length > 0;

  return (
    <div className={`field file-field${compact ? " file-field-compact" : ""}`}>
      <FieldLabel label={label} helpText={helpText} />
      <div
        className={`file-pill${hasValue ? "" : " is-empty"}`}
        title={hasValue ? value : "Not selected"}
      >
        {value || "Not selected"}
      </div>
      <button type="button" className="secondary" disabled={disabled} onClick={onPick}>{buttonLabel}</button>
    </div>
  );
}

export function OptionField({
  field,
  inputPrefix,
  value,
  fonts,
  onChange,
  onPickFile
}: {
  field: SceneOptionField;
  inputPrefix: string;
  value: unknown;
  fonts: string[];
  onChange: (value: unknown) => void;
  /**
   * Generalized file-pick callback — one entry point that accepts both the
   * field's kind ("image" or "video") and is invoked by the field dispatch
   * switch below. Replaces the previous image-specific pick callback so
   * image and video fields go through the same path (T-014).
   */
  onPickFile: (kind: "image" | "video") => void;
}) {
  const inputId = `${inputPrefix}-${field.id}`;

  switch (field.type) {
    case "boolean":
      return (
        <div className="option-row">
          <label className="option-label" htmlFor={inputId}>
            <FieldLabel label={field.label} />
          </label>
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
          <label className="option-label" htmlFor={inputId}>
            <FieldLabel label={field.label} />
          </label>
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
          <label className="option-label" htmlFor={inputId}>
            <FieldLabel label={field.label} />
          </label>
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
          <label className="option-label" htmlFor={inputId}>
            <FieldLabel label={field.label} />
          </label>
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
          <label className="option-label" htmlFor={inputId}>
            <FieldLabel label={field.label} />
          </label>
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
          <div className="option-label">
            <FieldLabel label={field.label} />
          </div>
          <div className="option-input file-picker-input">
            <div className="file-pill">{String(value ?? "") || "Not selected"}</div>
            <button className="secondary" onClick={() => onPickFile("image")}>Pick image</button>
          </div>
        </div>
      );
    case "select":
      return (
        <div className="option-row">
          <label className="option-label" htmlFor={inputId}>
            <FieldLabel label={field.label} />
          </label>
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
