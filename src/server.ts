import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";

// ── Tool implementations ──────────────────────────────────────────────────────

import { getGodotVersion, listProjects, getProjectInfo } from "./tools/system.js";
import {
  launchEditor,
  runProject,
  stopProject,
  getProjectDebugOutput,
  runGdScript,
} from "./tools/execution.js";
import {
  listProjectScenes,
  readSceneFile,
  createScene,
  saveScene,
  addNode,
  editNode,
  removeNode,
  loadSprite,
  duplicateNode,
  moveNode,
  setSceneScript,
  instantiateScene,
} from "./tools/scene.js";
import {
  listProjectScripts,
  readScript,
  modifyScript,
  createScript,
  analyzeScript,
  listScriptFunctions,
  addScriptFunction,
  removeScriptFunction,
  addSignal,
  addVariable,
} from "./tools/script.js";
import { getUid, updateProjectUids } from "./tools/uid.js";
import { listAssets, getAssetInfo } from "./tools/assets.js";
import {
  getProjectSettings,
  setProjectSetting,
  getMainScene,
  setMainScene,
  listAutoloads,
  addAutoload,
  removeAutoload,
  listInputActions,
  addInputAction,
  removeInputAction,
} from "./tools/project_settings.js";

// ── Read-only tool set ────────────────────────────────────────────────────────

