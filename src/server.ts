import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";

// Tool implementations
import { getGodotVersion, listProjects, getProjectInfo } from "./tools/system.js";
import { launchEditor, runProject, stopProject, getProjectDebugOutput } from "./tools/execution.js";
import {
  listProjectScenes,
  readSceneFile,
  createScene,
  saveScene,
  addNode,
  editNode,
  removeNode,
  loadSprite,
} from "./tools/scene.js";
import {
  listProjectScripts,
  readScript,
  modifyScript,
  createScript,
  analyzeScript,
} from "./tools/script.js";
import { getUid, updateProjectUids } from "./tools/uid.js";

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
]);

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
        recursive: { type: "boolean", description: "Search subdirectories (default: false)", default: false },
      },
      required: ["directory"],
    },
  },
  {
    name: "get_project_info",
    description: "Get metadata about a Godot project: name, version, scene/script/asset counts.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Absolute path to the project directory" },
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
        projectPath: { type: "string", description: "Absolute path to the project directory" },
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
        projectPath: { type: "string", description: "Absolute path to the project directory" },
        scene: { type: "string", description: "Optional scene file path (e.g. res://scenes/Main.tscn)" },
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
    description: "Get console output (stdout/stderr) from the running or last run project.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },

  // ── Scenes ───────────────────────────────────────────────────────────────────
  {
    name: "list_project_scenes",
    description: "List all .tscn scene files in a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Absolute path to the project directory" },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "read_scene",
    description: "Read a scene file — returns raw .tscn text and a structured node list.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Absolute path to the project directory" },
        scenePath: { type: "string", description: "Scene path (res:// or relative to project)" },
      },
      required: ["projectPath", "scenePath"],
    },
  },
  {
    name: "create_scene",
    description: "Create a new .tscn scene file with a specified root node type.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Absolute path to the project directory" },
        scenePath: { type: "string", description: "New scene path (e.g. scenes/Player.tscn or res://scenes/Player.tscn)" },
        rootNodeType: { type: "string", description: "Root node type (e.g. Node2D, CharacterBody2D, Node3D)", default: "Node" },
      },
      required: ["projectPath", "scenePath"],
    },
  },
  {
    name: "save_scene",
    description: "Save a scene (re-writes it to disk, optionally to a new path).",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Absolute path to the project directory" },
        scenePath: { type: "string", description: "Source scene path" },
        newPath: { type: "string", description: "Optional new path to save as (copies the scene)" },
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
        projectPath: { type: "string", description: "Absolute path to the project directory" },
        scenePath: { type: "string", description: "Scene to modify" },
        nodeType: { type: "string", description: "Godot node class (e.g. Sprite2D, CollisionShape2D, Camera2D)" },
        nodeName: { type: "string", description: "Name for the new node" },
        parentNodePath: { type: "string", description: "Path of parent node (default: . = root)" },
        properties: {
          type: "object",
          description: "Optional node properties as key=GDScript-value pairs (e.g. {\"position\": \"Vector2(100, 200)\"})",
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
        projectPath: { type: "string", description: "Absolute path to the project directory" },
        scenePath: { type: "string", description: "Scene file path" },
        nodePath: { type: "string", description: "Node path in scene (e.g. Player/Sprite2D or . for root)" },
        properties: {
          type: "object",
          description: "Properties to set as key=GDScript-value pairs",
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
        projectPath: { type: "string", description: "Absolute path to the project directory" },
        scenePath: { type: "string", description: "Scene file path" },
        nodePath: { type: "string", description: "Node path to remove (e.g. Player/OldSprite)" },
      },
      required: ["projectPath", "scenePath", "nodePath"],
    },
  },
  {
    name: "load_sprite",
    description: "Load a texture resource into a Sprite2D (or TextureRect) node.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Absolute path to the project directory" },
        scenePath: { type: "string", description: "Scene file path" },
        nodePath: { type: "string", description: "Path to the Sprite2D node" },
        texturePath: { type: "string", description: "Texture path (res://assets/player.png)" },
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
        projectPath: { type: "string", description: "Absolute path to the project directory" },
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
        projectPath: { type: "string", description: "Absolute path to the project directory" },
        scriptPath: { type: "string", description: "Script path (res:// or relative to project)" },
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
        projectPath: { type: "string", description: "Absolute path to the project directory" },
        scriptPath: { type: "string", description: "Script path (res:// or relative to project)" },
        newContent: { type: "string", description: "Full new content of the script" },
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
        projectPath: { type: "string", description: "Absolute path to the project directory" },
        scriptPath: { type: "string", description: "New script path (e.g. scripts/Player.gd)" },
        template: { type: "string", description: "Template name or full script content" },
      },
      required: ["projectPath", "scriptPath"],
    },
  },
  {
    name: "analyze_script",
    description: "Perform basic static analysis on a GDScript file — finds common errors and Godot 4 migration issues.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Absolute path to the project directory" },
        scriptPath: { type: "string", description: "Script path (res:// or relative to project)" },
      },
      required: ["projectPath", "scriptPath"],
    },
  },

  // ── UIDs ─────────────────────────────────────────────────────────────────────
  {
    name: "get_uid",
    description: "Get the Godot 4 unique ID (uid://) for a resource file.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Absolute path to the project directory" },
        filePath: { type: "string", description: "File path (res:// or relative to project)" },
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
        projectPath: { type: "string", description: "Absolute path to the project directory" },
      },
      required: ["projectPath"],
    },
  },
];

