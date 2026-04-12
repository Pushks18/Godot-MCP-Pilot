import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { validatePath, resPathToFs } from "../utils/path.js";
import { runGodot } from "../godot-process.js";

/**
 * Extract the UID from a Godot 4 resource file.
 * Godot 4.x resources have a line like: uid="uid://abc123xyz"
 */
export function getUid(projectPath: string, filePath: string): { uid: string | null; path: string } {
  const absProject = resolve(projectPath);
  const fsPath = filePath.startsWith("res://")
    ? resPathToFs(absProject, filePath)
    : validatePath(absProject, filePath);

  if (!existsSync(fsPath)) {
    throw new Error(`File not found: "${filePath}"`);
  }

  // Check .import file first (Godot 3.x style)
  const importPath = fsPath + ".import";
  if (existsSync(importPath)) {
    const importContent = readFileSync(importPath, "utf8");
    const m = importContent.match(/uid\s*=\s*"([^"]+)"/);
    if (m) return { uid: m[1], path: fsPath };
  }

  // Check the file itself (Godot 4.x tscn/tres have uid in the header)
  const content = readFileSync(fsPath, "utf8");
  const m = content.match(/uid="([^"]+)"/);
  if (m) return { uid: m[1], path: fsPath };

  // Check .godot/uid_cache.bin is not human-readable, so we look in imported
  const importedDir = join(absProject, ".godot", "imported");
  if (existsSync(importedDir)) {
    const filename = fsPath.split("/").pop()!;
    const uid = searchImportedForUid(importedDir, filename);
    if (uid) return { uid, path: fsPath };
  }

  return { uid: null, path: fsPath };
}

function searchImportedForUid(importedDir: string, filename: string): string | null {
  try {
    const entries = readdirSync(importedDir);
    for (const entry of entries) {
      if (entry.startsWith(filename)) {
        const fullPath = join(importedDir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) continue;
          const content = readFileSync(fullPath, "utf8");
          const m = content.match(/uid\s*=\s*"([^"]+)"/);
          if (m) return m[1];
        } catch {
          // skip
        }
      }
    }
  } catch {
    // skip
  }
  return null;
}

/**
 * Update UIDs in a project by triggering Godot's import system.
 * Runs Godot with --import to re-process all assets.
 */
export async function updateProjectUids(
  projectPath: string
): Promise<{ updated: boolean; message: string }> {
  const absPath = resolve(projectPath);

  if (!existsSync(join(absPath, "project.godot"))) {
    throw new Error(`No project.godot found in "${projectPath}"`);
  }

  const result = await runGodot(["--path", absPath, "--import", "--headless", "--quit"], 60000);

  const success = result.code === 0 || result.stdout.includes("Import successful");

  return {
    updated: success,
    message: success
      ? "UIDs updated successfully (Godot re-imported assets)."
      : `Godot exited with code ${result.code}. Output: ${result.stderr.slice(0, 500)}`,
  };
}

/**
 * List all resources with UIDs in a project.
 */
export function listUids(projectPath: string): Array<{ path: string; uid: string }> {
  const absPath = resolve(projectPath);
  const results: Array<{ path: string; uid: string }> = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (/\.(tscn|tres|scn|res|gd)$/.test(entry)) {
          const content = readFileSync(full, "utf8");
          const m = content.match(/uid="([^"]+)"/);
          if (m) {
            const rel = full.slice(absPath.length + 1).replace(/\\/g, "/");
            results.push({ path: `res://${rel}`, uid: m[1] });
          }
        }
      } catch {
        // skip
      }
    }
  }

  walk(absPath);
  return results;
}
