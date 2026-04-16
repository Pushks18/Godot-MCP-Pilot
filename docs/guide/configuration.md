# Configuration

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GODOT_PATH` | auto-detected | Absolute path to the Godot 4 executable |
| `READ_ONLY_MODE` | `false` | Disables all write tools when set to `true` |
| `DEBUG` | `false` | Prints debug information to stderr |

### GODOT_PATH

Only needed when auto-detection fails (e.g. Godot is in `~/Downloads` and was never moved).

```bash
# macOS
GODOT_PATH=/Applications/Godot.app/Contents/MacOS/Godot

# Linux
GODOT_PATH=/usr/bin/godot4

# Windows
GODOT_PATH=C:\Program Files\Godot\Godot.exe
```

To find Godot on macOS or Linux:

```bash
find ~/Downloads ~/Applications /Applications -name "Godot" -type f 2>/dev/null
```

### READ_ONLY_MODE

Disables every tool that writes to disk or launches processes. Safe for CI pipelines and code-review bots.

```bash
READ_ONLY_MODE=true npx godot-mcp-pilot
```

Or in your MCP config:

```json
{
  "mcpServers": {
    "godot": {
      "command": "npx",
      "args": ["godot-mcp-pilot"],
      "env": {
        "GODOT_PATH": "/path/to/Godot",
        "READ_ONLY_MODE": "true"
      }
    }
  }
}
```

## 2D vs 3D

godot-mcp-pilot works for both. Use the correct node types in your prompts:

| Feature | 2D | 3D |
|---|---|---|
| Player | `CharacterBody2D` | `CharacterBody3D` |
| Root | `Node2D` | `Node3D` |
| Camera | `Camera2D` | `Camera3D` |
| Mesh | `Sprite2D` | `MeshInstance3D` |
| Collision | `CollisionShape2D` | `CollisionShape3D` |
| Physics | `RigidBody2D` | `RigidBody3D` |
| Light | — | `DirectionalLight3D`, `OmniLight3D` |

## Compatibility

| Component | Supported versions |
|---|---|
| Godot | 4.x (tested on 4.2, 4.3, 4.4). Godot 3.x basic tools work. |
| Node.js | 18+ |
| MCP Protocol | 2024-11-05 |

## Security

- All file paths are validated against the project directory — no path traversal possible.
- `launch_editor` and `run_project` only invoke the Godot binary with predefined arguments.
- The server never executes arbitrary shell commands.
- Use `READ_ONLY_MODE=true` in untrusted environments.