// Filter to read-only tools when READ_ONLY_MODE is on
function getAvailableTools(): Tool[] {
  if (config.readOnlyMode) {
    return TOOL_DEFINITIONS.filter((t) => READ_ONLY_TOOLS.has(t.name));
  }
  return TOOL_DEFINITIONS;
}

type ToolArgs = Record<string, unknown>;

async function callTool(name: string, args: ToolArgs): Promise<unknown> {
  // Read-only enforcement
  if (config.readOnlyMode && !READ_ONLY_TOOLS.has(name)) {
    throw new Error(
      `Tool "${name}" is disabled in read-only mode. Set READ_ONLY_MODE=false to enable modifying tools.`
    );
  }

  switch (name) {
    // System
    case "get_godot_version":
      return await getGodotVersion();
    case "list_projects":
      return listProjects(args.directory as string, (args.recursive as boolean) ?? false);
    case "get_project_info":
      return getProjectInfo(args.projectPath as string);

    // Execution
    case "launch_editor":
      return launchEditor(args.projectPath as string);
    case "run_project":
      return runProject(args.projectPath as string, args.scene as string | undefined);
    case "stop_project":
      return stopProject();
    case "get_debug_output":
      return getProjectDebugOutput();

    // Scenes
    case "list_project_scenes":
      return listProjectScenes(args.projectPath as string);
    case "read_scene":
      return readSceneFile(args.projectPath as string, args.scenePath as string);
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
        args.properties as Record<string, string> | undefined
      );
    case "edit_node":
      return editNode(
        args.projectPath as string,
        args.scenePath as string,
        args.nodePath as string,
        args.properties as Record<string, string>
      );
    case "remove_node":
      return removeNode(
        args.projectPath as string,
        args.scenePath as string,
        args.nodePath as string
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
      return readScript(args.projectPath as string, args.scriptPath as string);
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
      return analyzeScript(args.projectPath as string, args.scriptPath as string);

    // UIDs
    case "get_uid":
      return getUid(args.projectPath as string, args.filePath as string);
    case "update_project_uids":
      return await updateProjectUids(args.projectPath as string);

    default:
      throw new Error(`Unknown tool: "${name}"`);
  }
}

export async function startServer(): Promise<void> {
  const server = new Server(
    { name: "godot-mcp", version: "1.0.0" },
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
      `[godot-mcp] Server started. Godot: ${config.godotPath} | Read-only: ${config.readOnlyMode}\n`
    );
  }
}
