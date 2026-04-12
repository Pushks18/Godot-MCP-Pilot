import { resolve, normalize, isAbsolute } from "path";

/**
 * Validate that a target path stays within an allowed root.
 * Prevents path traversal attacks (e.g. ../../etc/passwd).
 */
export function validatePath(root: string, target: string): string {
  const resolvedRoot = resolve(root);
  const resolvedTarget = isAbsolute(target)
    ? resolve(target)
    : resolve(root, target);

  if (!resolvedTarget.startsWith(resolvedRoot + "/") && resolvedTarget !== resolvedRoot) {
    throw new Error(
      `Path traversal detected: "${target}" escapes project root "${root}"`
    );
  }

  return resolvedTarget;
}

/**
 * Normalise a res:// path to a filesystem path.
 */
export function resPathToFs(projectPath: string, resPath: string): string {
  if (resPath.startsWith("res://")) {
    return resolve(projectPath, resPath.slice("res://".length));
  }
  return resolve(projectPath, resPath);
}

/**
 * Convert an absolute or relative filesystem path back to res://.
 */
export function fsPathToRes(projectPath: string, fsPath: string): string {
  const resolvedProject = resolve(projectPath);
  const resolvedFs = resolve(fsPath);
  if (resolvedFs.startsWith(resolvedProject)) {
    const rel = resolvedFs.slice(resolvedProject.length).replace(/\\/g, "/");
    return `res://${rel.startsWith("/") ? rel.slice(1) : rel}`;
  }
  return fsPath;
}

/** Check if a path is inside the project (non-throwing version). */
export function isInsideProject(projectPath: string, target: string): boolean {
  try {
    validatePath(projectPath, target);
    return true;
  } catch {
    return false;
  }
}
