import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import {
  parseProjectGodot,
  serializeProjectGodot,
  getSetting,
  setSetting,
  deleteSetting,
  stripQuotes,
  ProjectGodotData,
} from "../utils/project_godot.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function readProjectGodot(projectPath: string): {
  data: ProjectGodotData;
  projectFile: string;
} {
  const absPath = resolve(projectPath);
  const projectFile = join(absPath, "project.godot");
  if (!existsSync(projectFile)) {
    throw new Error(`No project.godot found in "${projectPath}"`);
  }
  const content = readFileSync(projectFile, "utf8");
  return { data: parseProjectGodot(content), projectFile };
}

function writeProjectGodot(projectFile: string, data: ProjectGodotData): void {
  writeFileSync(projectFile, serializeProjectGodot(data), "utf8");
}

// ── Settings ─────────────────────────────────────────────────────────────────

/**
 * Get all project settings, or those in a specific section only.
 *
 * Special section names: "application", "display", "input", "autoload",
 * "rendering", "audio", "physics", "layer_names", etc.
 */
export function getProjectSettings(
  projectPath: string,
  section?: string
): { settings: Record<string, Record<string, string>> } {
  const { data } = readProjectGodot(projectPath);

  if (section) {
    return { settings: { [section]: data[section] ?? {} } };
  }

  // Return everything except __root__ at the top level for clarity
  const settings: Record<string, Record<string, string>> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "__root__") {
      settings["__root__"] = value;
    } else {
      settings[key] = value;
    }
  }
  return { settings };
}

/**
 * Set a project setting by section + key. Creates the section if needed.
 * Value should be a valid Godot config value string, e.g. `"true"`, `"42"`,
 * `'"res://scene.tscn"'` (note inner quotes for string values).
 */
export function setProjectSetting(
  projectPath: string,
  section: string,
  key: string,
  value: string
): { updated: boolean; section: string; key: string } {
  const { data, projectFile } = readProjectGodot(projectPath);
  setSetting(data, key, value, section);
  writeProjectGodot(projectFile, data);
  return { updated: true, section, key };
}

// ── Main Scene ────────────────────────────────────────────────────────────────

/** Get the project's main scene path (res:// format). */
export function getMainScene(projectPath: string): { mainScene: string | null } {
  const { data } = readProjectGodot(projectPath);
  const raw = getSetting(data, "run/main_scene", "application");
  return { mainScene: raw ? stripQuotes(raw) : null };
}

/** Set the project's main scene. */
export function setMainScene(
  projectPath: string,
  scenePath: string
): { updated: boolean; mainScene: string } {
  const { data, projectFile } = readProjectGodot(projectPath);
  const resPath = scenePath.startsWith("res://") ? scenePath : `res://${scenePath}`;
  setSetting(data, "run/main_scene", `"${resPath}"`, "application");
  writeProjectGodot(projectFile, data);
  return { updated: true, mainScene: resPath };
}

// ── Autoloads ─────────────────────────────────────────────────────────────────

export interface AutoloadEntry {
  name: string;
  /** res:// path to the script or scene */
  path: string;
  /** true = active, false = disabled in the autoload list */
  enabled: boolean;
}

/** List all autoload (singleton) entries in the project. */
export function listAutoloads(projectPath: string): { autoloads: AutoloadEntry[] } {
  const { data } = readProjectGodot(projectPath);
  const autoloadSection = data["autoload"] ?? {};

  const autoloads: AutoloadEntry[] = Object.entries(autoloadSection).map(
    ([name, raw]) => {
      // Godot stores: name="*res://path.gd"  (* prefix = enabled)
      // Strip outer quotes first
      const inner = stripQuotes(raw);
      const enabled = inner.startsWith("*");
      const path = enabled ? inner.slice(1) : inner;
      return { name, path, enabled };
    }
  );

  return { autoloads };
}

/** Add or update an autoload singleton. */
export function addAutoload(
  projectPath: string,
  name: string,
  scriptPath: string,
  enabled = true
): { added: boolean; name: string; path: string } {
  if (!/^\w+$/.test(name)) {
    throw new Error(`Invalid autoload name "${name}": must be a valid identifier`);
  }

  const { data, projectFile } = readProjectGodot(projectPath);
  const resPath = scriptPath.startsWith("res://") ? scriptPath : `res://${scriptPath}`;
  const value = `"${enabled ? "*" : ""}${resPath}"`;
  setSetting(data, name, value, "autoload");
  writeProjectGodot(projectFile, data);
  return { added: true, name, path: resPath };
}

/** Remove an autoload singleton by name. */
export function removeAutoload(
  projectPath: string,
  name: string
): { removed: boolean; name: string } {
  const { data, projectFile } = readProjectGodot(projectPath);
  const removed = deleteSetting(data, name, "autoload");
  if (removed) writeProjectGodot(projectFile, data);
  return { removed, name };
}

// ── Input Actions ─────────────────────────────────────────────────────────────

export interface InputAction {
  name: string;
  /** Raw Godot value string (may be multi-line dictionary) */
  definition: string;
}

/** List all custom input actions defined in the project. */
export function listInputActions(projectPath: string): { actions: InputAction[] } {
  const { data } = readProjectGodot(projectPath);
  const inputSection = data["input"] ?? {};
  const actions: InputAction[] = Object.entries(inputSection).map(([name, definition]) => ({
    name,
    definition,
  }));
  return { actions };
}

/**
 * Add a new input action with no events (just a deadzone default).
 * Use the Godot editor to bind keys afterwards, or use set_project_setting
 * to write the full events dictionary.
 */
export function addInputAction(
  projectPath: string,
  actionName: string
): { added: boolean; actionName: string } {
  if (!/^[\w/]+$/.test(actionName)) {
    throw new Error(`Invalid action name "${actionName}"`);
  }

  const { data, projectFile } = readProjectGodot(projectPath);
  if (data["input"]?.[actionName] !== undefined) {
    throw new Error(`Input action "${actionName}" already exists`);
  }

  const emptyDef = `{\n"deadzone": 0.5,\n"events": []\n}`;
  setSetting(data, actionName, emptyDef, "input");
  writeProjectGodot(projectFile, data);
  return { added: true, actionName };
}

/** Remove an input action by name. */
export function removeInputAction(
  projectPath: string,
  actionName: string
): { removed: boolean; actionName: string } {
  const { data, projectFile } = readProjectGodot(projectPath);
  const removed = deleteSetting(data, actionName, "input");
  if (removed) writeProjectGodot(projectFile, data);
  return { removed, actionName };
}
