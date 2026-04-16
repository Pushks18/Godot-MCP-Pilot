import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { validatePath, resPathToFs } from "../utils/path.js";

const GDSCRIPT_TEMPLATES: Record<string, string> = {
  default: `extends Node

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
\tpass

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
\tpass
`,
  CharacterBody2D: `extends CharacterBody2D

const SPEED = 300.0
const JUMP_VELOCITY = -400.0

func _physics_process(delta: float) -> void:
\t# Add the gravity.
\tif not is_on_floor():
\t\tvelocity += get_gravity() * delta

\t# Handle jump.
\tif Input.is_action_just_pressed("ui_accept") and is_on_floor():
\t\tvelocity.y = JUMP_VELOCITY

\t# Get the input direction and handle the movement/deceleration.
\tvar direction := Input.get_axis("ui_left", "ui_right")
\tif direction:
\t\tvelocity.x = direction * SPEED
\telse:
\t\tvelocity.x = move_toward(velocity.x, 0, SPEED)

\tmove_and_slide()
`,
  CharacterBody3D: `extends CharacterBody3D

const SPEED = 5.0
const JUMP_VELOCITY = 4.5

func _physics_process(delta: float) -> void:
\t# Add the gravity.
\tif not is_on_floor():
\t\tvelocity += get_gravity() * delta

\t# Handle jump.
\tif Input.is_action_just_pressed("ui_accept") and is_on_floor():
\t\tvelocity.y = JUMP_VELOCITY

\t# Get the input direction and handle the movement/deceleration.
\tvar input_dir := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
\tvar direction := (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
\tif direction:
\t\tvelocity.x = direction.x * SPEED
\t\tvelocity.z = direction.z * SPEED
\telse:
\t\tvelocity.x = move_toward(velocity.x, 0, SPEED)
\t\tvelocity.z = move_toward(velocity.z, 0, SPEED)

\tmove_and_slide()
`,
  Singleton: `extends Node

## Autoloaded singleton — add to Project > Autoload.

static var instance: Node

func _ready() -> void:
\tinstance = self
`,
};

function resolveScriptPath(projectPath: string, scriptPath: string): string {
  const absProject = resolve(projectPath);
  return scriptPath.startsWith("res://")
    ? resPathToFs(absProject, scriptPath)
    : validatePath(absProject, scriptPath);
}

/** List all GDScript files in a project. */
export function listProjectScripts(projectPath: string): { scripts: string[] } {
  const absPath = resolve(projectPath);
  const scripts: string[] = [];

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
        } else if (entry.endsWith(".gd")) {
          const rel = full.slice(absPath.length + 1).replace(/\\/g, "/");
          scripts.push(`res://${rel}`);
        }
      } catch {
        // skip
      }
    }
  }

  walk(absPath);
  return { scripts };
}

/** Read a GDScript file's source code. */
export function readScript(
  projectPath: string,
  scriptPath: string
): { content: string; path: string } {
  const fsPath = resolveScriptPath(projectPath, scriptPath);
  if (!existsSync(fsPath)) {
    throw new Error(`Script not found: "${scriptPath}"`);
  }
  const content = readFileSync(fsPath, "utf8");
  return { content, path: fsPath };
}

/** Overwrite a GDScript file with new content. */
export function modifyScript(
  projectPath: string,
  scriptPath: string,
  newContent: string
): { modified: boolean; path: string } {
  const fsPath = resolveScriptPath(projectPath, scriptPath);
  if (!existsSync(fsPath)) {
    throw new Error(`Script not found: "${scriptPath}". Use create_script to create a new file.`);
  }
  writeFileSync(fsPath, newContent, "utf8");
  return { modified: true, path: fsPath };
}

