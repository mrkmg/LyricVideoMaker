# @lyric-video-maker/plugin-base

Plugin SDK for [Lyric Video Maker](https://github.com/mrkmg/LyricVideoMaker). Provides TypeScript types, transform utilities, and timing helpers for building external plugins.

## Install

```bash
npm install --save-dev @lyric-video-maker/plugin-base
```

React is a peer dependency:

```bash
npm install --save-dev react
```

## Quick Start

Create a plugin entry point that exports an `activate` function:

```typescript
import type {
  LyricVideoPluginActivation,
  LyricVideoPluginHost,
  SceneComponentDefinition,
  TransformOptions,
  TimingOptions,
} from "@lyric-video-maker/plugin-base";

interface MyOptions extends TransformOptions, TimingOptions, Record<string, unknown> {
  textColor: string;
}

export function activate(host: LyricVideoPluginHost): LyricVideoPluginActivation {
  const { React } = host;
  const {
    transformCategory, timingCategory,
    DEFAULT_TRANSFORM_OPTIONS, DEFAULT_TIMING_OPTIONS,
    computeTransformStyle, computeTimingOpacity,
  } = host.transform;

  const component: SceneComponentDefinition<MyOptions> = {
    id: "myplugin.hello",
    name: "Hello World",
    options: [
      transformCategory,
      timingCategory,
      { id: "textColor", label: "Text Color", type: "color", defaultValue: "#ffffff" },
    ],
    defaultOptions: {
      ...DEFAULT_TRANSFORM_OPTIONS,
      ...DEFAULT_TIMING_OPTIONS,
      textColor: "#ffffff",
    },
    Component({ options, video, timeMs }) {
      const style = {
        ...computeTransformStyle(options, video),
        opacity: computeTimingOpacity(timeMs, options),
        color: options.textColor,
        fontSize: 48,
      };
      return React.createElement("div", { style }, "Hello from my plugin!");
    },
  };

  return { components: [component], scenes: [] };
}
```

Bundle to CommonJS (e.g. with [tsup](https://tsup.egoist.dev)):

```bash
npx tsup src/plugin.ts --format cjs --out-dir dist --out-extension .cjs
```

## What's Included

- **Types** -- `SceneComponentDefinition`, `SceneDefinition`, `LyricVideoPluginHost`, render props, option schema types, lyric runtime, video settings, and more.
- **Transform system** -- `computeTransformStyle()`, `DEFAULT_TRANSFORM_OPTIONS`, `transformCategory` option group for positioning, rotation, and flipping.
- **Timing system** -- `computeTimingOpacity()`, `DEFAULT_TIMING_OPTIONS`, `timingCategory` option group for visibility windows and fade effects.

## Documentation

Full plugin authoring guide: [PLUGINS.md](https://github.com/mrkmg/LyricVideoMaker/blob/main/PLUGINS.md)

Docs site: [mrkmg.github.io/LyricVideoMaker](https://mrkmg.github.io/LyricVideoMaker/)

## License

MIT
