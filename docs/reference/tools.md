# Tool Catalog

All tools exposed by godot-mcp-pilot to your AI assistant.

---

## System

| Tool | Description |
|---|---|
| `get_godot_version` | Returns the installed Godot version string |
| `list_projects` | Lists all Godot projects in a given directory |
| `get_project_info` | Returns metadata about a specific project |

---

## Editor & Execution

| Tool | Description |
|---|---|
| `launch_editor` | Opens the Godot editor for a project |
| `run_project` | Launches the project in play mode |
| `stop_project` | Terminates the running project process |
| `get_debug_output` | Returns stdout/stderr captured from the last run |
| `run_gdscript` | Executes an arbitrary GDScript snippet and returns its output |

---

## Scenes

| Tool | Description |
|---|---|
| `list_project_scenes` | Lists all `.tscn` files in the project |
| `read_scene` | Returns the parsed contents of a scene file |
| `create_scene` | Creates a new `.tscn` file with a given root node |
| `save_scene` | Saves modifications back to a `.tscn` file |

---

## Nodes

| Tool | Description |
|---|---|
| `add_node` | Adds a node to a scene under a specified parent |
| `edit_node` | Modifies properties on an existing node |
| `remove_node` | Removes a node from a scene |
| `duplicate_node` | Duplicates a node (with its children) |
| `move_node` | Moves a node to a different parent or position |
| `load_sprite` | Sets a texture resource on a Sprite2D / Sprite3D node |
| `instantiate_scene` | Adds an instance of a packed scene into the current scene |
| `set_scene_script` | Attaches a GDScript file to a scene's root node |

---

## Scripts

| Tool | Description |
|---|---|
| `list_project_scripts` | Lists all `.gd` files in the project |
| `read_script` | Returns the source of a GDScript file |
| `create_script` | Creates a new `.gd` file with optional boilerplate |
| `modify_script` | Replaces the full content of a script file |
| `analyze_script` | Parses a script and returns its structure (functions, signals, variables) |
| `list_script_functions` | Lists all function definitions in a script |
| `add_script_function` | Appends a new function to a script |
| `remove_script_function` | Removes a function from a script |
| `add_signal` | Adds a signal declaration to a script |
| `add_variable` | Adds a variable declaration to a script |

---

## Project Settings

| Tool | Description |
|---|---|
| `get_project_settings` | Returns current values from `project.godot` |
| `set_project_setting` | Writes a setting to `project.godot` |
| `get_main_scene` | Returns the configured main scene path |
| `set_main_scene` | Sets the main scene in `project.godot` |
| `list_autoloads` | Lists all autoload singletons |
| `add_autoload` | Registers a new autoload singleton |
| `remove_autoload` | Removes an autoload singleton |
| `list_input_actions` | Lists all configured input actions |
| `add_input_action` | Adds a new input action |
| `remove_input_action` | Removes an input action |

---

## Assets

| Tool | Description |
|---|---|
| `list_assets` | Lists assets in the project filtered by type or path |
| `get_asset_info` | Returns metadata about a specific asset |

---

## UIDs

| Tool | Description |
|---|---|
| `get_uid` | Returns the UID for a resource path |
| `update_project_uids` | Regenerates UID entries in `.uid` cache files |
