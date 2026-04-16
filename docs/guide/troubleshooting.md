# Troubleshooting

## "MCP server not connected" / tools not appearing

**Claude Code:** The `.mcp.json` must be in the directory where you run `claude`. Open a new terminal, `cd` into your game project, and run `claude` from there.

**Claude Desktop:** Make sure you edited `claude_desktop_config.json` (not `.mcp.json`) and fully quit and reopened the app.

## Godot not found

Set `GODOT_PATH` explicitly. On macOS, if Godot is still in Downloads:

```
GODOT_PATH=/Users/yourname/Downloads/Godot.app/Contents/MacOS/Godot
```

To find Godot:
```bash
# macOS / Linux
find ~/Downloads ~/Applications /Applications -name "Godot" -type f 2>/dev/null
```

## Scene parse errors / malformed .tscn

If Godot refuses to load a scene, check that `instance=` lines are **unquoted**:

```gdscript
# Correct
instance=ExtResource("1_abc")

# Wrong — Godot rejects this
instance="ExtResource(\"1_abc\")"
```

Run the project headless to see the exact error:
```bash
/path/to/Godot --path /path/to/project --headless --quit 2>&1
```

## MCP disconnects during a session

This is a known issue in some MCP host implementations. Workaround: close and reopen your AI client. The MCP server is stateless — reconnecting is safe.

## TypeScript build errors (development)

```bash
npm run build 2>&1 | head -40
```

Fix errors from the top down. Never skip `npm run build` before committing.

## DEBUG output

```bash
DEBUG=true npx godot-mcp-pilot
```

Prints detailed information about every tool call to stderr.
