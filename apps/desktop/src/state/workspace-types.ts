export type WorkspaceSelection =
  | { type: "scene" }
  | { type: "component"; instanceId: string };

export function isComponentSelection(
  selection: WorkspaceSelection
): selection is Extract<WorkspaceSelection, { type: "component" }> {
  return selection.type === "component";
}
