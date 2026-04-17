import type {
  ModifierDefinition,
  SceneComponentDefinition,
  SceneDefinition
} from "@lyric-video-maker/core";
import type { InstalledPluginSummary, LoadedPlugin } from "./plugin-library";

export interface PluginCatalog {
  list(): InstalledPluginSummary[];
  components(): SceneComponentDefinition<Record<string, unknown>>[];
  modifiers(): ModifierDefinition<Record<string, unknown>>[];
  scenes(): SceneDefinition[];
  pluginBundleSources(): string[];
  getRepoDirs(): Map<string, string>;
  replaceAll(plugins: LoadedPlugin[], failed?: InstalledPluginSummary[]): void;
  upsert(plugin: LoadedPlugin): void;
  remove(pluginId: string): void;
}

export function createPluginCatalog(): PluginCatalog {
  let plugins: LoadedPlugin[] = [];
  let failedSummaries: InstalledPluginSummary[] = [];

  return {
    list() {
      return sortSummaries([
        ...plugins.map((plugin) => plugin.summary),
        ...failedSummaries
      ]);
    },
    components() {
      return plugins.flatMap((plugin) => plugin.components);
    },
    modifiers() {
      return plugins.flatMap((plugin) => plugin.modifiers ?? []);
    },
    scenes() {
      return plugins.flatMap((plugin) => plugin.scenes);
    },
    pluginBundleSources() {
      return plugins.map((plugin) => plugin.bundleSource);
    },
    getRepoDirs() {
      const entries: [string, string][] = [
        ...plugins.map((plugin) => [plugin.summary.id, plugin.summary.repoDir] as [string, string]),
        ...failedSummaries.map((summary) => [summary.id, summary.repoDir] as [string, string])
      ];
      return new Map(entries);
    },
    replaceAll(nextPlugins, nextFailed = []) {
      plugins = sortPlugins(nextPlugins);
      failedSummaries = [...nextFailed];
    },
    upsert(plugin) {
      plugins = sortPlugins([
        ...plugins.filter((entry) => entry.summary.id !== plugin.summary.id),
        plugin
      ]);
      failedSummaries = failedSummaries.filter((summary) => summary.id !== plugin.summary.id);
    },
    remove(pluginId) {
      plugins = plugins.filter((plugin) => plugin.summary.id !== pluginId);
      failedSummaries = failedSummaries.filter((summary) => summary.id !== pluginId);
    }
  };
}

function sortPlugins(plugins: LoadedPlugin[]) {
  return [...plugins].sort((left, right) => left.summary.name.localeCompare(right.summary.name));
}

function sortSummaries(summaries: InstalledPluginSummary[]) {
  return [...summaries].sort((left, right) => left.name.localeCompare(right.name));
}
