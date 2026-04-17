import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import {
  cp,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import * as Core from "@lyric-video-maker/core";
import type {
  ModifierDefinition,
  SceneComponentDefinition,
  SceneDefinition
} from "@lyric-video-maker/core";
import React from "react";
import * as ReactDOM from "react-dom";
import * as PluginBaseRuntime from "@lyric-video-maker/plugin-base";
import {
  builtInModifiers,
  builtInSceneComponents,
  builtInScenes
} from "@lyric-video-maker/scene-registry";

const execFileAsync = promisify(execFile);
const MANIFEST_FILE = "lyric-video-plugin.json";
const PLUGINS_FILE = "plugins.json";
const PLUGIN_SCHEMA_VERSION = 1;

export interface InstalledPluginSummary {
  id: string;
  name: string;
  version: string;
  url: string;
  repoDir: string;
  componentCount: number;
  sceneCount: number;
  loadError?: string;
}

export interface LoadedPlugin {
  summary: InstalledPluginSummary;
  components: SceneComponentDefinition<Record<string, unknown>>[];
  modifiers: ModifierDefinition<Record<string, unknown>>[];
  scenes: SceneDefinition[];
  bundleSource: string;
}

export interface LoadInstalledPluginsResult {
  loaded: LoadedPlugin[];
  failed: InstalledPluginSummary[];
}

interface PluginManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  entry: string;
  components: string[];
  modifiers: string[];
  scenes: string[];
}

interface LoadInstalledPluginOptions {
  existingComponentIds?: Iterable<string>;
  existingSceneIds?: Iterable<string>;
}

interface ImportPluginOptions {
  existingComponentIds?: Iterable<string>;
  existingSceneIds?: Iterable<string>;
}

interface InstalledPluginFile {
  plugins: InstalledPluginSummary[];
}

interface PluginModule {
  activate?: (host: PluginHost) => PluginActivationResult;
}

interface PluginHost {
  React: typeof React;
  core: typeof Core;
  modifiers: {
    register(definition: ModifierDefinition<Record<string, unknown>>): void;
  };
}

interface PluginActivationResult {
  components?: unknown;
  modifiers?: unknown;
  scenes?: unknown;
}

export async function loadInstalledPlugins(
  userDataPath: string,
  options: LoadInstalledPluginOptions = {}
): Promise<LoadedPlugin[]> {
  const { loaded } = await loadInstalledPluginsWithStatus(userDataPath, options);
  return loaded;
}

export async function loadInstalledPluginsWithStatus(
  userDataPath: string,
  options: LoadInstalledPluginOptions = {}
): Promise<LoadInstalledPluginsResult> {
  const summaries = await readInstalledPluginSummaries(userDataPath);
  const settled = await Promise.allSettled(
    summaries.map((summary) => loadPluginFromRepo(summary.url, summary.repoDir))
  );
  const loaded: LoadedPlugin[] = [];
  const failed: InstalledPluginSummary[] = [];
  settled.forEach((result, index) => {
    const summary = summaries[index];
    if (result.status === "fulfilled") {
      loaded.push(result.value);
    } else {
      const message = result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);
      console.warn(
        `Plugin "${summary?.id ?? "(unknown)"}" failed to load and was skipped: ${message}`
      );
      if (summary) {
        failed.push({ ...summary, loadError: message });
      }
    }
  });
  validatePluginSet(loaded, { ...options, strict: false });
  return { loaded, failed };
}