const READ_ONLY_TOOLS = new Set([
  "get_godot_version",
  "list_projects",
  "get_project_info",
  "get_debug_output",
  "list_project_scenes",
  "read_scene",
  "list_project_scripts",
  "read_script",
  "analyze_script",
  "get_uid",
  "list_assets",
  "get_asset_info",
  "get_project_settings",
  "get_main_scene",
  "list_autoloads",
  "list_input_actions",
  "list_script_functions",
]);

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOL_DEFINITIONS: Tool[] = [
  // ── System ──────────────────────────────────────────────────────────────────
  {
    name: "get_godot_version",
    description: "Get the installed Godot engine version and platform information.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_projects",
    description: "Find Godot projects (project.godot files) under a directory.",
    inputSchema: {
      type: "object",
      properties: {
        directory: { type: "string", description: "Root directory to search" },
        recursive: {
          type: "boolean",
          description: "Search subdirectories (default: false)",
          default: false,
        },
      },
      required: ["directory"],
    },
  },
  {
    name: "get_project_info",
    description:
      "Get metadata about a Godot project: name, version, scene/script/asset counts.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
      },
      required: ["projectPath"],
    },
  },

  // ── Execution ────────────────────────────────────────────────────────────────
  {
    name: "launch_editor",
    description: "Open the Godot editor for a project. Non-blocking — returns immediately.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "run_project",
    description:
      "Run a Godot project in debug mode (background). Optionally run a specific scene. " +
      "Use get_debug_output to retrieve console logs after starting.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scene: {
          type: "string",
          description:
            "Optional scene file path (e.g. res://scenes/Main.tscn)",
        },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "stop_project",
    description: "Stop the currently running Godot project.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_debug_output",
    description:
      "Get console output (stdout/stderr) from the running or last run project.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "run_gdscript",
    description:
      "Run a GDScript snippet headlessly inside a project and return the output. " +
      "The script body is wrapped in a SceneTree subclass automatically — just write " +
      "the statements to execute (e.g. print(\"hello\")). Great for quick tests and " +
      "calculations that need Godot's built-in types.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scriptBody: {
          type: "string",
          description:
            "GDScript statements to execute (no func wrapper needed). " +
            "They will run inside _init() of a SceneTree subclass.",
        },
        timeoutMs: {
          type: "number",
          description: "Maximum run time in milliseconds (default: 30000)",
          default: 30000,
        },
      },
      required: ["projectPath", "scriptBody"],
    },
  },

  // ── Scenes ───────────────────────────────────────────────────────────────────
  {
    name: "list_project_scenes",
    description: "List all .tscn scene files in a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "read_scene",
    description:
      "Read a scene file — returns raw .tscn text and a structured node list.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scenePath: {
          type: "string",
          description: "Scene path (res:// or relative to project)",
        },
      },
      required: ["projectPath", "scenePath"],
    },
  },
  {
    name: "create_scene",
    description:
      "Create a new .tscn scene file with a specified root node type.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scenePath: {
          type: "string",
          description:
            "New scene path (e.g. scenes/Player.tscn or res://scenes/Player.tscn)",
        },
        rootNodeType: {
          type: "string",
          description:
            "Root node type (e.g. Node2D, CharacterBody2D, Node3D)",
          default: "Node",
        },
      },
      required: ["projectPath", "scenePath"],
    },
  },
  {
    name: "save_scene",
    description:
      "Save a scene (re-writes it to disk, optionally to a new path).",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scenePath: { type: "string", description: "Source scene path" },
        newPath: {
          type: "string",
          description: "Optional new path to save as (copies the scene)",
        },
      },
      required: ["projectPath", "scenePath"],
    },
  },
  {
    name: "add_node",
    description: "Add a new node to an existing scene.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scenePath: { type: "string", description: "Scene to modify" },
        nodeType: {
          type: "string",
          description:
            "Godot node class (e.g. Sprite2D, CollisionShape2D, Camera2D)",
        },
        nodeName: { type: "string", description: "Name for the new node" },
        parentNodePath: {
          type: "string",
          description: "Path of parent node (default: . = root)",
        },
        properties: {
          type: "object",
          description:
            "Optional node properties as key=GDScript-value pairs (e.g. {\"position\": \"Vector2(100, 200)\"})",
          additionalProperties: { type: "string" },
        },
      },
      required: ["projectPath", "scenePath", "nodeType", "nodeName"],
    },
  },
  {
    name: "edit_node",
    description: "Modify properties of an existing node in a scene.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scenePath: { type: "string", description: "Scene file path" },
        nodePath: {
          type: "string",
          description:
            "Node path in scene (e.g. Player/Sprite2D or . for root)",
        },
        properties: {
          type: "object",
          description:
            "Properties to set as key=GDScript-value pairs",
          additionalProperties: { type: "string" },
        },
      },
      required: ["projectPath", "scenePath", "nodePath", "properties"],
    },
  },
  {
    name: "remove_node",
    description: "Remove a node (and all its children) from a scene.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scenePath: { type: "string", description: "Scene file path" },
        nodePath: {
          type: "string",
          description: "Node path to remove (e.g. Player/OldSprite)",
        },
      },
      required: ["projectPath", "scenePath", "nodePath"],
    },
  },
  {
    name: "duplicate_node",
    description:
      "Duplicate a node (and its children) within the same scene, giving it a new name. " +
      "The duplicate is placed under the same parent as the original.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scenePath: { type: "string", description: "Scene file path" },
        nodePath: {
          type: "string",
          description: "Path of the node to duplicate (e.g. Player)",
        },
        newName: {
          type: "string",
          description: "Name for the duplicated node (e.g. Player2)",
        },
      },
      required: ["projectPath", "scenePath", "nodePath", "newName"],
    },
  },
  {
    name: "move_node",
    description:
      "Move (re-parent) a node to a different parent within the same scene. " +
      "All descendant parent paths are updated automatically.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scenePath: { type: "string", description: "Scene file path" },
        nodePath: {
          type: "string",
          description: "Current node path (e.g. Player/Sprite2D)",
        },
        newParentPath: {
          type: "string",
          description:
            "Path of the new parent node (use . for scene root)",
        },
      },
      required: ["projectPath", "scenePath", "nodePath", "newParentPath"],
    },
  },
  {
    name: "set_scene_script",
    description:
      "Attach a GDScript to a node in a scene, or detach the current script. " +
      "Automatically adds the ext_resource entry to the .tscn file.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scenePath: { type: "string", description: "Scene file path" },
        nodePath: {
          type: "string",
          description:
            "Node path to attach the script to (e.g. . for root, or Player)",
        },
        scriptPath: {
          type: "string",
          description:
            "Script path (res:// or relative). Omit to detach the current script.",
        },
      },
      required: ["projectPath", "scenePath", "nodePath"],
    },
  },
  {
    name: "instantiate_scene",
    description:
      "Instantiate a packed scene (sub-scene) as a child node inside another scene. " +
      "Adds the ext_resource entry automatically.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scenePath: {
          type: "string",
          description: "Scene to add the instance into",
        },
        subScenePath: {
          type: "string",
          description:
            "Packed scene to instantiate (e.g. res://enemies/Slime.tscn)",
        },
        parentNodePath: {
          type: "string",
          description:
            "Parent node path (default: . = root of the scene)",
        },
        nodeName: {
          type: "string",
          description:
            "Name for the instance node (defaults to scene filename without extension)",
        },
      },
      required: ["projectPath", "scenePath", "subScenePath"],
    },
  },
  {
    name: "load_sprite",
    description:
      "Load a texture resource into a Sprite2D (or TextureRect) node.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scenePath: { type: "string", description: "Scene file path" },
        nodePath: {
          type: "string",
          description: "Path to the Sprite2D node",
        },
        texturePath: {
          type: "string",
          description: "Texture path (res://assets/player.png)",
        },
      },
      required: ["projectPath", "scenePath", "nodePath", "texturePath"],
    },
  },

  // ── Scripts ──────────────────────────────────────────────────────────────────
  {
    name: "list_project_scripts",
    description: "List all GDScript (.gd) files in a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "read_script",
    description: "Read the source code of a GDScript file.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scriptPath: {
          type: "string",
          description: "Script path (res:// or relative to project)",
        },
      },
      required: ["projectPath", "scriptPath"],
    },
  },
  {
    name: "modify_script",
    description: "Overwrite a GDScript file with new content.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scriptPath: {
          type: "string",
          description: "Script path (res:// or relative to project)",
        },
        newContent: {
          type: "string",
          description: "Full new content of the script",
        },
      },
      required: ["projectPath", "scriptPath", "newContent"],
    },
  },
  {
    name: "create_script",
    description:
      "Create a new GDScript file. Use the template param to pick a starter template: " +
      "'CharacterBody2D', 'CharacterBody3D', 'Singleton', or provide custom content.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scriptPath: {
          type: "string",
          description: "New script path (e.g. scripts/Player.gd)",
        },
        template: {
          type: "string",
          description: "Template name or full script content",
        },
      },
      required: ["projectPath", "scriptPath"],
    },
  },
  {
    name: "analyze_script",
    description:
      "Perform basic static analysis on a GDScript file — finds common errors and Godot 4 migration issues.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scriptPath: {
          type: "string",
          description: "Script path (res:// or relative to project)",
        },
      },
      required: ["projectPath", "scriptPath"],
    },
  },
  {
    name: "list_script_functions",
    description:
      "Parse a GDScript file and return all functions, signals, and top-level variables " +
      "with their names, parameters, return types, and line numbers.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scriptPath: {
          type: "string",
          description: "Script path (res:// or relative to project)",
        },
      },
      required: ["projectPath", "scriptPath"],
    },
  },
  {
    name: "add_script_function",
    description:
      "Append a new function to a GDScript file. Fails if the function already exists.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scriptPath: {
          type: "string",
          description: "Script path (res:// or relative to project)",
        },
        funcName: {
          type: "string",
          description: "Function name (valid GDScript identifier)",
        },
        params: {
          type: "string",
          description:
            'Parameter list string, e.g. "delta: float, speed := 5.0" (empty string for none)',
          default: "",
        },
        body: {
          type: "string",
          description:
            "Function body (unindented — tabs will be added automatically). " +
            "Use newlines between statements.",
        },
        returnType: {
          type: "string",
          description: 'Optional return type annotation, e.g. "void" or "bool"',
        },
        isStatic: {
          type: "boolean",
          description: "Whether to declare the function as static (default: false)",
          default: false,
        },
      },
      required: ["projectPath", "scriptPath", "funcName", "body"],
    },
  },
  {
    name: "remove_script_function",
    description:
      "Remove a function and its entire body from a GDScript file.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scriptPath: {
          type: "string",
          description: "Script path (res:// or relative to project)",
        },
        funcName: {
          type: "string",
          description: "Name of the function to remove",
        },
      },
      required: ["projectPath", "scriptPath", "funcName"],
    },
  },
  {
    name: "add_signal",
    description:
      "Add a signal declaration to a GDScript file. Inserted after existing signals.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scriptPath: {
          type: "string",
          description: "Script path (res:// or relative to project)",
        },
        signalName: {
          type: "string",
          description: "Signal name (valid GDScript identifier)",
        },
        params: {
          type: "string",
          description:
            "Optional parameter list, e.g. \"amount: int, source: Node\" (omit for parameterless signal)",
        },
      },
      required: ["projectPath", "scriptPath", "signalName"],
    },
  },
  {
    name: "add_variable",
    description:
      "Add a top-level variable or property declaration to a GDScript file.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scriptPath: {
          type: "string",
          description: "Script path (res:// or relative to project)",
        },
        varName: {
          type: "string",
          description: "Variable name (valid GDScript identifier)",
        },
        type: {
          type: "string",
          description: "Optional type hint, e.g. \"float\", \"String\", \"Node2D\"",
        },
        defaultVal: {
          type: "string",
          description: "Optional default value expression, e.g. \"300.0\" or \"Vector2.ZERO\"",
        },
        exported: {
          type: "boolean",
          description: "If true, adds @export annotation (makes variable visible in the editor)",
          default: false,
        },
      },
      required: ["projectPath", "scriptPath", "varName"],
    },
  },

  // ── UIDs ─────────────────────────────────────────────────────────────────────
  {
    name: "get_uid",
    description: "Get the Godot 4 unique ID (uid://) for a resource file.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        filePath: {
          type: "string",
          description: "File path (res:// or relative to project)",
        },
      },
      required: ["projectPath", "filePath"],
    },
  },
  {
    name: "update_project_uids",
    description:
      "Re-import all project assets to refresh Godot 4 UIDs. Runs Godot headlessly. " +
      "Use after adding or moving resource files.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
      },
      required: ["projectPath"],
    },
  },

  // ── Assets ───────────────────────────────────────────────────────────────────
  {
    name: "list_assets",
    description:
      "List all asset files in a project (textures, audio, meshes, fonts, shaders, etc.). " +
      "Optionally filter by type.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        assetType: {
          type: "string",
          enum: ["texture", "audio", "mesh", "font", "resource", "shader", "video", "other"],
          description:
            "Filter by asset type. Omit to list all assets.",
        },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "get_asset_info",
    description:
      "Get detailed metadata about a specific asset: type, size, UID, and import settings.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        assetPath: {
          type: "string",
          description: "Asset path (res:// or relative to project)",
        },
      },
      required: ["projectPath", "assetPath"],
    },
  },

  // ── Project Settings ──────────────────────────────────────────────────────────
  {
    name: "get_project_settings",
    description:
      "Read the project.godot configuration. Optionally filter to a specific section " +
      "(e.g. \"application\", \"display\", \"input\", \"autoload\", \"rendering\").",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        section: {
          type: "string",
          description:
            "Optional section name to read (e.g. \"application\", \"display\"). Omit for all.",
        },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "set_project_setting",
    description:
      "Write a setting to project.godot. The value must be a valid Godot config value string. " +
      "For strings, wrap in double quotes: e.g. value='\"res://scene.tscn\"'. " +
      "For booleans/numbers use: 'true', '42'. Creates the section if it doesn't exist.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        section: {
          type: "string",
          description: "Section name (e.g. \"application\", \"display\", \"rendering\")",
        },
        key: {
          type: "string",
          description: "Setting key (e.g. \"config/name\", \"window/size/viewport_width\")",
        },
        value: {
          type: "string",
          description: "Value string in Godot config format",
        },
      },
      required: ["projectPath", "section", "key", "value"],
    },
  },
  {
    name: "get_main_scene",
    description: "Get the project's configured main (startup) scene path.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "set_main_scene",
    description: "Set the project's main (startup) scene.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        scenePath: {
          type: "string",
          description: "Scene path (res:// or relative to project)",
        },
      },
      required: ["projectPath", "scenePath"],
    },
  },
  {
    name: "list_autoloads",
    description:
      "List all autoload (singleton) entries configured in the project.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "add_autoload",
    description:
      "Add or update an autoload (singleton) in the project settings. " +
      "The script will be instantiated automatically when the project starts.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        name: {
          type: "string",
          description:
            "Autoload node name (valid identifier, e.g. \"GameManager\")",
        },
        scriptPath: {
          type: "string",
          description: "Script or scene path (res:// or relative)",
        },
        enabled: {
          type: "boolean",
          description: "Whether the autoload is active (default: true)",
          default: true,
        },
      },
      required: ["projectPath", "name", "scriptPath"],
    },
  },
  {
    name: "remove_autoload",
    description: "Remove an autoload singleton from the project settings.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        name: {
          type: "string",
          description: "Name of the autoload to remove",
        },
      },
      required: ["projectPath", "name"],
    },
  },
  {
    name: "list_input_actions",
    description:
      "List all custom input actions defined in the project (Project > Project Settings > Input Map).",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "add_input_action",
    description:
      "Add a new input action to the project's Input Map (with no events bound). " +
      "Use the Godot editor or set_project_setting to bind keys to it.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        actionName: {
          type: "string",
          description: "Action name (e.g. \"jump\", \"attack\", \"ui_cancel\")",
        },
      },
      required: ["projectPath", "actionName"],
    },
  },
  {
    name: "remove_input_action",
    description: "Remove an input action from the project's Input Map.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project directory",
        },
        actionName: {
          type: "string",
          description: "Action name to remove",
        },
      },
      required: ["projectPath", "actionName"],
    },
  },
];