/** Create a new GDScript file with an optional template. */
export function createScript(
  projectPath: string,
  scriptPath: string,
  template?: string
): { created: boolean; path: string } {
  const fsPath = resolveScriptPath(projectPath, scriptPath);
  if (existsSync(fsPath)) {
    throw new Error(`Script already exists: "${scriptPath}". Use modify_script to update it.`);
  }

  let content: string;
  if (template && GDSCRIPT_TEMPLATES[template]) {
    content = GDSCRIPT_TEMPLATES[template];
  } else if (template) {
    // Template is the actual content to write
    content = template;
  } else {
    content = GDSCRIPT_TEMPLATES["default"];
  }

  mkdirSync(dirname(fsPath), { recursive: true });
  writeFileSync(fsPath, content, "utf8");
  return { created: true, path: fsPath };
}

// ── GDScript structural analysis ─────────────────────────────────────────────

export interface ScriptFunction {
  name: string;
  /** Parameter list as written (e.g. "delta: float, speed := 5.0") */
  params: string;
  /** Return type annotation if present (e.g. "void", "bool") */
  returnType: string | null;
  /** 1-based line number where the func starts */
  line: number;
  /** true if declared "static func" */
  isStatic: boolean;
}

export interface ScriptSignal {
  name: string;
  params: string;
  line: number;
}

export interface ScriptVariable {
  name: string;
  /** Full declaration line (e.g. "var speed: float = 300.0") */
  declaration: string;
  line: number;
  exported: boolean;
}

/** Parse GDScript source and return its functions, signals, and top-level variables. */
export function listScriptFunctions(
  projectPath: string,
  scriptPath: string
): { functions: ScriptFunction[]; signals: ScriptSignal[]; variables: ScriptVariable[] } {
  const { content } = readScript(projectPath, scriptPath);
  const lines = content.split("\n");

  const functions: ScriptFunction[] = [];
  const signals: ScriptSignal[] = [];
  const variables: ScriptVariable[] = [];

  const funcRe =
    /^(static\s+)?func\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([\w\[\],? ]+))?\s*:/;
  const signalRe = /^signal\s+(\w+)\s*(?:\(([^)]*)\))?/;
  const varRe = /^(@export\s+)?(?:@\w+\s+)*(?:var|const)\s+(\w+)(?:\s*[:=].+)?/;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();

    const fm = trimmed.match(funcRe);
    if (fm) {
      functions.push({
        name: fm[2],
        params: (fm[3] ?? "").trim(),
        returnType: fm[4]?.trim() ?? null,
        line: i + 1,
        isStatic: !!fm[1],
      });
      continue;
    }

    const sm = trimmed.match(signalRe);
    if (sm) {
      signals.push({
        name: sm[1],
        params: (sm[2] ?? "").trim(),
        line: i + 1,
      });
      continue;
    }

    // Only capture top-level vars (no leading indent)
    if (!lines[i].match(/^\s/) && trimmed.match(varRe)) {
      const vm = trimmed.match(varRe)!;
      variables.push({
        name: vm[2],
        declaration: trimmed,
        line: i + 1,
        exported: trimmed.startsWith("@export"),
      });
    }
  }

  return { functions, signals, variables };
}

/**
 * Append a new function to the end of a GDScript file.
 * @param funcName   Name of the function (must be valid GDScript identifier).
 * @param params     Parameter list string, e.g. "delta: float, speed := 5.0".
 * @param body       Body lines (will be tab-indented automatically).
 * @param returnType Optional return type annotation, e.g. "void" or "bool".
 * @param isStatic   Whether to prefix with `static`.
 */
