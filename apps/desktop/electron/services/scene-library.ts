import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createSceneFileData,
  parseSceneFileData,
  serializeSceneDefinition,
  type SerializedSceneDefinition
} from "@lyric-video-maker/core";

export async function loadUserScenes(userDataPath: string): Promise<SerializedSceneDefinition[]> {
  const libraryDir = getSceneLibraryDir(userDataPath);
  await mkdir(libraryDir, { recursive: true });

  const entries = await readdir(libraryDir, { withFileTypes: true });
  const scenes = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const filePath = join(libraryDir, entry.name);
        const raw = JSON.parse(await readFile(filePath, "utf8"));
        const scene = parseSceneFileData(raw);
        return {
          ...scene,
          source: "user" as const,
          readOnly: false,
          filePath
        };
      })
  );

  return scenes.sort((left, right) => left.name.localeCompare(right.name));
}

export async function saveUserScene(
  userDataPath: string,
  scene: SerializedSceneDefinition
): Promise<SerializedSceneDefinition> {
  const libraryDir = getSceneLibraryDir(userDataPath);
  await mkdir(libraryDir, { recursive: true });

  const nextId =
    scene.source === "user" && !scene.readOnly && scene.id.trim()
      ? scene.id
      : createSceneId(scene.name);
  const filePath = join(libraryDir, `${nextId}.json`);
  const persistedScene: SerializedSceneDefinition = {
    ...serializeSceneDefinition(scene),
    id: nextId,
    source: "user",
    readOnly: false,
    filePath
  };

  await writeFile(filePath, JSON.stringify(createSceneFileData(persistedScene), null, 2), "utf8");
  return persistedScene;
}

export async function deleteUserScene(userDataPath: string, sceneId: string): Promise<void> {
  const filePath = join(getSceneLibraryDir(userDataPath), `${sceneId}.json`);
  await rm(filePath, { force: true });
}

export async function importUserScene(
  userDataPath: string,
  importPath: string
): Promise<SerializedSceneDefinition> {
  const raw = JSON.parse(await readFile(importPath, "utf8"));
  const scene = parseSceneFileData(raw);
  return await saveUserScene(userDataPath, {
    ...scene,
    source: "user",
    readOnly: false,
    filePath: undefined
  });
}

export async function exportSceneToFile(
  scene: SerializedSceneDefinition,
  exportPath: string
): Promise<void> {
  const exportableScene: SerializedSceneDefinition = {
    ...serializeSceneDefinition(scene),
    filePath: undefined
  };

  await writeFile(exportPath, JSON.stringify(createSceneFileData(exportableScene), null, 2), "utf8");
}

function getSceneLibraryDir(userDataPath: string) {
  return join(userDataPath, "scenes");
}

function createSceneId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  return `${slug || "scene"}-${Date.now()}`;
}
