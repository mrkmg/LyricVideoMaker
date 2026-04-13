import { spawn } from "node:child_process";
import { access, constants, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packager } from "@electron/packager";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const stageDir = join(rootDir, ".publish", "stage");
const outDir = join(rootDir, "publish");

const workspacePackages = [
  {
    name: "@lyric-video-maker/plugin-base",
    sourceDir: join(rootDir, "packages", "plugin-base"),
    stageDir: join(stageDir, "packages", "plugin-base"),
    stageDependency: "file:packages/plugin-base"
  },
  {
    name: "@lyric-video-maker/core",
    sourceDir: join(rootDir, "packages", "core"),
    stageDir: join(stageDir, "packages", "core"),
    stageDependency: "file:packages/core"
  },
  {
    name: "@lyric-video-maker/renderer",
    sourceDir: join(rootDir, "packages", "renderer"),
    stageDir: join(stageDir, "packages", "renderer"),
    stageDependency: "file:packages/renderer"
  },
  {
    name: "@lyric-video-maker/scene-registry",
    sourceDir: join(rootDir, "packages", "scene-registry"),
    stageDir: join(stageDir, "packages", "scene-registry"),
    stageDependency: "file:packages/scene-registry"
  }
];

await main();

async function main() {
  const rootPackage = await readJson(join(rootDir, "package.json"));
  const desktopPackage = await readJson(join(rootDir, "apps", "desktop", "package.json"));
  const electronPackage = await readJson(join(rootDir, "node_modules", "electron", "package.json"));

  console.log("Building workspace artifacts...");
  await runCommand(getNpmCommand(), ["run", "build"], { cwd: rootDir });

  console.log("Freezing subtitle sidecar into a standalone executable...");
  await runCommand(process.execPath, [join(rootDir, "scripts", "freeze-subtitle-sidecar.mjs")], {
    cwd: rootDir,
    shell: false
  });

  await assertFrozenSidecarExists();

  console.log("Preparing publish staging directory...");
  await rm(stageDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  await rm(outDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  await mkdir(stageDir, { recursive: true });

  await cp(join(rootDir, "apps", "desktop", "dist"), join(stageDir, "dist"), { recursive: true });
  await cp(join(rootDir, "apps", "desktop", "dist-electron"), join(stageDir, "dist-electron"), {
    recursive: true
  });

  await stageSidecars();

  for (const pkg of workspacePackages) {
    await stageWorkspacePackage(pkg);
  }

  await stageLegalDocuments();

  const stagePackage = {
    name: rootPackage.name,
    productName: "Lyric Video Maker",
    version: rootPackage.version,
    private: true,
    description: rootPackage.description ?? "Desktop lyric video renderer",
    author: rootPackage.author ?? "Kevin Gravier",
    license: rootPackage.license ?? "SEE LICENSE IN EULA.txt",
    main: "./dist-electron/main.js",
    dependencies: rewriteDesktopDependencies(desktopPackage.dependencies ?? {})
  };
  await writeJson(join(stageDir, "package.json"), stagePackage);

  console.log("Installing production dependencies into the staged app...");
  await runCommand(
    getNpmCommand(),
    ["install", "--omit=dev", "--no-audit", "--no-fund"],
    {
      cwd: stageDir
    }
  );

  await stageBundledChromium();

  console.log("Packaging the Windows app folder...");
  const packagePaths = await packager({
    dir: stageDir,
    out: outDir,
    overwrite: true,
    platform: "win32",
    arch: "x64",
    asar: false,
    prune: false,
    appVersion: rootPackage.version,
    electronVersion: electronPackage.version,
    executableName: "LyricVideoMaker",
    name: "Lyric Video Maker"
  });

  await copyLegalDocumentsNextToExecutable(packagePaths[0]);

  console.log(`Publish complete: ${packagePaths[0]}`);
}

async function assertFrozenSidecarExists() {
  const frozenExe = join(
    rootDir,
    "sidecars",
    "subtitle-aligner",
    "dist-frozen",
    "lyric-video-subtitle-aligner",
    "lyric-video-subtitle-aligner.exe"
  );
  if (!(await pathExists(frozenExe))) {
    throw new Error(
      `Frozen subtitle sidecar executable was not produced at "${frozenExe}". ` +
        "Check the PyInstaller output above for errors."
    );
  }
}

async function stageBundledChromium() {
  // Mirror the dev-cache layout under the staged app so the renderer's
  // chromium-loader finds the bundled binary at packaged-app runtime.
  const cacheSource = join(rootDir, "node_modules", ".chromium-cache");
  if (!(await pathExists(cacheSource))) {
    throw new Error(
      `Bundled Chromium cache not found at "${cacheSource}". Run "npm run setup:runtime" before publishing.`
    );
  }

  const cacheDestination = join(stageDir, ".chromium-cache");
  console.log("Staging bundled Chromium...");
  await cp(cacheSource, cacheDestination, { recursive: true });
}

async function stageSidecars() {
  // We no longer copy the entire `sidecars/` tree because that would
  // include the local .venv (which references a developer's system
  // Python install) and the source .py files. Only the frozen
  // PyInstaller output is shipped, placed under
  // `sidecars/subtitle-aligner/bin/lyric-video-subtitle-aligner/` which
  // matches the path the Electron runner expects.
  const frozenSource = join(
    rootDir,
    "sidecars",
    "subtitle-aligner",
    "dist-frozen",
    "lyric-video-subtitle-aligner"
  );
  const frozenDestination = join(
    stageDir,
    "sidecars",
    "subtitle-aligner",
    "bin",
    "lyric-video-subtitle-aligner"
  );
  await mkdir(join(stageDir, "sidecars", "subtitle-aligner", "bin"), { recursive: true });
  await cp(frozenSource, frozenDestination, { recursive: true });
}

async function stageLegalDocuments() {
  const sources = ["EULA.txt", "THIRD_PARTY_LICENSES.md"];
  for (const fileName of sources) {
    const source = join(rootDir, fileName);
    if (await pathExists(source)) {
      await cp(source, join(stageDir, fileName));
    }
  }
}

async function copyLegalDocumentsNextToExecutable(packagePath) {
  if (!packagePath) {
    return;
  }
  const sources = ["EULA.txt", "THIRD_PARTY_LICENSES.md"];
  for (const fileName of sources) {
    const source = join(rootDir, fileName);
    if (await pathExists(source)) {
      await cp(source, join(packagePath, fileName));
    }
  }
}

async function stageWorkspacePackage(pkg) {
  await mkdir(pkg.stageDir, { recursive: true });
  await cp(join(pkg.sourceDir, "dist"), join(pkg.stageDir, "dist"), { recursive: true });
  await cp(join(pkg.sourceDir, "package.json"), join(pkg.stageDir, "package.json"));

  for (const extraPath of pkg.extraPaths ?? []) {
    const source = join(pkg.sourceDir, extraPath);
    if (!(await pathExists(source))) {
      continue;
    }
    await cp(source, join(pkg.stageDir, extraPath), { recursive: true });
  }
}

function rewriteDesktopDependencies(dependencies) {
  const localPackages = new Map(
    workspacePackages.map((pkg) => [pkg.name, pkg.stageDependency])
  );
  const rewritten = {};

  for (const [dependencyName, dependencyVersion] of Object.entries(dependencies)) {
    if (dependencyName === "electron") {
      continue;
    }

    rewritten[dependencyName] = localPackages.get(dependencyName) ?? dependencyVersion;
  }

  return rewritten;
}

function getNpmCommand() {
  return "npm";
}

async function runCommand(command, args, options) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: "inherit",
      shell: options.shell ?? process.platform === "win32"
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`${command} ${args.join(" ")} exited with code ${code}.`));
    });
  });
}

async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
