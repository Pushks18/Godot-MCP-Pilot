# Getting Started

godot-mcp is a [Model Context Protocol](https://modelcontextprotocol.io) server that lets AI assistants (Claude, Cursor, Cline, etc.) control your Godot 4 projects through natural language.

## Prerequisites

- **Node.js 18+**
- **Godot 4.x** installed ([download](https://godotengine.org/download))
- An MCP-compatible AI client — Claude Code, Claude Desktop, or Cursor

## Install

### Via npx (no install)

```bash
npx godot-mcp
```

### Global install

```bash
npm install -g godot-mcp
```

## Connect your AI client

### Claude Code

> **Important:** Claude Code reads `.mcp.json` from the directory where you *launch* it. Put the file in your **game project folder**.

```bash
# Inside your game project directory:
claude mcp add godot -- npx godot-mcp
```

If Godot is in a non-standard location:

```bash
claude mcp add godot -e GODOT_PATH=/path/to/Godot -- npx godot-mcp
```

Or write `.mcp.json` manually in your game project root:

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

Then always launch Claude Code from that directory:

```bash
cd ~/games/my-platformer
claude
```

### Claude Desktop

Edit the config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

Quit and reopen Claude Desktop after saving.

### Cursor

Create or edit `.cursor/mcp.json` in your project root:

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

## Godot path auto-detection

If `GODOT_PATH` is not set, the server searches common locations automatically:

| OS | Paths checked |
|---|---|
| **macOS** | `/Applications/Godot.app`, versioned names, `~/Applications`, `~/Downloads`, Homebrew |
| **Linux** | `/usr/bin/godot`, `/usr/local/bin/godot`, `/snap/bin/godot`, `~/.local/bin/godot` |
| **Windows** | `C:\Program Files\Godot\Godot.exe`, `%LOCALAPPDATA%\Godot\Godot.exe` |

## Try it

Once connected, ask your AI assistant:

```
"What version of Godot is installed?"
"Create a 3D scene called Main with a Node3D root"
"Run the project and show me any errors"
```
