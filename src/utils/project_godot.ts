/**
 * Parser and writer for Godot's project.godot configuration file.
 *
 * The format is INI-like:
 *   config_version=5                          ← root-level key
 *   [application]                             ← section header
 *   config/name="MyGame"                      ← key=value
 *   run/main_scene="res://scenes/Main.tscn"
 *   [input]
 *   move_left={                               ← multi-line value
 *   "deadzone": 0.5,
 *   "events": []
 *   }
 */

export interface ProjectGodotData {
  /** Keys that appear before any section header */
  __root__: Record<string, string>;
  [section: string]: Record<string, string>;
}

/** Parse a project.godot file into structured data. */
export function parseProjectGodot(content: string): ProjectGodotData {
  const data: ProjectGodotData = { __root__: {} };
  const lines = content.split(/\r?\n/);
  let currentSection = "__root__";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and blank lines
    if (!trimmed || trimmed.startsWith(";")) {
      i++;
      continue;
    }

    // Section header: [section_name]
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      currentSection = trimmed.slice(1, -1);
      if (!data[currentSection]) data[currentSection] = {};
      i++;
      continue;
    }

    // Key=value pair
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();

      // Multi-line value: opening brace on same line, collect until line starting with }
      if (value.startsWith("{") && !value.endsWith("}")) {
        const multiLines: string[] = [value];
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          multiLines.push(nextLine);
          if (nextLine.trimStart().startsWith("}")) break;
          i++;
        }
        value = multiLines.join("\n");
      }

      if (!data[currentSection]) data[currentSection] = {};
      data[currentSection][key] = value;
    }

    i++;
  }

  return data;
}

/** Serialize structured data back to project.godot format. */
export function serializeProjectGodot(data: ProjectGodotData): string {
  const parts: string[] = [
    "; Godot Project Configuration File",
    ";",
    "; WARNING: Do not edit if you don't know what you are doing!",
    "",
  ];

  // Root-level keys first
  const rootKeys = Object.keys(data.__root__);
  for (const key of rootKeys) {
    parts.push(`${key}=${data.__root__[key]}`);
  }
  if (rootKeys.length > 0) parts.push("");

  // Sections
  for (const [section, values] of Object.entries(data)) {
    if (section === "__root__") continue;
    parts.push(`[${section}]`);
    parts.push("");
    for (const [key, value] of Object.entries(values)) {
      parts.push(`${key}=${value}`);
      parts.push("");
    }
  }

  return parts.join("\n");
}

/** Get a setting value from a specific section (or root if omitted). */
export function getSetting(
  data: ProjectGodotData,
  key: string,
  section = "__root__"
): string | undefined {
  return data[section]?.[key];
}

/** Set a setting value, creating the section if it doesn't exist. */
export function setSetting(
  data: ProjectGodotData,
  key: string,
  value: string,
  section = "__root__"
): void {
  if (!data[section]) data[section] = {};
  data[section][key] = value;
}

/** Delete a setting. Returns true if the key existed. */
export function deleteSetting(
  data: ProjectGodotData,
  key: string,
  section = "__root__"
): boolean {
  if (data[section]?.[key] !== undefined) {
    delete data[section][key];
    return true;
  }
  return false;
}

/** Strip surrounding quotes from a Godot string value like "res://foo". */
export function stripQuotes(value: string): string {
  return value.replace(/^"|"$/g, "");
}
