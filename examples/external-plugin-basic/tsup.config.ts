import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/plugin.ts"],
  format: ["cjs"],
  outDir: "dist",
  clean: true,
  dts: false,
  // Plugin bundles are `new Function`-evaluated inside headless Chromium,
  // where `process` does not exist and where the host already ships its own
  // React + plugin-base runtime. Externalize both so the plugin CJS emits
  // require("react") / require("@lyric-video-maker/plugin-base") calls that
  // the host loader's require shim resolves to the host copies.
  external: ["react", "react-dom", "@lyric-video-maker/plugin-base"],
  outExtension() {
    return { js: ".cjs" };
  }
});
