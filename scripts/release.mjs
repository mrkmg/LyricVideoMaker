#!/usr/bin/env node

/**
 * Bump the version in every workspace package.json, create a git commit, and
 * tag it.  Push the tag to trigger CI (GitHub Release + npm publish).
 *
 * Usage:
 *   node scripts/release.mjs <version>
 *   node scripts/release.mjs 1.0.0
 *
 * What it does:
 *   1. Validates the version string (semver, no "v" prefix).
 *   2. Writes the version into every package.json in the monorepo.
 *   3. Stages the changed files, commits "release: v<version>", and tags "v<version>".
 *   4. Prints the push command — does NOT push automatically.
 */

import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));

// All package.json files that should carry the project version.
const packagePaths = [
  "package.json",
  "apps/desktop/package.json",
  "packages/core/package.json",
  "packages/plugin-base/package.json",
  "packages/renderer/package.json",
  "packages/scene-registry/package.json",
];

const version = process.argv[2];

if (!version) {
  console.error("Usage: node scripts/release.mjs <version>");
  console.error("Example: node scripts/release.mjs 1.0.0");
  process.exit(1);
}

if (version.startsWith("v")) {
  console.error('Version should not start with "v". Pass just the number, e.g. 1.0.0');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(version)) {
  console.error(`Invalid semver: "${version}"`);
  process.exit(1);
}

// Check for clean working tree
const status = execSync("git status --porcelain", { cwd: rootDir, encoding: "utf8" }).trim();
if (status) {
  console.error("Working tree is not clean. Commit or stash changes first.");
  console.error(status);
  process.exit(1);
}

// Update every package.json
const tag = `v${version}`;
console.log(`Setting version ${version} across ${packagePaths.length} packages...`);

for (const relative of packagePaths) {
  const absolute = join(rootDir, relative);
  const raw = await readFile(absolute, "utf8");
  const pkg = JSON.parse(raw);
  pkg.version = version;
  await writeFile(absolute, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(`  ${relative} -> ${version}`);
}

// Stage, commit, tag
execSync(`git add ${packagePaths.join(" ")}`, { cwd: rootDir, stdio: "inherit" });
execSync(`git commit -m "release: ${tag}"`, { cwd: rootDir, stdio: "inherit" });
execSync(`git tag ${tag}`, { cwd: rootDir, stdio: "inherit" });

console.log(`\nDone. Tagged ${tag}.`);
console.log(`\nTo publish, push the tag:\n`);
console.log(`  git push origin main ${tag}`);
