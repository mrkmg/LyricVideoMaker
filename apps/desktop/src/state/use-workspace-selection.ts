import { useState } from "react";
import type { WorkspaceSelection } from "./workspace-types";

export interface WorkspaceSelectionState {
  selection: WorkspaceSelection;
  setSelection: React.Dispatch<React.SetStateAction<WorkspaceSelection>>;
}

/**
 * Holds the active workspace selection (scene vs. component instance). All
 * composer mutations route through `useComposer`, so the previous defensive
 * cleanup effect (which fell back to the scene selection when a selected
 * component disappeared) is no longer required — `useComposer.removeComponent`
 * handles that case directly.
 */
export function useWorkspaceSelection(): WorkspaceSelectionState {
  const [selection, setSelection] = useState<WorkspaceSelection>({ type: "scene" });
  return { selection, setSelection };
}
