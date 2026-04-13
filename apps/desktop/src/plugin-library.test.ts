import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  copyPluginFixtureToLocalDir,
  importPluginFromSource,
  loadInstalledPlugins,
  removePlugin,
  updatePlugin
} from "../electron/services/plugin-library";

const fixtureDir = join(process.cwd(), "examples", "external-plugin-basic");
const tempDirs: string[] = [];

describe("external plugin library", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("imports, persists, reloads, and removes the example plugin", async () => {
    const { sourceDir, userDataPath } = await createLocalFixture();

    const plugin = await importPluginFromSource(userDataPath, sourceDir);

    expect(plugin.summary.id).toBe("example.caption-pack");
    expect(plugin.components.map((component) => component.id)).toEqual(["example.caption-box"]);
    expect(plugin.scenes.map((scene) => scene.id)).toEqual(["example.caption-demo"]);
    expect(existsSync(plugin.summary.repoDir)).toBe(true);
    expect(existsSync(join(plugin.summary.repoDir, "node_modules"))).toBe(false);

    const reloaded = await loadInstalledPlugins(userDataPath);
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].summary.id).toBe("example.caption-pack");

    await removePlugin(userDataPath, "example.caption-pack");

    expect(await loadInstalledPlugins(userDataPath)).toEqual([]);
    expect(existsSync(plugin.summary.repoDir)).toBe(false);
  });

  it("rejects plugin manifest entry paths that escape the repository", async () => {
    const { sourceDir, userDataPath } = await createLocalFixture();
    await writeFile(
      join(sourceDir, "lyric-video-plugin.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          id: "example.bad-pack",
          name: "Bad Pack",
          version: "0.1.0",
          entry: "../outside.cjs",
          components: ["example.caption-box"],
          scenes: ["example.caption-demo"]
        },
        null,
        2
      ),
      "utf8"
    );

    await expect(importPluginFromSource(userDataPath, sourceDir)).rejects.toThrow(
      "escapes the repository"
    );
  });

  it("updates a plugin from a changed local source", async () => {
    const { sourceDir, userDataPath } = await createLocalFixture();

    const plugin = await importPluginFromSource(userDataPath, sourceDir);
    expect(plugin.summary.version).toBe("0.1.0");

    // Bump version in the source fixture
    const manifestPath = join(sourceDir, "lyric-video-plugin.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.version = "0.2.0";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    const updated = await updatePlugin(userDataPath, plugin.summary.id);
    expect(updated.summary.version).toBe("0.2.0");
    expect(updated.summary.id).toBe("example.caption-pack");
    expect(existsSync(updated.summary.repoDir)).toBe(true);

    const reloaded = await loadInstalledPlugins(userDataPath);
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].summary.version).toBe("0.2.0");
  });

  it("rejects update when plugin id changes", async () => {
    const { sourceDir, userDataPath } = await createLocalFixture();

    await importPluginFromSource(userDataPath, sourceDir);

    const manifestPath = join(sourceDir, "lyric-video-plugin.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.id = "example.different-pack";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    await expect(updatePlugin(userDataPath, "example.caption-pack")).rejects.toThrow(
      "does not match installed id"
    );

    // Original plugin still intact
    const reloaded = await loadInstalledPlugins(userDataPath);
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].summary.id).toBe("example.caption-pack");
  });

  it("rejects component id conflicts", async () => {
    const { sourceDir, userDataPath } = await createLocalFixture();

    await expect(
      importPluginFromSource(userDataPath, sourceDir, {
        existingComponentIds: ["example.caption-box"]
      })
    ).rejects.toThrow('Plugin component id "example.caption-box" conflicts');
  });
});

async function createLocalFixture() {
  const root = await mkdtemp(join(tmpdir(), "lvm-plugin-test-"));
  tempDirs.push(root);
  const sourceDir = join(root, "source");
  const userDataPath = join(root, "userData");
  await copyPluginFixtureToLocalDir(fixtureDir, sourceDir);
  return { sourceDir, userDataPath };
}
