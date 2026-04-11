import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SubtitleGenerationProgressEvent } from "./electron-api";
import {
  createGeneratedSubtitlePath,
  createSubtitleGenerationRunner
} from "../electron/services/subtitle-generator";

class MockChildProcess extends EventEmitter {
  public readonly stdout = Object.assign(new EventEmitter(), {
    setEncoding() {}
  });
  public readonly stderr = Object.assign(new EventEmitter(), {
    setEncoding() {}
  });
  public killed = false;

  kill() {
    this.killed = true;
    this.emit("close", 1);
    return true;
  }
}

describe("subtitle-generator", () => {
  afterEach(() => {
    process.removeAllListeners("uncaughtException");
  });

  it("finds the next generated SRT path beside the audio file", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "subtitle-path-"));
    const audioPath = join(workspace, "song.mp3");
    await writeFile(audioPath, "");
    await writeFile(join(workspace, "song.aligned.srt"), "");
    await writeFile(join(workspace, "song.aligned-2.srt"), "");

    await expect(
      createGeneratedSubtitlePath({ audioPath, mode: "align" })
    ).resolves.toBe(join(workspace, "song.aligned-3.srt"));
  });

  it("parses sidecar progress and completion events", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "subtitle-runner-"));
    const sidecarDir = join(
      workspace,
      "sidecars",
      "subtitle-aligner",
      "src",
      "lyric_video_subtitle_aligner"
    );
    await mkdir(sidecarDir, { recursive: true });
    await writeFile(join(sidecarDir, "cli.py"), "# sidecar");

    let sidecarChild: MockChildProcess | null = null;
    const runner = createSubtitleGenerationRunner({
      rootDir: workspace,
      createSpawn: ((command: string, args?: string[]) => {
        const child = new MockChildProcess();
        const normalizedArgs = args ?? [];

        if (normalizedArgs.includes("--version")) {
          queueMicrotask(() => {
            if (command === "py") {
              child.emit("close", 0);
              return;
            }

            if (command.endsWith("python.exe") || command.endsWith("/python")) {
              child.emit("error", new Error("missing venv"));
            }
          });
          return child as never;
        }

        sidecarChild = child;
        return child as never;
      }) as never
    });

    const progressEvents: SubtitleGenerationProgressEvent[] = [];
    const runPromise = runner.run(
      {
        mode: "transcribe",
        audioPath: "song.mp3",
        outputPath: "song.transcribed.srt",
        language: "auto"
      },
      (event) => progressEvents.push(event)
    );

    await flushMicrotasks();
    const spawnedChild = sidecarChild as MockChildProcess | null;
    expect(spawnedChild).toBeDefined();
    if (!spawnedChild) {
      throw new Error("Expected subtitle sidecar process to be spawned.");
    }
    spawnedChild.stdout.emit(
      "data",
      'LVM_EVENT\t{"type":"progress","progress":45,"message":"Transcribing audio","stage":"transcribing"}\n'
    );
    spawnedChild.stdout.emit(
      "data",
      'LVM_EVENT\t{"type":"result","outputPath":"song.transcribed.srt"}\n'
    );
    spawnedChild.emit("close", 0);

    await expect(runPromise).resolves.toEqual({ outputPath: "song.transcribed.srt" });
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "starting", progress: 0 }),
        expect.objectContaining({ status: "running", progress: 45, stage: "transcribing" }),
        expect.objectContaining({
          status: "completed",
          progress: 100,
          outputPath: "song.transcribed.srt"
        })
      ])
    );
  });
});

async function flushMicrotasks() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}