export async function importPluginFromSource(
  userDataPath: string,
  url: string,
  options: ImportPluginOptions = {}
): Promise<LoadedPlugin> {
  const source = await resolveImportSource(url);

  const rootDir = getPluginRootDir(userDataPath);
  const tmpDir = join(rootDir, "tmp", `plugin-import-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  try {
    if (source.kind === "github") {
      await execFileAsync("git", ["clone", "--depth", "1", source.url, tmpDir], {
        windowsHide: true
      });
    } else {
      await copyLocalPluginSource(source.path, tmpDir);
    }

    const manifest = await readPluginManifest(tmpDir);
    const safeId = createSafePluginId(manifest.id);
    const repoDir = join(getPluginRepoRootDir(userDataPath), safeId);
    if (existsSync(repoDir)) {
      throw new Error(`Plugin "${manifest.id}" is already installed.`);
    }

    const existingPluginIds = new Set(
      (await readInstalledPluginSummaries(userDataPath)).map((plugin) => plugin.id)
    );
    if (existingPluginIds.has(manifest.id)) {
      throw new Error(`Plugin "${manifest.id}" is already installed.`);
    }

    await mkdir(getPluginRepoRootDir(userDataPath), { recursive: true });
    await rename(tmpDir, repoDir);

    try {
      const plugin = await loadPluginFromRepo(url, repoDir);
      validatePluginSet([plugin], options);
      const summaries = await readInstalledPluginSummaries(userDataPath);
      await writeInstalledPluginSummaries(userDataPath, [...summaries, plugin.summary]);
      return plugin;
    } catch (error) {
      await rm(repoDir, { recursive: true, force: true });
      throw error;
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export async function updatePlugin(
  userDataPath: string,
  pluginId: string,
  options: ImportPluginOptions = {}
): Promise<LoadedPlugin> {
  const summaries = await readInstalledPluginSummaries(userDataPath);
  const existing = summaries.find((plugin) => plugin.id === pluginId);
  if (!existing) {
    throw new Error(`Plugin "${pluginId}" is not installed.`);
  }

  const source = await resolveImportSource(existing.url);
  const rootDir = getPluginRootDir(userDataPath);
  const tmpDir = join(rootDir, "tmp", `plugin-update-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  try {
    if (source.kind === "github") {
      await execFileAsync("git", ["clone", "--depth", "1", source.url, tmpDir], {
        windowsHide: true
      });
    } else {
      await copyLocalPluginSource(source.path, tmpDir);
    }

    const manifest = await readPluginManifest(tmpDir);
    if (manifest.id !== pluginId) {
      throw new Error(
        `Updated plugin id "${manifest.id}" does not match installed id "${pluginId}".`
      );
    }

    const plugin = await loadPluginFromRepo(existing.url, tmpDir);
    validatePluginSet([plugin], options);

    const repoDir = resolve(existing.repoDir);
    const repoRoot = resolve(getPluginRepoRootDir(userDataPath));
    if (!isPathInside(repoRoot, repoDir)) {
      throw new Error(`Refusing to update plugin repo outside plugin directory: ${existing.repoDir}`);
    }

    await rm(repoDir, { recursive: true, force: true });
    await rename(tmpDir, repoDir);

    const updated = await loadPluginFromRepo(existing.url, repoDir);
    const nextSummaries = summaries.map((s) => (s.id === pluginId ? updated.summary : s));
    await writeInstalledPluginSummaries(userDataPath, nextSummaries);
    return updated;
  } catch (error) {
    await rm(tmpDir, { recursive: true, force: true });
    throw error;
  }
}

export async function removePlugin(userDataPath: string, pluginId: string): Promise<void> {
  const summaries = await readInstalledPluginSummaries(userDataPath);
  const summary = summaries.find((plugin) => plugin.id === pluginId);
  if (!summary) {
    return;
  }
  const repoDir = resolve(summary.repoDir);
  const repoRoot = resolve(getPluginRepoRootDir(userDataPath));
  if (!isPathInside(repoRoot, repoDir)) {
    throw new Error(`Refusing to remove plugin repo outside plugin directory: ${summary.repoDir}`);
  }

  await writeInstalledPluginSummaries(
    userDataPath,
    summaries.filter((plugin) => plugin.id !== pluginId)
  );
  await rm(repoDir, { recursive: true, force: true });
}

export function getPluginRootDir(userDataPath: string) {
  return join(userDataPath, "plugins");
}

export function getPluginRepoRootDir(userDataPath: string) {
  return join(getPluginRootDir(userDataPath), "repos");
}

async function loadPluginFromRepo(url: string, repoDir: string): Promise<LoadedPlugin> {
  const manifest = await readPluginManifest(repoDir);
  const entryPath = resolveManifestPath(repoDir, manifest.entry, "entry");
  const bundleSource = await readFile(entryPath, "utf-8");
  const moduleExports = loadPluginModule(entryPath, bundleSource);
  const registeredModifiers: ModifierDefinition<Record<string, unknown>>[] = [];
  const activation = moduleExports.activate?.({
    React,
    core: Core,
    modifiers: {
      register(definition) {
        registeredModifiers.push(definition);
      }
    }
  });

  if (!activation || typeof activation !== "object") {
    throw new Error(`Plugin "${manifest.id}" activate() did not return a plugin definition.`);
  }

  const components = parseComponentDefinitions(manifest, activation.components);
  const scenes = parseSceneDefinitions(manifest, activation.scenes);
  const modifiersFromActivation = parseModifierDefinitions(manifest, activation.modifiers);
  const modifiers = [...registeredModifiers, ...modifiersFromActivation];

  return {
    summary: {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      url,
      repoDir,
      componentCount: components.length,
      sceneCount: scenes.length
    },
    components,
    modifiers,
    scenes,
    bundleSource
  };
}

function loadPluginModule(entryPath: string, source: string): PluginModule {
  // Plugin bundles externalize `react`, `react-dom`, and
  // `@lyric-video-maker/plugin-base` — see PLUGINS.md. The host supplies
  // its own copies of each through this require shim so the plugin
  // module's `require(...)` calls resolve even though the plugin repo
  // has no node_modules. Anything else falls back to a normal
  // createRequire scoped to the plugin's entry path so the plugin can
  // still load files next to itself if it ever needs to.
  const fallback = createRequire(entryPath);
  const shim = (specifier: string): unknown => {
    if (specifier === "react") return React;
    if (specifier === "react-dom") return ReactDOM;
    if (specifier === "@lyric-video-maker/plugin-base") return PluginBaseRuntime;
    return fallback(specifier);
  };
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const wrapper = new Function("module", "exports", "require", source);
  try {
    wrapper(mod, mod.exports, shim);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Plugin entry "${entryPath}" threw during load: ${message}`);
  }
  const moduleExports = mod.exports as PluginModule;
  if (!moduleExports || typeof moduleExports !== "object") {
    throw new Error(`Plugin entry "${entryPath}" did not export an object.`);
  }
  if (typeof moduleExports.activate !== "function") {
    throw new Error(`Plugin entry "${entryPath}" must export activate(host).`);
  }
  return moduleExports;
}

async function readPluginManifest(repoDir: string): Promise<PluginManifest> {
  const manifestPath = join(repoDir, MANIFEST_FILE);
  const raw = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  if (!raw || typeof raw !== "object") {
    throw new Error("Plugin manifest is not a valid object.");
  }

  const manifest = raw as Partial<PluginManifest>;
  if (manifest.schemaVersion !== PLUGIN_SCHEMA_VERSION) {
    throw new Error(`Unsupported plugin schema version "${String(manifest.schemaVersion)}".`);
  }
  if (!manifest.id || !manifest.name || !manifest.version || !manifest.entry) {
    throw new Error("Plugin manifest is missing required fields.");
  }
  if (!Array.isArray(manifest.components) || !Array.isArray(manifest.scenes)) {
    throw new Error("Plugin manifest components and scenes must be arrays.");
  }

  const parsed: PluginManifest = {
    schemaVersion: PLUGIN_SCHEMA_VERSION,
    id: String(manifest.id),
    name: String(manifest.name),
    version: String(manifest.version),
    entry: String(manifest.entry),
    components: manifest.components.map(String),
    modifiers: Array.isArray(manifest.modifiers) ? manifest.modifiers.map(String) : [],
    scenes: manifest.scenes.map(String)
  };

  if (!parsed.id.includes(".")) {
    throw new Error(`Plugin id "${parsed.id}" must be namespaced.`);
  }
  resolveManifestPath(repoDir, parsed.entry, "entry");
  return parsed;
}

function parseComponentDefinitions(
  manifest: PluginManifest,
  rawComponents: unknown
): SceneComponentDefinition<Record<string, unknown>>[] {
  if (!Array.isArray(rawComponents)) {
    throw new Error(`Plugin "${manifest.id}" must return a components array.`);
  }

  const components = rawComponents.map((component) => {
    const candidate = component as Partial<SceneComponentDefinition<Record<string, unknown>>>;
    if (!candidate || typeof candidate !== "object") {
      throw new Error(`Plugin "${manifest.id}" returned an invalid component.`);
    }
    if (!candidate.id || !candidate.name || typeof candidate.Component !== "function") {
      throw new Error(`Plugin "${manifest.id}" component is missing id, name, or Component.`);
    }
    if (!Array.isArray(candidate.options)) {
      throw new Error(`Plugin "${manifest.id}" component "${candidate.id}" options must be an array.`);
    }
    if (!isSerializable(candidate.defaultOptions ?? {})) {
      throw new Error(
        `Plugin "${manifest.id}" component "${candidate.id}" defaultOptions must be serializable.`
      );
    }
    return candidate as SceneComponentDefinition<Record<string, unknown>>;
  });

  assertIdSetMatches(
    manifest.components,
    components.map((component) => component.id),
    `Plugin "${manifest.id}" component`
  );
  return components;
}

function parseModifierDefinitions(
  manifest: PluginManifest,
  rawModifiers: unknown
): ModifierDefinition<Record<string, unknown>>[] {
  if (rawModifiers === undefined) {
    assertIdSetMatches(manifest.modifiers, [], `Plugin "${manifest.id}" modifier`);
    return [];
  }
  if (!Array.isArray(rawModifiers)) {
    throw new Error(`Plugin "${manifest.id}" modifiers must be an array.`);
  }

  const modifiers = rawModifiers.map((modifier) => {
    const candidate = modifier as Partial<ModifierDefinition<Record<string, unknown>>>;
    if (!candidate || typeof candidate !== "object") {
      throw new Error(`Plugin "${manifest.id}" returned an invalid modifier.`);
    }
    if (!candidate.id || !candidate.name || typeof candidate.apply !== "function") {
      throw new Error(
        `Plugin "${manifest.id}" modifier is missing id, name, or apply().`
      );
    }
    if (!Array.isArray(candidate.options)) {
      throw new Error(
        `Plugin "${manifest.id}" modifier "${candidate.id}" options must be an array.`
      );
    }
    if (!isSerializable(candidate.defaultOptions ?? {})) {
      throw new Error(
        `Plugin "${manifest.id}" modifier "${candidate.id}" defaultOptions must be serializable.`
      );
    }
    return candidate as ModifierDefinition<Record<string, unknown>>;
  });

  assertIdSetMatches(
    manifest.modifiers,
    modifiers.map((modifier) => modifier.id),
    `Plugin "${manifest.id}" modifier`
  );
  return modifiers;
}

function parseSceneDefinitions(
  manifest: PluginManifest,
  rawScenes: unknown
): SceneDefinition[] {
  if (!Array.isArray(rawScenes)) {
    throw new Error(`Plugin "${manifest.id}" must return a scenes array.`);
  }

  const scenes = rawScenes.map((scene) => {
    const candidate = scene as Partial<SceneDefinition>;
    if (!candidate || typeof candidate !== "object") {
      throw new Error(`Plugin "${manifest.id}" returned an invalid scene.`);
    }
    if (!candidate.id || !candidate.name || !Array.isArray(candidate.components)) {
      throw new Error(`Plugin "${manifest.id}" scene is missing id, name, or components.`);
    }
    return {
      id: String(candidate.id),
      name: String(candidate.name),
      description: candidate.description ? String(candidate.description) : undefined,
      source: "plugin" as const,
      readOnly: true,
      filePath: undefined,
      components: candidate.components
    } satisfies SceneDefinition;
  });

  assertIdSetMatches(
    manifest.scenes,
    scenes.map((scene) => scene.id),
    `Plugin "${manifest.id}" scene`
  );
  return scenes;
}

function validatePluginSet(
  plugins: LoadedPlugin[],
  options: LoadInstalledPluginOptions & { strict?: boolean }
) {
  const strict = options.strict ?? true;
  const componentIds = new Set([
    ...builtInSceneComponents.map((component) => component.id),
    ...(options.existingComponentIds ?? [])
  ]);
  const sceneIds = new Set([
    ...builtInScenes.map((scene) => scene.id),
    ...(options.existingSceneIds ?? [])
  ]);
  const modifierIds = new Set(builtInModifiers.map((modifier) => modifier.id));
  const pluginComponentIds = new Set<string>();
  const pluginModifierIds = new Set<string>();

  for (const plugin of plugins) {
    for (const component of plugin.components) {
      if (componentIds.has(component.id) || pluginComponentIds.has(component.id)) {
        throw new Error(`Plugin component id "${component.id}" conflicts with another component.`);
      }
      componentIds.add(component.id);
      pluginComponentIds.add(component.id);
    }
    for (const modifier of plugin.modifiers) {
      if (modifierIds.has(modifier.id) || pluginModifierIds.has(modifier.id)) {
        throw new Error(`Plugin modifier id "${modifier.id}" conflicts with another modifier.`);
      }
      modifierIds.add(modifier.id);
      pluginModifierIds.add(modifier.id);
    }
  }

  for (const plugin of plugins) {
    const validScenes: SceneDefinition[] = [];
    for (const scene of plugin.scenes) {
      if (sceneIds.has(scene.id)) {
        if (strict) {
          throw new Error(`Plugin scene id "${scene.id}" conflicts with another scene.`);
        }
        console.warn(`Plugin "${plugin.summary.id}": scene "${scene.id}" conflicts with another scene, skipping.`);
        continue;
      }
      const unknownRef = scene.components.find(
        (instance) => !componentIds.has(instance.componentId)
      );
      if (unknownRef) {
        if (strict) {
          throw new Error(
            `Plugin scene "${scene.id}" references unknown component "${unknownRef.componentId}".`
          );
        }
        console.warn(
          `Plugin "${plugin.summary.id}": scene "${scene.id}" references unknown component "${unknownRef.componentId}", skipping.`
        );
        continue;
      }
      sceneIds.add(scene.id);
      validScenes.push(scene);
    }
    plugin.scenes = validScenes;
  }
}

type PluginImportSource =
  | { kind: "github"; url: string }
  | { kind: "local"; path: string };

async function resolveImportSource(url: string): Promise<PluginImportSource> {
  if (isGithubHttpsUrl(url)) {
    return { kind: "github", url };
  }
  if (url.startsWith("file://")) {
    const path = fileURLToPath(url);
    await assertLocalPluginDir(path);
    return { kind: "local", path };
  }
  await assertLocalPluginDir(url);
  return { kind: "local", path: url };
}

async function assertLocalPluginDir(path: string) {
  try {
    const sourceStat = await stat(path);
    if (sourceStat.isDirectory()) {
      return;
    }
  } catch {
    // Fall through to user-facing error.
  }
  throw new Error("Plugin URL must be a GitHub HTTPS URL or a local plugin folder.");
}

async function copyLocalPluginSource(sourceDir: string, targetDir: string) {
  const sourceRoot = resolve(sourceDir);
  await cp(sourceRoot, targetDir, {
    recursive: true,
    filter: (sourcePath) => shouldCopyLocalPluginPath(sourceRoot, sourcePath)
  });
}

function shouldCopyLocalPluginPath(sourceRoot: string, sourcePath: string) {
  const relativePath = relative(sourceRoot, sourcePath);
  if (!relativePath) {
    return true;
  }
  return !relativePath.split(/[\\/]+/).some((part) => part === ".git" || part === "node_modules");
}

function isGithubHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "github.com" &&
      url.pathname.split("/").filter(Boolean).length >= 2
    );
  } catch {
    return false;
  }
}

function resolveManifestPath(repoDir: string, manifestPath: string, label: string) {
  if (isAbsolute(manifestPath)) {
    throw new Error(`Plugin manifest ${label} must be relative.`);
  }
  const resolved = resolve(repoDir, manifestPath);
  const relativePath = relative(repoDir, resolved);
  if (!isPathInside(repoDir, resolved)) {
    throw new Error(`Plugin manifest ${label} escapes the repository.`);
  }
  return resolved;
}

function isPathInside(parentDir: string, childPath: string) {
  const relativePath = relative(parentDir, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

async function readInstalledPluginSummaries(userDataPath: string): Promise<InstalledPluginSummary[]> {
  const filePath = getInstalledPluginsPath(userDataPath);
  if (!existsSync(filePath)) {
    return [];
  }
  const raw = JSON.parse(await readFile(filePath, "utf8")) as Partial<InstalledPluginFile>;
  if (!raw || !Array.isArray(raw.plugins)) {
    return [];
  }
  return raw.plugins.map((plugin) => ({
    id: String(plugin.id),
    name: String(plugin.name),
    version: String(plugin.version),
    url: String(plugin.url),
    repoDir: String(plugin.repoDir),
    componentCount: Number(plugin.componentCount) || 0,
    sceneCount: Number(plugin.sceneCount) || 0
  }));
}

async function writeInstalledPluginSummaries(
  userDataPath: string,
  plugins: InstalledPluginSummary[]
) {
  await mkdir(getPluginRootDir(userDataPath), { recursive: true });
  await writeFile(
    getInstalledPluginsPath(userDataPath),
    JSON.stringify({ plugins: plugins.sort((a, b) => a.name.localeCompare(b.name)) }, null, 2),
    "utf8"
  );
}

function getInstalledPluginsPath(userDataPath: string) {
  return join(getPluginRootDir(userDataPath), PLUGINS_FILE);
}

function createSafePluginId(pluginId: string) {
  const lastSegment = pluginId.split(".").at(-1) || basename(pluginId);
  const slug = lastSegment
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
  return slug || "plugin";
}

function assertIdSetMatches(expected: string[], actual: string[], label: string) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  if (expectedSet.size !== expected.length || actualSet.size !== actual.length) {
    throw new Error(`${label} ids must be unique.`);
  }
  for (const id of expectedSet) {
    if (!actualSet.has(id)) {
      throw new Error(`${label} "${id}" is listed in manifest but not exported.`);
    }
  }
  for (const id of actualSet) {
    if (!expectedSet.has(id)) {
      throw new Error(`${label} "${id}" is exported but not listed in manifest.`);
    }
  }
}

function isSerializable(value: unknown) {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

export async function copyPluginFixtureToLocalDir(sourceDir: string, targetDir: string) {
  await copyLocalPluginSource(sourceDir, targetDir);
}
