import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  createLayoutPreferencesStore,
  getRestorableWindowPreferences,
  loadLayoutPreferences,
  parseLayoutPreferences
} from "../electron/services/layout-preferences";

describe("layout preferences", () => {
  const workspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.map((workspace) => rm(workspace, { recursive: true, force: true })));
    workspaces.length = 0;
  });

  it("returns defaults when the layout file does not exist", async () => {
    const workspace = await createWorkspace();

    await expect(loadLayoutPreferences(workspace)).resolves.toEqual({ version: 1 });
  });

  it("ignores malformed JSON and unsupported versions", async () => {
    const malformedWorkspace = await createWorkspace();
    await writeFile(join(malformedWorkspace, "layout.json"), "{", "utf8");

    await expect(loadLayoutPreferences(malformedWorkspace)).resolves.toEqual({ version: 1 });

    expect(parseLayoutPreferences({ version: 2, panes: { generalPaneWidth: 1 } })).toEqual({
      version: 1
    });
  });

  it("clamps loaded window and pane values", () => {
    expect(
      parseLayoutPreferences({
        version: 1,
        window: {
          x: 100,
          y: 200,
          width: 640,
          height: 480,
          maximized: true
        },
        panes: {
          generalPaneWidth: 10.2,
          sidebarWidth: 500.7,
          inspectorHeight: -50
        }
      })
    ).toEqual({
      version: 1,
      window: {
        x: 100,
        y: 200,
        width: 1200,
        height: 760,
        maximized: true
      },
      panes: {
        generalPaneWidth: 280,
        sidebarWidth: 501,
        inspectorHeight: 250
      }
    });
  });

  it("drops off-screen window coordinates while keeping size and maximized state", () => {
    expect(
      getRestorableWindowPreferences(
        {
          x: 5000,
          y: 5000,
          width: 1400,
          height: 900,
          maximized: true
        },
        [{ x: 0, y: 0, width: 1920, height: 1080 }]
      )
    ).toEqual({
      width: 1400,
      height: 900,
      maximized: true
    });
  });

  it("writes the expected versioned JSON shape", async () => {
    const workspace = await createWorkspace();
    const store = createLayoutPreferencesStore({ userDataPath: workspace });

    await store.load();
    await store.updateWindow({
      x: 40,
      y: 50,
      width: 1500,
      height: 900,
      maximized: false
    });
    await store.updatePanes({
      generalPaneWidth: 420,
      sidebarWidth: 340,
      inspectorHeight: 360
    });

    await expect(readFile(join(workspace, "layout.json"), "utf8")).resolves.toBe(
      `${JSON.stringify(
        {
          version: 1,
          window: {
            x: 40,
            y: 50,
            width: 1500,
            height: 900,
            maximized: false
          },
          panes: {
            generalPaneWidth: 420,
            sidebarWidth: 340,
            inspectorHeight: 360
          }
        },
        null,
        2
      )}`
    );
  });

  async function createWorkspace() {
    const workspace = await mkdtemp(join(tmpdir(), "layout-preferences-"));
    workspaces.push(workspace);
    return workspace;
  }
});
