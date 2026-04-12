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
