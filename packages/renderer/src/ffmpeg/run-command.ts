import { spawn } from "node:child_process";
import { createAbortError } from "../abort";

export async function runCommand(
  command: string,
  args: string[],
  signal?: AbortSignal
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    const abortHandler = () => {
      child.kill();
      reject(createAbortError());
    };

    signal?.addEventListener("abort", abortHandler, { once: true });

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      signal?.removeEventListener("abort", abortHandler);
      reject(error);
    });
    child.on("close", (code) => {
      signal?.removeEventListener("abort", abortHandler);
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString("utf8"));
        return;
      }

      reject(
        new Error(
          `${command} exited with code ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`
        )
      );
    });
  });
}

export async function runBinaryCommand(
  command: string,
  args: string[],
  signal?: AbortSignal
): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    const abortHandler = () => {
      child.kill();
      reject(createAbortError());
    };

    signal?.addEventListener("abort", abortHandler, { once: true });

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      signal?.removeEventListener("abort", abortHandler);
      reject(error);
    });
    child.on("close", (code) => {
      signal?.removeEventListener("abort", abortHandler);
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }

      reject(
        new Error(
          `${command} exited with code ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`
        )
      );
    });
  });
}
