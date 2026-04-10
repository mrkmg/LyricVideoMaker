import type { SerializedSceneDefinition } from "@lyric-video-maker/core";

export interface SceneCatalog {
  list(): SerializedSceneDefinition[];
  replaceAll(scenes: SerializedSceneDefinition[]): void;
  upsert(scene: SerializedSceneDefinition): void;
  remove(sceneId: string): void;
}

export function createSceneCatalog(): SceneCatalog {
  let userScenes: SerializedSceneDefinition[] = [];
  return {
    list() {
      return userScenes;
    },
    replaceAll(scenes) {
      userScenes = scenes;
    },
    upsert(scene) {
      const remaining = userScenes.filter((entry) => entry.id !== scene.id);
      userScenes = [...remaining, scene].sort((left, right) =>
        left.name.localeCompare(right.name)
      );
    },
    remove(sceneId) {
      userScenes = userScenes.filter((scene) => scene.id !== sceneId);
    }
  };
}
