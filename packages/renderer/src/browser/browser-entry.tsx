/**
 * Browser bundle entry point.
 *
 * This file is the esbuild entry for the self-contained IIFE bundle injected
 * into Chromium render pages. It imports:
 *   1. The React shell framework (react-shell.tsx)
 *   2. All built-in scene component Component functions
 *   3. All built-in modifier definitions
 *
 * Components are registered into the browser-side registry so the React shell
 * can look them up by componentId at render time; modifiers the same way.
 *
 * This file is NOT part of the renderer's normal module graph — it is bundled
 * separately by scripts/build-browser-bundle.mjs.
 */

// Shell — sets up React root, mount/update globals, readiness scanning
import React from "react";
import "./react-shell";

// Plugin-base runtime helpers — re-exposed to external plugins via host.pluginBase
// so plugins can `import { useContainerSize } from "@lyric-video-maker/plugin-base"`
// without bundling their own React. tsup externalizes plugin-base in plugin
// builds; the loader's require shim resolves it to this namespace.
import * as pluginBaseRuntime from "@lyric-video-maker/plugin-base";

// Built-in component definitions (all browser-safe — no Node.js deps)
// Paths use the ~scene-registry alias resolved by the build script.
import { backgroundColorComponent } from "~scene-registry/components/background-color";
import { imageComponent } from "~scene-registry/components/image/component";
import { shapeComponent } from "~scene-registry/components/shape/component";
import { staticTextComponent } from "~scene-registry/components/static-text/component";
import { equalizerComponent } from "~scene-registry/components/equalizer/component";
import { lyricsByLineComponent } from "~scene-registry/components/lyrics-by-line/component";
import { slideshowComponent } from "~scene-registry/components/slideshow/component";

// Video uses a separate react-component file to avoid pulling in prepare→probe→child_process
import { VideoRenderComponent } from "~scene-registry/components/video/react-component";

// Built-in modifier definitions
import {
  transformModifier,
  timingModifier,
  opacityModifier,
  visibilityModifier
} from "~scene-registry/modifiers";

// Register all built-in components
const register = (window as any).__registerReactComponent;

register("background-color", backgroundColorComponent.Component);
register("image", imageComponent.Component);
register("shape", shapeComponent.Component);
register("static-text", staticTextComponent.Component);
register("equalizer", equalizerComponent.Component);
register("lyrics-by-line", lyricsByLineComponent.Component);
register("video", VideoRenderComponent);
register("slideshow", slideshowComponent.Component);

// Register all built-in modifiers
const registerModifier = (window as any).__registerModifier;
registerModifier(transformModifier.id, transformModifier);
registerModifier(timingModifier.id, timingModifier);
registerModifier(opacityModifier.id, opacityModifier);
registerModifier(visibilityModifier.id, visibilityModifier);

// Plugin host factory — used by activatePluginInBrowser to provide
// the host object that external plugins receive in activate(host).
(window as any).__getPluginHost = function () {
  return {
    React,
    core: {},
    modifiers: {
      register(definition: { id: string }) {
        if (!definition || typeof definition !== "object" || !definition.id) return;
        registerModifier(definition.id, definition);
      }
    },
    // Runtime bag exposed to the loader's require shim. Plugins import from
    // "@lyric-video-maker/plugin-base" and the shim returns this object so
    // the host's React (and plugin-base build) is reused — no duplicate React.
    pluginBase: pluginBaseRuntime
  };
};
