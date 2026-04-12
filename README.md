# godot-mcp

> **Model Context Protocol server for Godot 4** — Give AI assistants (Claude, Cursor, Cline, etc.) direct control over your Godot projects.

[![npm version](https://img.shields.io/npm/v/godot-mcp)](https://www.npmjs.com/package/godot-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

godot-mcp exposes Godot engine operations as MCP tools, letting AI assistants **launch the editor, run projects, create and edit scenes, write GDScript, and inspect assets** — all through natural language.

```
"Create a CharacterBody2D player scene with a Sprite2D and CollisionShape2D"
"Run the project and show me any errors"
"Add a Camera2D that follows the player"
"Rename the health variable to max_health in all scripts"
```

---

## Features

| Category | Tools |
|---|---|
| **System** | `get_godot_version`, `list_projects`, `get_project_info` |
| **Editor / Run** | `launch_editor`, `run_project`, `stop_project`, `get_debug_output` |
| **Scenes** | `list_project_scenes`, `read_scene`, `create_scene`, `save_scene` |
| **Nodes** | `add_node`, `edit_node`, `remove_node`, `load_sprite` |
| **Scripts** | `list_project_scripts`, `read_script`, `modify_script`, `create_script`, `analyze_script` |
| **UIDs** | `get_uid`, `update_project_uids` |

---

## Quick Start

### 1. Install

```bash
# Run directly with npx (no install needed)
npx godot-mcp

# Or install globally
npm install -g godot-mcp
```

### 2. Add to your AI client

**Claude Code:**
```bash
claude mcp add godot -- npx godot-mcp
```

With a custom Godot path:
```bash
claude mcp add godot -e GODOT_PATH=/Applications/Godot.app/Contents/MacOS/Godot -- npx godot-mcp
```

**Or add to `.mcp.json` manually:**
```json
{
  "mcpServers": {
    "godot": {
      "command": "npx",
      "args": ["godot-mcp"],
      "env": {
        "GODOT_PATH": "/path/to/your/Godot"
      }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "godot": {
      "command": "npx",
      "args": ["godot-mcp"],
      "env": {
        "GODOT_PATH": "/path/to/your/Godot"
      }
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "godot": {
      "command": "npx",
      "args": ["godot-mcp"],
      "env": {
        "GODOT_PATH": "/path/to/your/Godot"
      }
    }
  }
}
```

---

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `GODOT_PATH` | auto-detected | Absolute path to the Godot executable |
| `READ_ONLY_MODE` | `false` | If `true`, disables all modifying tools (safe for CI/review) |
| `DEBUG` | `false` | Print debug info to stderr |

### Godot executable locations

| OS | Default paths checked |
|---|---|
| macOS | `/Applications/Godot.app/Contents/MacOS/Godot`, `/Applications/Godot_4.app/...` |
| Linux | `/usr/bin/godot`, `/usr/local/bin/godot`, `/snap/bin/godot` |
| Windows | `C:\Program Files\Godot\Godot.exe` |

If Godot isn't found automatically, set `GODOT_PATH`.

---

## Tool Reference

### System Tools

#### `get_godot_version`
Returns the installed Godot version and OS platform.
```json
// Response
{ "version": "4.3.stable", "platform": "darwin" }
```

#### `list_projects`
Find all Godot projects under a directory.
```json
// Input
{ "directory": "/Users/me/games", "recursive": true }
// Response
{ "projects": [{ "name": "MyGame", "path": "/Users/me/games/MyGame" }] }
```

#### `get_project_info`
Get metadata about a project.
```json
// Input
{ "projectPath": "/Users/me/games/MyGame" }
// Response
{
  "name": "MyGame",
  "path": "/Users/me/games/MyGame",
  "godotVersion": "4.3",
  "structure": { "scenes": 12, "scripts": 8, "assets": 45 }
}
```

---

### Execution Tools

#### `launch_editor`
Open the Godot editor (non-blocking).
```json
{ "projectPath": "/Users/me/games/MyGame" }
```

#### `run_project`
Run the project in debug mode. Captures output for `get_debug_output`.
```json
{ "projectPath": "/Users/me/games/MyGame", "scene": "res://scenes/Main.tscn" }
```

#### `get_debug_output`
Retrieve console logs from the running or last-run project.
```json
// Response
{
  "stdout": "Player spawned\nScore: 100\n",
  "stderr": "",
  "running": false
}
```

---

### Scene Tools

#### `create_scene`
```json
{
  "projectPath": "/Users/me/games/MyGame",
  "scenePath": "scenes/Player.tscn",
  "rootNodeType": "CharacterBody2D"
}
```

#### `add_node`
```json
{
  "projectPath": "/Users/me/games/MyGame",
  "scenePath": "scenes/Player.tscn",
  "nodeType": "Sprite2D",
  "nodeName": "Sprite2D",
  "parentNodePath": ".",
  "properties": { "position": "Vector2(0, -16)" }
}
```

#### `edit_node`
```json
{
  "projectPath": "/Users/me/games/MyGame",
  "scenePath": "scenes/Player.tscn",
  "nodePath": "Sprite2D",
  "properties": { "scale": "Vector2(2, 2)", "modulate": "Color(1, 0.5, 0.5, 1)" }
}
```

#### `load_sprite`
```json
{
  "projectPath": "/Users/me/games/MyGame",
  "scenePath": "scenes/Player.tscn",
  "nodePath": "Sprite2D",
  "texturePath": "res://assets/player.png"
}
```

---

### Script Tools

#### `create_script`
Available templates: `CharacterBody2D`, `CharacterBody3D`, `Singleton`, or provide your own content.
```json
{
  "projectPath": "/Users/me/games/MyGame",
  "scriptPath": "scripts/Player.gd",
  "template": "CharacterBody2D"
}
```

#### `analyze_script`
Checks for common errors and Godot 3→4 migration issues.
```json
// Response
{
  "errors": [{ "line": 5, "message": "Godot 4 renamed KinematicBody2D to CharacterBody2D" }],
  "warnings": ["Line 12: Consider adding a type hint for better type safety"]
}
```

---

## Example Workflow

```
You: Create a 2D platformer player scene

Claude:
1. create_scene → "scenes/Player.tscn" with root CharacterBody2D
2. add_node → Sprite2D child
3. add_node → CollisionShape2D child
4. create_script → "scripts/Player.gd" using CharacterBody2D template
5. "Player scene created with sprite, collision, and movement script!"

You: Run the project and check for errors

Claude:
1. run_project → starts the game
2. get_debug_output → "No errors found. Game running at 60fps."
```

---

## Read-Only Mode

Enable `READ_ONLY_MODE=true` to restrict the server to analysis-only tools. Useful for:
- CI/CD pipelines that inspect but don't modify projects  
- Code review workflows
- Shared/production environments

```bash
READ_ONLY_MODE=true npx godot-mcp
```

In read-only mode, any call to a modifying tool returns an error explaining how to enable it.

---

## Development

```bash
git clone https://github.com/your-username/godot-mcp
cd godot-mcp
npm install
npm run build

# Run in development mode
npm run dev
```

### Project Structure

```
godot-mcp/
├── src/
│   ├── index.ts           # Entry point
│   ├── server.ts          # MCP server + tool routing
│   ├── config.ts          # Godot path detection, env config
│   ├── godot-process.ts   # Process management (spawn, capture)
│   ├── tools/
│   │   ├── system.ts      # Version, project listing/info
│   │   ├── execution.ts   # Launch editor, run/stop project
│   │   ├── scene.ts       # Scene CRUD + node manipulation
│   │   ├── script.ts      # GDScript read/write/analyze
│   │   └── uid.ts         # Godot 4 UID management
│   └── utils/
│       ├── path.ts        # Path validation (prevents traversal)
│       └── tscn.ts        # .tscn parser and serializer
└── scripts/
    └── godot_operations.gd  # Bundled GDScript for runtime ops
```

---

## Compatibility

- **Godot 4.x** (primary target — tested on 4.2, 4.3, 4.4)
- **Godot 3.x** — basic tools work; scene format differences apply
- **MCP Protocol** — 2024-11-05 spec
- **Node.js** — 18+

---

## Security

- All file paths are validated to stay within the project directory (no path traversal)
- `launch_editor` and `run_project` only start processes with safe, predefined args
- Use `READ_ONLY_MODE=true` in untrusted environments
- The server never executes arbitrary shell commands — only the Godot binary

---

## License

MIT
