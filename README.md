# Lyric Video Maker

Desktop application for creating lyric videos. Load a song and subtitle file, pick a scene, customize the look, and render to MP4.

Built with Electron, React, headless Chromium, and ffmpeg.

## Features

- Import MP3 audio with SRT or generated subtitles
- Built-in subtitle alignment via Whisper (bundled sidecar)
- Scene editor with live preview
- Built-in scene components: backgrounds, lyrics display, equalizer, shapes, static text, images, video overlays
- Shared transform system (position, size, rotation, anchor) and timing system (visibility, fades, easing)
- Plugin system for third-party scene components and presets
- Renders H.264/AAC MP4 via headless Chromium frame capture + ffmpeg mux
- 1920x1080 at 30fps default, configurable

## Project Structure

```
apps/desktop/          Electron + React desktop app
packages/core/         Subtitle parsing, scene contracts, option validation
packages/plugin-base/  Plugin SDK (published to npm as @lyric-video-maker/plugin-base)
packages/renderer/     Headless Chromium rendering, ffmpeg muxing
packages/scene-registry/  Built-in scenes and reusable components
docs/                  VitePress documentation site
examples/              Example plugins
```

## Getting Started

### Prerequisites

- Node.js 22+
- Python 3.12+ (for subtitle alignment sidecar)
- ffmpeg and ffprobe on PATH

### Setup

```bash
git clone https://github.com/mrkmg/LyricVideoMaker.git
cd LyricVideoMaker
npm ci
npm run setup:runtime   # downloads bundled Chromium + builds subtitle sidecar
```

### Development

```bash
npm run dev             # start Electron dev mode
npm run build           # build all workspace packages
npm run typecheck       # TypeScript check across all packages
npm test                # run tests
```

## Plugins

Lyric Video Maker supports external plugins that add scene components and scene presets. Plugins are CommonJS modules distributed as Git repositories.

- Plugin SDK: [`@lyric-video-maker/plugin-base`](https://www.npmjs.com/package/@lyric-video-maker/plugin-base)
- Authoring guide: [PLUGINS.md](./PLUGINS.md)

## Releasing

Use the release script to bump versions across all packages and create a git tag:

```bash
node scripts/release.mjs 1.0.0
```

This updates every `package.json` in the monorepo and creates a `v1.0.0` tag. Push the tag to trigger CI:

- **GitHub Release** -- builds and packages the Windows desktop app
- **npm publish** -- publishes `@lyric-video-maker/plugin-base` with provenance

## License

The desktop application is licensed under the terms in [EULA.txt](./EULA.txt).

The plugin SDK (`@lyric-video-maker/plugin-base`) is licensed under [MIT](./packages/plugin-base/LICENSE).
