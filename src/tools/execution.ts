import { existsSync } from "fs";
import { resolve } from "path";
import { spawn } from "child_process";
import { config } from "../config.js";
import {
  startProjectRun,
  stopProjectRun,
  getDebugOutput,
  isProjectRunning,
} from "../godot-process.js";

/** Launch the Godot editor for a project. Non-blocking — returns immediately. */
export function launchEditor(projectPath: string): { launched: boolean; pid: number | undefined } {
  const absPath = resolve(projectPath);
  if (!existsSync(absPath)) {
    throw new Error(`Project path does not exist: "${projectPath}"`);
  }

  const proc = spawn(config.godotPath, ["--editor", "--path", absPath], {
    stdio: "ignore",
    detached: true,
  });

  // Detach so the editor lives independently
  proc.unref();

  return { launched: true, pid: proc.pid };
}

/** Run a project (or specific scene) in debug mode. Captures output. */
export function runProject(
  projectPath: string,
  scene?: string
): { status: string; message: string } {
  const absPath = resolve(projectPath);
  if (!existsSync(absPath)) {
    throw new Error(`Project path does not exist: "${projectPath}"`);
  }

  if (isProjectRunning()) {
    stopProjectRun();
  }

  startProjectRun(absPath, scene);

  return {
    status: "running",
    message: scene
      ? `Project started with scene "${scene}". Use get_debug_output to retrieve logs.`
      : `Project started. Use get_debug_output to retrieve logs.`,
  };
}

/** Stop any currently running project. */
export function stopProject(): { stopped: boolean; message: string } {
  const stopped = stopProjectRun();
  return {
    stopped,
    message: stopped ? "Project stopped." : "No project was running.",
  };
}

/** Return console output captured from the running/last project run. */
export function getProjectDebugOutput(): { stdout: string; stderr: string; running: boolean } {
  const output = getDebugOutput();
  return { ...output, running: isProjectRunning() };
}

/**
 * Run the project in headless mode and wait for it to exit.
 * Useful for automated testing or quick checks.
 */
export async function runHeadless(
  projectPath: string,
  scene?: string,
  timeoutMs = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const absPath = resolve(projectPath);

  const args = ["--path", absPath, "--headless"];
  if (scene) args.push("--scene", scene);

  return new Promise((resolve_) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn(config.godotPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      proc.kill();
    }, timeoutMs);

    proc.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve_({ stdout, stderr: stderr + "\n" + err.message, exitCode: null });
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve_({ stdout, stderr, exitCode: code });
    });
  });
}
