interface SceneOptionFieldBase {
  id: string;
  label: string;
}

export type SceneOptionField =
  | ({
      type: "boolean";
      defaultValue?: boolean;
    } & SceneOptionFieldBase)
  | ({
      type: "number";
      defaultValue?: number;
      min?: number;
      max?: number;
      step?: number;
    } & SceneOptionFieldBase)
  | ({
      type: "text";
      defaultValue?: string;
      multiline?: boolean;
    } & SceneOptionFieldBase)
  | ({
      type: "color";
      defaultValue?: string;
    } & SceneOptionFieldBase)
  | ({
      type: "font";
      defaultValue?: string;
    } & SceneOptionFieldBase)
  | ({
      type: "image";
      required?: boolean;
    } & SceneOptionFieldBase)
  | ({
      type: "select";
      defaultValue?: string;
      options: { label: string; value: string }[];
    } & SceneOptionFieldBase);

export interface SceneOptionCategory {
  type: "category";
  id: string;
  label: string;
  defaultExpanded?: boolean;
  options: SceneOptionField[];
}

export type SceneOptionEntry = SceneOptionField | SceneOptionCategory;

export interface SceneValidationContext {
  isFileAccessible?: (path: string) => boolean;
  supportedFonts?: readonly string[];
}
