import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { access, constants } from "node:fs/promises";
import { join } from "node:path";
import type {
  StartSubtitleGenerationRequest,
  SubtitleGenerationMode,
  SubtitleGenerationProgressEvent
} from "../../../src/electron-api";

interface SidecarProgressMessage {
  type: "progress";
  progress?: number;
  message?: string;
  stage?: string;
}

interface SidecarErrorMessage {
  type: "error";
  message: string;
  errorType?: string;
}

interface SidecarResultMessage {
  type: "result";
  outputPath: string;
}

type SidecarMessage = SidecarProgressMessage | SidecarErrorMessage | SidecarResultMessage;

export interface SubtitleGenerationRunner {
  run(
    input: StartSubtitleGenerationRequest,
    onProgress?: (event: SubtitleGenerationProgressEvent) => void
  ): Promise<{ outputPath: string }>;
  cancel(): void;
  isRunning(): boolean;
}

export function createSubtitleGenerationRunner({
  rootDir,
  createSpawn = spawn
}: {
  rootDir: string;
  createSpawn?: typeof spawn;
}): SubtitleGenerationRunner {
  let activeChild: ChildProcess | null = null;

  return {
    async run(input, onProgress) {
      if (activeChild) {
        throw new Error("Subtitle generation is already running.");
      }

      const pythonCommand = await resolvePythonCommand(rootDir, createSpawn);
      const sidecarEntrypoint = resolveSidecarEntrypoint(rootDir);
      const requestPayload = JSON.stringify({
        mode: input.mode,
        audioPath: input.audioPath,
        outputPath: input.outputPath,
        language: input.language,
        lyricsTextPath: input.lyricsTextPath,
        modelName: "base",
        device: "auto"
      });

      onProgress?.({
        status: "starting",
        progress: 0,
        message: "Starting subtitle generation"
      });

      return await new Promise<{ outputPath: string }>((resolve, reject) => {
        const child = createSpawn(pythonCommand.command, [
          ...pythonCommand.args,
          "-u",
          sidecarEntrypoint,
          "--request-json",
          requestPayload
        ], {
          cwd: rootDir,
          stdio: ["ignore", "pipe", "pipe"],
          shell: false
        });
        activeChild = child;

        let stdoutBuffer = "";
        let stderrBuffer = "";
        let settled = false;
        let cancelled = false;
        let finalOutputPath = input.outputPath;
        let sidecarErrorMessage = "";

        const finish = (callback: () => void) => {
          if (settled) {
            return;
          }
          settled = true;
          activeChild = null;
          callback();
        };

        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");

        child.stdout.on("data", (chunk: string) => {
          stdoutBuffer += chunk;
          const lines = stdoutBuffer.split(/\r?\n/);
          stdoutBuffer = lines.pop() ?? "";

          for (const line of lines) {
            const event = parseSidecarEvent(line);
            if (!event) {
              continue;
            }

            if (event.type === "progress") {
              onProgress?.({
                status: "running",
                progress: normalizeProgress(event.progress ?? 0),
                message: event.message ?? "Generating subtitles",
                stage: event.stage
              });
              continue;
            }

            if (event.type === "result") {
              finalOutputPath = event.outputPath;
              onProgress?.({
                status: "completed",
                progress: 100,
                message: "Subtitle generation complete",
                outputPath: event.outputPath
              });
              continue;
            }

            sidecarErrorMessage = event.message;
          }
        });

        child.stderr.on("data", (chunk: string) => {
          stderrBuffer += chunk;
        });

        child.on("error", (error) => {
          finish(() => {
            reject(error);
          });
        });

        child.on("close", (code) => {
          finish(() => {
            if (cancelled) {
              onProgress?.({
                status: "cancelled",
                progress: 0,
                message: "Subtitle generation cancelled"
              });
              reject(new DOMException("The operation was aborted.", "AbortError"));
              return;
            }

            if (code === 0) {
              resolve({ outputPath: finalOutputPath });
              return;
            }

            const errorMessage =
              sidecarErrorMessage ||
              stderrBuffer.trim() ||
              `Subtitle generator exited with code ${code}.`;
            onProgress?.({
              status: "failed",
              progress: 0,
              message: "Subtitle generation failed",
              error: errorMessage
            });
            reject(new Error(errorMessage));
          });
        });

        const originalKill = child.kill.bind(child);
        child.kill = ((signal?: NodeJS.Signals | number) => {
          cancelled = true;
          return originalKill(signal);
        }) as typeof child.kill;
      });
    },
    cancel() {
      if (!activeChild) {
        return;
      }

      activeChild.kill();
    },
    isRunning() {
      return activeChild !== null;
    }
  };
}

export async function createGeneratedSubtitlePath({
  audioPath,
  mode
}: {
  audioPath: string;
  mode: SubtitleGenerationMode;
}) {
  const suffix = mode === "align" ? ".aligned" : ".transcribed";
  const dotIndex = audioPath.lastIndexOf(".");
  const basePath = dotIndex > 0 ? audioPath.slice(0, dotIndex) : audioPath;
  const initialPath = `${basePath}${suffix}.srt`;
  if (!(await pathExists(initialPath))) {
    return initialPath;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${basePath}${suffix}-${index}.srt`;
    if (!(await pathExists(candidate))) {
      return candidate;
    }
  }

  throw new Error("Unable to find an available subtitle output path.");
}

async function resolvePythonCommand(
  rootDir: string,
  createSpawn: typeof spawn
): Promise<{ command: string; args: string[] }> {
  const localVenvPython = getLocalVenvPython(rootDir);
  const candidates = [
    { command: localVenvPython, args: [] },
    { command: "py", args: ["-3"] },
    { command: "python", args: [] }
  ];

  for (const candidate of candidates) {
    if (await canRunPython(candidate.command, candidate.args, createSpawn)) {
      return candidate;
    }
  }

  throw new Error(
    "Python 3 was not found. Install Python 3.10+ and the subtitle sidecar dependencies before generating subtitles."
  );
}

function canRunPython(
  command: string,
  args: string[],
  createSpawn: typeof spawn
) {
  return new Promise<boolean>((resolve) => {
    const child = createSpawn(command, [...args, "--version"], {
      stdio: "ignore",
      shell: false
    } satisfies SpawnOptions);

    child.once("error", () => resolve(false));
    child.once("close", (code) => resolve(code === 0));
  });
}

function resolveSidecarEntrypoint(rootDir: string) {
  const entrypoint = join(
    rootDir,
    "sidecars",
    "subtitle-aligner",
    "src",
    "lyric_video_subtitle_aligner",
    "cli.py"
  );
  if (!existsSync(entrypoint)) {
    throw new Error(`Subtitle sidecar entrypoint not found at "${entrypoint}".`);
  }

  return entrypoint;
}

function getLocalVenvPython(rootDir: string) {
  return process.platform === "win32"
    ? join(rootDir, "sidecars", "subtitle-aligner", ".venv", "Scripts", "python.exe")
    : join(rootDir, "sidecars", "subtitle-aligner", ".venv", "bin", "python");
}

function parseSidecarEvent(line: string): SidecarMessage | null {
  const prefix = "LVM_EVENT\t";
  if (!line.startsWith(prefix)) {
    return null;
  }

  return JSON.parse(line.slice(prefix.length)) as SidecarMessage;
}

function normalizeProgress(progress: number) {
  return Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
}

async function pathExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