export function addScriptFunction(
  projectPath: string,
  scriptPath: string,
  funcName: string,
  params: string,
  body: string,
  returnType?: string,
  isStatic = false
): { added: boolean; line: number } {
  if (!/^\w+$/.test(funcName)) {
    throw new Error(`Invalid function name: "${funcName}"`);
  }

  const fsPath = resolveScriptPath(projectPath, scriptPath);
  if (!existsSync(fsPath)) {
    throw new Error(`Script not found: "${scriptPath}"`);
  }

  const existing = readFileSync(fsPath, "utf8");

  // Check for duplicate
  if (new RegExp(`^(?:static\\s+)?func\\s+${funcName}\\s*\\(`, "m").test(existing)) {
    throw new Error(
      `Function "${funcName}" already exists in "${scriptPath}". Use modify_script to replace it.`
    );
  }

  const returnPart = returnType ? ` -> ${returnType}` : "";
  const prefix = isStatic ? "static " : "";
  const header = `${prefix}func ${funcName}(${params})${returnPart}:`;

  // Indent every body line with a tab; empty lines stay empty
  const bodyLines = body
    .split("\n")
    .map((l) => (l.trim() === "" ? "" : `\t${l}`));

  // Ensure body has at least a pass
  if (bodyLines.every((l) => l.trim() === "")) {
    bodyLines.push("\tpass");
  }

  const newContent =
    existing.trimEnd() + "\n\n" + header + "\n" + bodyLines.join("\n") + "\n";

  writeFileSync(fsPath, newContent, "utf8");
  const lineNumber = newContent.split("\n").length - bodyLines.length - 1;
  return { added: true, line: lineNumber };
}

/**
 * Remove a function (and its entire body) from a GDScript file.
 * Finds the function by name and removes from its `func` line until
 * the next top-level statement or end of file.
 */
export function removeScriptFunction(
  projectPath: string,
  scriptPath: string,
  funcName: string
): { removed: boolean } {
  const fsPath = resolveScriptPath(projectPath, scriptPath);
  if (!existsSync(fsPath)) {
    throw new Error(`Script not found: "${scriptPath}"`);
  }

  const content = readFileSync(fsPath, "utf8");
  const lines = content.split("\n");

  // Find the func declaration line
  const startRe = new RegExp(`^(?:static\\s+)?func\\s+${funcName}\\s*\\(`);
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().match(startRe) && !lines[i].match(/^\s+/)) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1) {
    throw new Error(`Function "${funcName}" not found in "${scriptPath}"`);
  }

  // Find where the function ends: next non-blank, non-indented line after the func
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0 || line === "\r") continue; // blank — still in func
    if (!line.match(/^\s/)) {
      // Non-indented non-blank line = next top-level item
      endIdx = i;
      break;
    }
  }

  // Also remove any leading blank lines before the func
  let removeFrom = startIdx;
  while (removeFrom > 0 && lines[removeFrom - 1].trim() === "") {
    removeFrom--;
  }

  const newLines = [...lines.slice(0, removeFrom), ...lines.slice(endIdx)];
  writeFileSync(fsPath, newLines.join("\n"), "utf8");
  return { removed: true };
}

/**
 * Append a signal declaration to a GDScript file, after the last existing signal
 * or at the top (after extends/class_name).
 */
export function addSignal(
  projectPath: string,
  scriptPath: string,
  signalName: string,
  params?: string
): { added: boolean; declaration: string } {
  if (!/^\w+$/.test(signalName)) {
    throw new Error(`Invalid signal name: "${signalName}"`);
  }

  const fsPath = resolveScriptPath(projectPath, scriptPath);
  if (!existsSync(fsPath)) {
    throw new Error(`Script not found: "${scriptPath}"`);
  }

  const content = readFileSync(fsPath, "utf8");

  if (new RegExp(`^signal\\s+${signalName}\\b`, "m").test(content)) {
    throw new Error(`Signal "${signalName}" already exists in "${scriptPath}"`);
  }

  const declaration =
    params && params.trim()
      ? `signal ${signalName}(${params})`
      : `signal ${signalName}`;

  const newContent = insertAtTopLevel(content, declaration, "signal");
  writeFileSync(fsPath, newContent, "utf8");
  return { added: true, declaration };
}

/**
 * Add a variable/property declaration to a GDScript file, after existing
 * variables or at the top level.
 * @param varName    Variable name.
 * @param type       Optional type hint (e.g. "float", "String").
 * @param defaultVal Optional default value expression (e.g. "300.0", '"hello"').
 * @param exported   If true, adds @export annotation.
 */
