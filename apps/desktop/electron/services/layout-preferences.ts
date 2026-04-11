import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Rectangle } from "electron";
import type { PaneLayoutPreferences } from "../../src/electron-api";

const LAYOUT_PREFERENCES_VERSION = 1;
const MIN_WINDOW_WIDTH = 1200;
const MIN_WINDOW_HEIGHT = 760;
const MIN_SIDE_PANE_WIDTH = 280;
const MIN_INSPECTOR_HEIGHT = 250;
const MAX_PANE_SIZE = 10000;

export interface WindowLayoutPreferences {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
}

export interface LayoutPreferences {
  version: 1;
  window?: WindowLayoutPreferences;
  panes?: PaneLayoutPreferences;
}

interface LayoutPreferencesStoreOptions {
  userDataPath: string;
}

export interface LayoutPreferencesStore {
  load(): Promise<LayoutPreferences>;
  get(): LayoutPreferences;
  updateWindow(window: WindowLayoutPreferences): Promise<LayoutPreferences>;
  updatePanes(panes: PaneLayoutPreferences): Promise<LayoutPreferences>;
}

export function createLayoutPreferencesStore({
  userDataPath
}: LayoutPreferencesStoreOptions): LayoutPreferencesStore {
  const filePath = getLayoutPreferencesPath(userDataPath);
  let preferences: LayoutPreferences = createDefaultLayoutPreferences();

  async function save() {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(preferences, null, 2), "utf8");
  }

  return {
    async load() {
      preferences = await loadLayoutPreferences(userDataPath);
      return preferences;
    },
    get() {
      return preferences;
    },
    async updateWindow(window) {
      preferences = {
        ...preferences,
        window: sanitizeWindowPreferences(window)
      };
      await save();
      return preferences;
    },
    async updatePanes(panes) {
      preferences = {
        ...preferences,
        panes: sanitizePaneLayoutPreferences(panes)
      };
      await save();
      return preferences;
    }
  };
}

export async function loadLayoutPreferences(userDataPath: string): Promise<LayoutPreferences> {
  try {
    const raw = JSON.parse(await readFile(getLayoutPreferencesPath(userDataPath), "utf8"));
    return parseLayoutPreferences(raw);
  } catch {
    return createDefaultLayoutPreferences();
  }
}

export function parseLayoutPreferences(raw: unknown): LayoutPreferences {
  if (!isRecord(raw) || raw.version !== LAYOUT_PREFERENCES_VERSION) {
    return createDefaultLayoutPreferences();
  }

  const preferences: LayoutPreferences = { version: LAYOUT_PREFERENCES_VERSION };
  const window = parseWindowPreferences(raw.window);
  const panes = parsePaneLayoutPreferences(raw.panes);

  if (window) {
    preferences.window = window;
  }
  if (panes) {
    preferences.panes = panes;
  }

  return preferences;
}

export function sanitizeWindowPreferences(window: WindowLayoutPreferences): WindowLayoutPreferences {
  return {
    x: Number.isFinite(window.x) ? window.x : undefined,
    y: Number.isFinite(window.y) ? window.y : undefined,
    width: Math.max(MIN_WINDOW_WIDTH, Math.round(window.width)),
    height: Math.max(MIN_WINDOW_HEIGHT, Math.round(window.height)),
    maximized: window.maximized
  };
}

export function sanitizePaneLayoutPreferences(
  panes: PaneLayoutPreferences
): PaneLayoutPreferences {
  return {
    generalPaneWidth: clampInteger(panes.generalPaneWidth, MIN_SIDE_PANE_WIDTH, MAX_PANE_SIZE),
    sidebarWidth: clampInteger(panes.sidebarWidth, MIN_SIDE_PANE_WIDTH, MAX_PANE_SIZE),
    inspectorHeight: clampInteger(panes.inspectorHeight, MIN_INSPECTOR_HEIGHT, MAX_PANE_SIZE)
  };
}

export function getRestorableWindowPreferences(
  window: WindowLayoutPreferences | undefined,
  workAreas: Rectangle[]
): WindowLayoutPreferences | undefined {
  if (!window) {
    return undefined;
  }

  const sanitized = sanitizeWindowPreferences(window);
  if (sanitized.x === undefined || sanitized.y === undefined) {
    return {
      width: sanitized.width,
      height: sanitized.height,
      maximized: sanitized.maximized
    };
  }

  const savedBounds: Rectangle = {
    x: sanitized.x,
    y: sanitized.y,
    width: sanitized.width,
    height: sanitized.height
  };

  if (workAreas.some((workArea) => rectanglesIntersect(savedBounds, workArea))) {
    return sanitized;
  }

  return {
    width: sanitized.width,
    height: sanitized.height,
    maximized: sanitized.maximized
  };
}

function parseWindowPreferences(raw: unknown): WindowLayoutPreferences | undefined {
  if (!isRecord(raw) || !Number.isFinite(raw.width) || !Number.isFinite(raw.height)) {
    return undefined;
  }

  const width = raw.width as number;
  const height = raw.height as number;

  return sanitizeWindowPreferences({
    x: Number.isFinite(raw.x) ? (raw.x as number) : undefined,
    y: Number.isFinite(raw.y) ? (raw.y as number) : undefined,
    width,
    height,
    maximized: raw.maximized === true
  });
}

function parsePaneLayoutPreferences(raw: unknown): PaneLayoutPreferences | undefined {
  if (
    !isRecord(raw) ||
    !Number.isFinite(raw.generalPaneWidth) ||
    !Number.isFinite(raw.sidebarWidth) ||
    !Number.isFinite(raw.inspectorHeight)
  ) {
    return undefined;
  }

  return sanitizePaneLayoutPreferences({
    generalPaneWidth: raw.generalPaneWidth as number,
    sidebarWidth: raw.sidebarWidth as number,
    inspectorHeight: raw.inspectorHeight as number
  });
}

function createDefaultLayoutPreferences(): LayoutPreferences {
  return { version: LAYOUT_PREFERENCES_VERSION };
}

function getLayoutPreferencesPath(userDataPath: string) {
  return join(userDataPath, "layout.json");
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function rectanglesIntersect(left: Rectangle, right: Rectangle) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
