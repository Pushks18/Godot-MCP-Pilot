import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, resolve } from "path";
import os from "os";
import { runGodot } from "../godot-process.js";

/** Return Godot version and platform information. */
export async function getGodotVersion(): Promise<{ version: string; platform: string }> {
  const result = await runGodot(["--version"], 10000);
  const raw = (result.stdout + result.stderr).trim();
  // Output is like "4.3.stable" or "4.2.1.stable.official [...]"
  const version = raw.split("\n")[0].trim() || "unknown";
  return { version, platform: os.platform() };
}

/** Recursively find project.godot files under a directory. */
export function listProjects(
  directory: string,
  recursive = false
): Array<{ name: string; path: string }> {
  const results: Array<{ name: string; path: string }> = [];

  function walk(dir: string, depth: number) {
    if (depth > (recursive ? 6 : 1)) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    if (entries.includes("project.godot")) {
      const projectFile = join(dir, "project.godot");
      const name = parseProjectName(projectFile) || dir.split("/").pop() || dir;
      results.push({ name, path: dir });
    }

    if (recursive) {
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        try {
          if (statSync(fullPath).isDirectory() && !entry.startsWith(".")) {
            walk(fullPath, depth + 1);
          }
        } catch {
          // skip unreadable entries
        }
      }
    }
  }

  walk(resolve(directory), 0);
  return results;
}

function parseProjectName(projectGodotPath: string): string | null {
  try {
    const content = readFileSync(projectGodotPath, "utf8");
    const m = content.match(/config\/name\s*=\s*"([^"]+)"/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export interface ProjectInfo {
  name: string;
  path: string;
  godotVersion: string;
  structure: {
    scenes: number;
    scripts: number;
    assets: number;
  };
}

/** Get metadata about a Godot project. */
export function getProjectInfo(projectPath: string): ProjectInfo {
  const absPath = resolve(projectPath);
  const projectGodot = join(absPath, "project.godot");

  if (!existsSync(projectGodot)) {
    throw new Error(`No project.godot found in "${projectPath}"`);
  }

  const content = readFileSync(projectGodot, "utf8");
  const name = parseProjectName(projectGodot) || absPath.split("/").pop() || absPath;

  // Extract Godot version from config
  const versionMatch = content.match(/config\/features\s*=\s*PackedStringArray\(([^)]+)\)/);
  let godotVersion = "unknown";
  if (versionMatch) {
    const features = versionMatch[1].split(",").map((s) => s.trim().replace(/"/g, ""));
    const ver = features.find((f) => /^\d+\.\d+/.test(f));
    if (ver) godotVersion = ver;
  }

  // Count files
  const structure = countProjectFiles(absPath);

  return { name, path: absPath, godotVersion, structure };
}

function countProjectFiles(dir: string): { scenes: number; scripts: number; assets: number } {
  let scenes = 0;
  let scripts = 0;
  let assets = 0;

  function walk(d: string) {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const fullPath = join(d, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          if (entry.endsWith(".tscn") || entry.endsWith(".scn")) scenes++;
          else if (entry.endsWith(".gd") || entry.endsWith(".cs")) scripts++;
          else if (/\.(png|jpg|jpeg|svg|wav|mp3|ogg|tres|res|glb|gltf|obj|fbx)$/i.test(entry)) assets++;
        }
      } catch {
        // skip
      }
    }
  }

  walk(dir);
  return { scenes, scripts, assets };
}