// ── Available tools (filtered by read-only mode) ──────────────────────────────

function getAvailableTools(): Tool[] {
  if (config.readOnlyMode) {
    return TOOL_DEFINITIONS.filter((t) => READ_ONLY_TOOLS.has(t.name));
  }
  return TOOL_DEFINITIONS;
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

type ToolArgs = Record<string, unknown>;

/**
 * Normalize an object arg that may arrive as a JSON string or a real object.
 * The MCP transport can deliver nested objects as JSON-encoded strings in some clients.
 */
function normalizeObject(v: unknown): Record<string, string> | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return undefined; }
  }
  return v as Record<string, string>;
}

async function callTool(name: string, args: ToolArgs): Promise<unknown> {
  if (config.readOnlyMode && !READ_ONLY_TOOLS.has(name)) {
    throw new Error(
      `Tool "${name}" is disabled in read-only mode. Set READ_ONLY_MODE=false to enable it.`
    );
  }

  switch (name) {
    // System
    case "get_godot_version":
      return await getGodotVersion();
    case "list_projects":
      return listProjects(
        args.directory as string,
        (args.recursive as boolean) ?? false
      );
    case "get_project_info":
      return getProjectInfo(args.projectPath as string);

    // Execution
    case "launch_editor":
      return launchEditor(args.projectPath as string);
    case "run_project":
      return runProject(
        args.projectPath as string,
        args.scene as string | undefined
      );
    case "stop_project":
      return stopProject();
    case "get_debug_output":
      return getProjectDebugOutput();
    case "run_gdscript":
      return await runGdScript(
        args.projectPath as string,
        args.scriptBody as string,
        (args.timeoutMs as number) ?? 30000
      );

    // Scenes
    case "list_project_scenes":
      return listProjectScenes(args.projectPath as string);
    case "read_scene":
      return readSceneFile(
        args.projectPath as string,
        args.scenePath as string
      );
    case "create_scene":
      return createScene(
        args.projectPath as string,
        args.scenePath as string,
        (args.rootNodeType as string) ?? "Node"
      );
    case "save_scene":
      return saveScene(
        args.projectPath as string,
        args.scenePath as string,
        args.newPath as string | undefined
      );
    case "add_node":
      return addNode(
        args.projectPath as string,
        args.scenePath as string,
        args.nodeType as string,
        args.nodeName as string,
        args.parentNodePath as string | undefined,
        normalizeObject(args.properties)
      );
    case "edit_node":
      return editNode(
        args.projectPath as string,
        args.scenePath as string,
        args.nodePath as string,
        normalizeObject(args.properties) ?? {}
      );
    case "remove_node":
      return removeNode(
        args.projectPath as string,
        args.scenePath as string,
        args.nodePath as string
      );
    case "duplicate_node":
      return duplicateNode(
        args.projectPath as string,
        args.scenePath as string,
        args.nodePath as string,
        args.newName as string
      );
    case "move_node":
      return moveNode(
        args.projectPath as string,
        args.scenePath as string,
        args.nodePath as string,
        args.newParentPath as string
      );
    case "set_scene_script":
      return setSceneScript(
        args.projectPath as string,
        args.scenePath as string,
        args.nodePath as string,
        args.scriptPath as string | undefined
      );
    case "instantiate_scene":
      return instantiateScene(
        args.projectPath as string,
        args.scenePath as string,
        args.subScenePath as string,
        args.parentNodePath as string | undefined,
        args.nodeName as string | undefined
      );
    case "load_sprite":
      return loadSprite(
        args.projectPath as string,
        args.scenePath as string,
        args.nodePath as string,
        args.texturePath as string
      );

    // Scripts
    case "list_project_scripts":
      return listProjectScripts(args.projectPath as string);
    case "read_script":
      return readScript(
        args.projectPath as string,
        args.scriptPath as string
      );
    case "modify_script":
      return modifyScript(
        args.projectPath as string,
        args.scriptPath as string,
        args.newContent as string
      );
    case "create_script":
      return createScript(
        args.projectPath as string,
        args.scriptPath as string,
        args.template as string | undefined
      );
    case "analyze_script":
      return analyzeScript(
        args.projectPath as string,
        args.scriptPath as string
      );
    case "list_script_functions":
      return listScriptFunctions(
        args.projectPath as string,
        args.scriptPath as string
      );
    case "add_script_function":
      return addScriptFunction(
        args.projectPath as string,
        args.scriptPath as string,
        args.funcName as string,
        (args.params as string) ?? "",
        args.body as string,
        args.returnType as string | undefined,
        (args.isStatic as boolean) ?? false
      );
    case "remove_script_function":
      return removeScriptFunction(
        args.projectPath as string,
        args.scriptPath as string,
        args.funcName as string
      );
    case "add_signal":
      return addSignal(
        args.projectPath as string,
        args.scriptPath as string,
        args.signalName as string,
        args.params as string | undefined
      );
    case "add_variable":
      return addVariable(
        args.projectPath as string,
        args.scriptPath as string,
        args.varName as string,
        args.type as string | undefined,
        args.defaultVal as string | undefined,
        (args.exported as boolean) ?? false
      );

    // UIDs
    case "get_uid":
      return getUid(
        args.projectPath as string,
        args.filePath as string
      );
    case "update_project_uids":
      return await updateProjectUids(args.projectPath as string);

    // Assets
    case "list_assets":
      return listAssets(
        args.projectPath as string,
        args.assetType as string | undefined
      );
    case "get_asset_info":
      return getAssetInfo(
        args.projectPath as string,
        args.assetPath as string
      );

    // Project Settings
    case "get_project_settings":
      return getProjectSettings(
        args.projectPath as string,
        args.section as string | undefined
      );
    case "set_project_setting":
      return setProjectSetting(
        args.projectPath as string,
        args.section as string,
        args.key as string,
        args.value as string
      );
    case "get_main_scene":
      return getMainScene(args.projectPath as string);
    case "set_main_scene":
      return setMainScene(
        args.projectPath as string,
        args.scenePath as string
      );
    case "list_autoloads":
      return listAutoloads(args.projectPath as string);
    case "add_autoload":
      return addAutoload(
        args.projectPath as string,
        args.name as string,
        args.scriptPath as string,
        (args.enabled as boolean) ?? true
      );
    case "remove_autoload":
      return removeAutoload(
        args.projectPath as string,
        args.name as string
      );
    case "list_input_actions":
      return listInputActions(args.projectPath as string);
    case "add_input_action":
      return addInputAction(
        args.projectPath as string,
        args.actionName as string
      );
    case "remove_input_action":
      return removeInputAction(
        args.projectPath as string,
        args.actionName as string
      );

    default:
      throw new Error(`Unknown tool: "${name}"`);
  }
}

// ── Server bootstrap ──────────────────────────────────────────────────────────

export async function startServer(): Promise<void> {
  const server = new Server(
    { name: "godot-mcp-pilot", version: "1.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getAvailableTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      const result = await callTool(name, args as ToolArgs);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  if (config.debug) {
    process.stderr.write(
      `[godot-mcp-pilot] Server started (v1.1.0). Godot: ${config.godotPath} | Read-only: ${config.readOnlyMode}\n`
    );
  }
}
