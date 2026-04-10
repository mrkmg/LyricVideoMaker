import { FFPROBE_EXECUTABLE } from "../constants";
import { runCommand } from "./run-command";

export async function probeAudioDurationMs(audioPath: string): Promise<number> {
  const output = await runCommand(FFPROBE_EXECUTABLE, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    audioPath
  ]);

  const durationSeconds = Number(output.trim());
  if (Number.isNaN(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Unable to determine audio duration with ffprobe.");
  }

  return Math.round(durationSeconds * 1000);
}
