#!/usr/bin/env -S godot --headless --script
## godot_operations.gd
## Bundled GDScript for scene operations that require the Godot runtime.
## Usage: godot --path /my/project --headless --script godot_operations.gd -- '{"op":"create_scene",...}'
##
## This script is used internally by godot-mcp for operations that need Godot's
## scene/resource system (e.g. PackedScene loading, MeshLibrary export).

extends SceneTree

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.is_empty():
		printerr("[godot_operations] No arguments provided. Pass JSON as first user arg.")
		quit(1)
		return

	var json_str := args[0]
	var json := JSON.new()
	var err := json.parse(json_str)
	if err != OK:
		printerr("[godot_operations] Failed to parse JSON: ", json.get_error_message())
		quit(1)
		return

	var data: Dictionary = json.get_data()
	var op: String = data.get("op", "")

	match op:
		"export_mesh_library":
			_export_mesh_library(data)
		"validate_scene":
			_validate_scene(data)
		"run_scene":
			_run_scene(data)
		_:
			printerr("[godot_operations] Unknown operation: ", op)
			quit(1)

# ─── Export MeshLibrary ────────────────────────────────────────────────────────

func _export_mesh_library(data: Dictionary) -> void:
	var scene_path: String = data.get("scenePath", "")
	var output_path: String = data.get("outputPath", "")

	if scene_path.is_empty() or output_path.is_empty():
		printerr("[godot_operations] export_mesh_library requires scenePath and outputPath")
		quit(1)
		return

	var packed: PackedScene = load(scene_path)
	if packed == null:
		printerr("[godot_operations] Failed to load scene: ", scene_path)
		quit(1)
		return

	var scene_instance := packed.instantiate()
	var mesh_library := MeshLibrary.new()

	var item_id := 0
	for child in scene_instance.get_children():
		if child is MeshInstance3D:
			mesh_library.create_item(item_id)
			mesh_library.set_item_name(item_id, child.name)
			mesh_library.set_item_mesh(item_id, child.mesh)
			if child.get_surface_override_material_count() > 0:
				mesh_library.set_item_mesh_transform(item_id, child.transform)
			item_id += 1

	var save_err := ResourceSaver.save(mesh_library, output_path)
	if save_err != OK:
		printerr("[godot_operations] Failed to save MeshLibrary to: ", output_path, " error=", save_err)
		quit(1)
		return

	print(JSON.stringify({"exported": true, "itemCount": item_id, "meshLibraryPath": output_path}))
	quit(0)

# ─── Validate Scene ────────────────────────────────────────────────────────────

func _validate_scene(data: Dictionary) -> void:
	var scene_path: String = data.get("scenePath", "")
	if scene_path.is_empty():
		printerr("[godot_operations] validate_scene requires scenePath")
		quit(1)
		return

	var packed = load(scene_path)
	if packed == null:
		print(JSON.stringify({"valid": false, "error": "Failed to load scene (possibly corrupt or missing resources)"}))
		quit(0)
		return

	var instance = packed.instantiate()
	if instance == null:
		print(JSON.stringify({"valid": false, "error": "Failed to instantiate scene"}))
		quit(0)
		return

	instance.free()
	print(JSON.stringify({"valid": true, "nodeType": packed.get_state().get_node_type(0)}))
	quit(0)

# ─── Run Scene (headless, for CI) ─────────────────────────────────────────────

func _run_scene(data: Dictionary) -> void:
	var scene_path: String = data.get("scenePath", "")
	var timeout: float = float(data.get("timeoutSeconds", 5.0))

	if scene_path.is_empty():
		printerr("[godot_operations] run_scene requires scenePath")
		quit(1)
		return

	var packed = load(scene_path)
	if packed == null:
		printerr("[godot_operations] Failed to load scene: ", scene_path)
		quit(1)
		return

	# Change to the loaded scene
	change_scene_to_packed(packed)

	# Auto-quit after timeout
	var timer := Timer.new()
	timer.wait_time = timeout
	timer.one_shot = true
	timer.timeout.connect(func(): quit(0))
	get_root().add_child(timer)
	timer.start()
