import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import { join, resolve, extname } from "path";

/** Maps file extensions to logical asset types. */
const ASSET_TYPE_MAP: Record<string, string> = {
  // Images / Textures
  ".png": "texture",
  ".jpg": "texture",
  ".jpeg": "texture",
  ".svg": "texture",
  ".webp": "texture",
  ".bmp": "texture",
  ".tga": "texture",
  ".exr": "texture",
  ".hdr": "texture",
  // Audio
  ".wav": "audio",
  ".mp3": "audio",
  ".ogg": "audio",
  ".flac": "audio",
  // 3D / Meshes
  ".glb": "mesh",
  ".gltf": "mesh",
  ".obj": "mesh",
  ".fbx": "mesh",
  ".dae": "mesh",
  // Fonts
  ".ttf": "font",
  ".otf": "font",
  ".woff": "font",
  ".woff2": "font",
  // Godot Resources
  ".tres": "resource",
  ".res": "resource",
  // Shaders
  ".gdshader": "shader",
  ".glsl": "shader",
  // Video
  ".ogv": "video",
  ".webm": "video",
};

/** Valid asset type filter values. */
export const ASSET_TYPES = [
  "texture",
  "audio",
  "mesh",
  "font",
  "resource",
  "shader",
  "video",
  "other",
] as const;

export interface AssetInfo {
  /** res:// path relative to project root */
  path: string;
  /** Logical type: texture, audio, mesh, font, resource, shader, video, other */
  type: string;
  /** File size in bytes */
  size: number;
  /** Lowercase file extension including the dot */
  ext: string;
}

/**
 * List all asset files in a project.
 * @param projectPath  Absolute path to the Godot project directory.
 * @param assetType    Optional filter (texture | audio | mesh | font | resource | shader | video | other).
 */
export function listAssets(
  projectPath: string,
  assetType?: string
): { assets: AssetInfo[]; total: number } {
  const absPath = resolve(projectPath);
  const assets: AssetInfo[] = [];

  // Directories to skip
  const SKIP_DIRS = new Set([".godot", ".git", "node_modules"]);

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.startsWith(".") || SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);

      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else {
          const ext = extname(entry).toLowerCase();
          const type = ASSET_TYPE_MAP[ext] ?? "other";

          // Skip .tscn, .gd etc. — those are project files not assets
          if (
            [".tscn", ".scn", ".gd", ".cs", ".gdns", ".gdnlib", ".import", ".uid"].includes(ext)
          ) {
            continue;
          }

          if (assetType && type !== assetType) continue;

          const rel = full.slice(absPath.length + 1).replace(/\\/g, "/");
          assets.push({
            path: `res://${rel}`,
            type,
            size: stat.size,
            ext,
          });
        }
      } catch {
        // skip unreadable entries
      }
    }
  }

  walk(absPath);
  assets.sort((a, b) => a.path.localeCompare(b.path));
  return { assets, total: assets.length };
}

/**
 * Get detailed metadata about a specific asset file.
 */
export function getAssetInfo(
  projectPath: string,
  assetPath: string
): AssetInfo & { uid: string | null; importSettings: Record<string, string> | null } {
  const absProject = resolve(projectPath);
  const fsPath = assetPath.startsWith("res://")
    ? join(absProject, assetPath.slice("res://".length))
    : join(absProject, assetPath);

  if (!existsSync(fsPath)) {
    throw new Error(`Asset not found: "${assetPath}"`);
  }

  const stat = statSync(fsPath);
  const ext = extname(fsPath).toLowerCase();
  const type = ASSET_TYPE_MAP[ext] ?? "other";
  const rel = fsPath.slice(absProject.length + 1).replace(/\\/g, "/");

  let importSettings: Record<string, string> | null = null;
  let uid: string | null = null;

  // Try .import sidecar file (Godot 4 writes these)
  const importPath = fsPath + ".import";
  if (existsSync(importPath)) {
    try {
      const importContent = readFileSync(importPath, "utf8");
      const uidMatch = importContent.match(/uid\s*=\s*"([^"]+)"/);
      if (uidMatch) uid = uidMatch[1];

      importSettings = {};
      for (const line of importContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("[")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim();
          importSettings[k] = v;
        }
      }
    } catch {
      // ignore read errors
    }
  }

  return {
    path: `res://${rel}`,
    type,
    size: stat.size,
    ext,
    uid,
    importSettings,
  };
}
