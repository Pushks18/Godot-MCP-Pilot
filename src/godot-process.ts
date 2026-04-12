import { spawn, ChildProcess } from "child_process";
import { config } from "./config.js";

interface RunResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

/** Singleton store for the currently running Godot project process. */
let runningProcess: ChildProcess | null = null;
let capturedOutput = { stdout: "", stderr: "" };

/**
 * Run the Godot binary with given args and wait for it to exit.
 * Returns stdout + stderr.
 */
export async function runGodot(args: string[], timeoutMs = 15000): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn(config.godotPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Godot process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));

    proc.on("error", (err) => {
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new Error(
            `Godot executable not found at "${config.godotPath}". ` +
            `Set the GODOT_PATH environment variable to the correct path.`
          )
        );
      } else {
        reject(err);
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

/**
 * Launch Godot in background (non-blocking). Returns immediately.
 * Captures output for get_debug_output.
 */
export function spawnGodot(args: string[]): ChildProcess {
  const proc = spawn(config.godotPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  proc.stdout?.on("data", (d: Buffer) => {
    capturedOutput.stdout += d.toString();
  });
  proc.stderr?.on("data", (d: Buffer) => {
    capturedOutput.stderr += d.toString();
  });

  return proc;
}

/** Start a project run (background). Replaces any existing running process. */
export function startProjectRun(projectPath: string, scene?: string): void {
  stopProjectRun();
  capturedOutput = { stdout: "", stderr: "" };

  const args = ["--path", projectPath];
  if (scene) args.push("--scene", scene);

  runningProcess = spawnGodot(args);

  runningProcess.on("close", () => {
    runningProcess = null;
  });
}

/** Stop the running project process. */
export function stopProjectRun(): boolean {
  if (!runningProcess) return false;
  runningProcess.kill("SIGTERM");
  runningProcess = null;
  return true;
}

/** Whether a project is currently running. */
export function isProjectRunning(): boolean {
  return runningProcess !== null;
}

/** Get captured output from the last/current run. */
export function getDebugOutput(): { stdout: string; stderr: string } {
  return { ...capturedOutput };
}

/** Clear captured output. */
export function clearDebugOutput(): void {
  capturedOutput = { stdout: "", stderr: "" };
}
