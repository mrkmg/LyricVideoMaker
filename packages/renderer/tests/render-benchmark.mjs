import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { createRenderJob, parseSrt } from "../../core/dist/index.js";
import { builtInSceneComponents, singleImageLyricsScene } from "../../scene-registry/dist/index.js";
import { probeAudioDurationMs, renderLyricVideo } from "../dist/index.js";

process.env.LYRIC_VIDEO_RENDER_DEBUG = "1";

const workspace = await mkdtemp(join(tmpdir(), "lyric-video-benchmark-"));
const audioPath = join(workspace, "tone.mp3");
const subtitlePath = join(workspace, "lyrics.srt");
const imagePath = join(workspace, "background.png");
const outputPath = join(workspace, "output.mp4");
const benchmarkMode = process.env.LYRIC_VIDEO_BENCHMARK_MODE ?? "standard";

try {
  const benchmark = createBenchmarkScenario(benchmarkMode);

  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=440:duration=${benchmark.audioDurationSeconds}`,
    "-q:a",
    "2",
    audioPath
  ]);
  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=#202030:s=1920x1080:d=1",
    "-frames:v",
    "1",
    imagePath
  ]);
  await writeFile(
    subtitlePath,
    benchmark.subtitleText,
    "utf8"
  );

  const durationMs = await probeAudioDurationMs(audioPath);
  const job = createRenderJob({
    audioPath,
    subtitlePath,
    outputPath,
    componentDefinitions: builtInSceneComponents,
    cues: parseSrt(await readFile(subtitlePath, "utf8")),
    durationMs,
    validationContext: {
      isFileAccessible: () => true
    },
    scene: {
      ...singleImageLyricsScene,
      components: benchmark.buildComponents({ imagePath, durationMs })
    }
  });

  const startMs = performance.now();
  await renderLyricVideo({
    job,
    componentDefinitions: builtInSceneComponents
  });
  const elapsedMs = performance.now() - startMs;

  await access(outputPath);

  console.log(
    JSON.stringify(
      {
        mode: benchmarkMode,
        durationMs,
        frames: job.video.durationInFrames,
        elapsedMs: Number(elapsedMs.toFixed(2)),
        renderedFps: Number((job.video.durationInFrames / (elapsedMs / 1000)).toFixed(2)),
        outputPath
      },
      null,
      2
    )
  );
} finally {
  await rm(workspace, { recursive: true, force: true });
}

async function runFfmpeg(args) {
  await new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    const stderr = [];
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(Buffer.concat(stderr).toString("utf8")));
    });
  });
}

function createBenchmarkScenario(mode) {
  switch (mode) {
    case "full-frame":
      return {
        audioDurationSeconds: 4,
        subtitleText: `1
00:00:00,000 --> 00:00:04,000
Full frame benchmark lyric`,
        buildComponents({ imagePath, durationMs }) {
          return [
            {
              id: "background-image-1",
              componentId: "background-image",
              enabled: true,
              options: {
                imagePath
              }
            },
            {
              id: "lyrics-by-line-1",
              componentId: "lyrics-by-line",
              enabled: true,
              options: {
                lyricSize: 72,
                lyricFont: "Montserrat",
                lyricColor: "#ffffff",
                fadeInDurationMs: durationMs,
                fadeOutDurationMs: durationMs
              }
            }
          ];
        }
      };
    case "equalizer":
      return {
        audioDurationSeconds: 4,
        subtitleText: `1
00:00:00,000 --> 00:00:04,000
Equalizer benchmark lyric`,
        buildComponents({ imagePath }) {
          return [
            {
              id: "background-image-1",
              componentId: "background-image",
              enabled: true,
              options: {
                imagePath
              }
            },
            {
              id: "lyrics-by-line-1",
              componentId: "lyrics-by-line",
              enabled: true,
              options: {
                lyricSize: 72,
                lyricFont: "Montserrat",
                lyricColor: "#ffffff"
              }
            },
            {
              id: "equalizer-1",
              componentId: "equalizer",
              enabled: true,
              options: {
                ...builtInSceneComponents.find((component) => component.id === "equalizer").defaultOptions,
                barCount: 32
              }
            }
          ];
        }
      };
    case "standard":
    default:
      return {
        audioDurationSeconds: 2.4,
        subtitleText: `1
00:00:00,000 --> 00:00:01,000
Hello

2
00:00:01,100 --> 00:00:02,300
World`,
        buildComponents({ imagePath }) {
          return [
            {
              id: "background-image-1",
              componentId: "background-image",
              enabled: true,
              options: {
                imagePath
              }
            },
            {
              id: "background-color-1",
              componentId: "background-color",
              enabled: false,
              options: {}
            },
            {
              id: "lyrics-by-line-1",
              componentId: "lyrics-by-line",
              enabled: true,
              options: {
                lyricSize: 72,
                lyricFont: "Montserrat",
                lyricColor: "#ffffff"
              }
            }
          ];
        }
      };
  }
}