export function addVariable(
  projectPath: string,
  scriptPath: string,
  varName: string,
  type?: string,
  defaultVal?: string,
  exported = false
): { added: boolean; declaration: string } {
  if (!/^\w+$/.test(varName)) {
    throw new Error(`Invalid variable name: "${varName}"`);
  }

  const fsPath = resolveScriptPath(projectPath, scriptPath);
  if (!existsSync(fsPath)) {
    throw new Error(`Script not found: "${scriptPath}"`);
  }

  const content = readFileSync(fsPath, "utf8");

  if (new RegExp(`^(?:@export\\s+)?(?:var|const)\\s+${varName}\\b`, "m").test(content)) {
    throw new Error(`Variable "${varName}" already exists in "${scriptPath}"`);
  }

  let decl = "var " + varName;
  if (type) decl += `: ${type}`;
  if (defaultVal !== undefined) decl += ` = ${defaultVal}`;
  if (exported) decl = "@export " + decl;

  const newContent = insertAtTopLevel(content, decl, "var");
  writeFileSync(fsPath, newContent, "utf8");
  return { added: true, declaration: decl };
}

/**
 * Insert a top-level declaration into a script at the appropriate position.
 * "signal" declarations go before other signals or before functions.
 * "var"    declarations go after signals, before functions.
 */
function insertAtTopLevel(content: string, declaration: string, kind: "signal" | "var"): string {
  const lines = content.split("\n");

  // Find insert position:
  // 1. After the last line of the same kind (signal / var)
  // 2. Before the first func
  // 3. After extends/class_name header lines
  let insertAfter = -1; // insert AFTER this index
  let firstFunc = lines.length;
  let lastExtends = 0;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trimStart();
    if (t.startsWith("extends ") || t.startsWith("class_name ")) {
      lastExtends = i;
    }
    if (t.startsWith("signal ") && kind === "signal") {
      insertAfter = i;
    }
    if ((t.startsWith("var ") || t.startsWith("@export ") || t.startsWith("const ")) && kind === "var") {
      insertAfter = i;
    }
    if (t.match(/^(?:static\s+)?func\s+/) && !t.startsWith(" ") && !t.startsWith("\t")) {
      firstFunc = Math.min(firstFunc, i);
    }
  }

  let pos: number;
  if (insertAfter >= 0) {
    pos = insertAfter + 1;
  } else if (firstFunc < lines.length) {
    pos = firstFunc;
  } else {
    pos = lastExtends + 1;
  }

  const newLines = [...lines.slice(0, pos), declaration, ...lines.slice(pos)];
  return newLines.join("\n");
}

/** Basic static analysis of a GDScript file. */
export function analyzeScript(
  projectPath: string,
  scriptPath: string
): { errors: Array<{ line: number; message: string }>; warnings: string[] } {
  const { content } = readScript(projectPath, scriptPath);
  const lines = content.split("\n");
  const errors: Array<{ line: number; message: string }> = [];
  const warnings: string[] = [];

  // Basic checks (a real implementation would use Godot's LSP or tree-sitter)
  let indentStack: number[] = [0];
  let inFunc = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // Check for common mistakes
    if (trimmed.includes("print ") && !trimmed.includes("print(")) {
      warnings.push(`Line ${i + 1}: Use print() function syntax (Godot 4 requires parentheses)`);
    }

    if (trimmed.match(/^\s*var\s+\w+\s*=\s*null\s*$/) && !trimmed.includes(":")) {
      warnings.push(
        `Line ${i + 1}: Consider adding a type hint (e.g., var x: SomeType = null) for better type safety`
      );
    }

    if (trimmed.includes("KinematicBody2D") || trimmed.includes("KinematicBody3D")) {
      errors.push({
        line: i + 1,
        message:
          "Godot 4 renamed KinematicBody2D/3D to CharacterBody2D/3D. Please update the class name.",
      });
    }

    if (trimmed.includes("RigidBody2D") && trimmed.includes("move_and_slide")) {
      warnings.push(
        `Line ${i + 1}: move_and_slide() is not available on RigidBody2D. Use apply_force() or linear_velocity instead.`
      );
    }
  }

  if (!content.startsWith("extends ") && !content.startsWith("class_name ") && content.trim().length > 0) {
    warnings.push("Script does not start with 'extends' — it won't attach to a node automatically.");
  }

  return { errors, warnings };
}
