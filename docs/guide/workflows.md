# Example Workflows

## 3D Platformer

```
"Create a 3D scene with a StaticBody3D floor — MeshInstance3D box scaled 20×1×20"
"Add a CharacterBody3D player with a CapsuleShape3D collision"
"Create a 3D character controller script with jump and gravity"
"Add a Camera3D as a child of the player, offset Vector3(0, 2, 5)"
"Run the project and show any errors"
```

## 2D Top-Down Shooter

```
"Create a 2D scene called Main.tscn"
"Add a CharacterBody2D called Player at the center"
"Create a movement + shooting script for Player"
"Add an Area2D called Enemy that moves toward the player"
"Run the project and show errors"
```

## First-Person Controller (3D)

```
"Create a 3D scene with a Node3D root, MeshInstance3D floor, and DirectionalLight3D"
"Add a CharacterBody3D player with CollisionShape3D (CapsuleShape3D)"
"Write a GDScript for 3D first-person movement with mouse look"
"Attach the script to the player node"
"Add a Camera3D as child of player at Vector3(0, 1.6, 0)"
```

## 2D Platformer

```
"Create a 2D scene with a TileMapLayer for the level"
"Add a CharacterBody2D with a CollisionShape2D"
"Write a platformer movement script with jump, gravity, and coyote time"
"Add a Camera2D that follows the player"
```

## Setting Up a New Project from Scratch

```
"List my Godot projects"
"Get the project info for my-game"
"What is the main scene?"
"Set the main scene to res://scenes/Main.tscn"
"Add an autoload called GameManager with the script res://scripts/game_manager.gd"
```

## Debugging a Crash

```
"Run the project"
"Get the debug output"
"Stop the project"
"Show me the script at res://scripts/player.gd"
"The error is on line 42 — fix the null reference"
```

## Asset Management

```
"List all textures in res://assets/"
"Get info on res://assets/player_spritesheet.png"
"Load the sprite res://assets/player.png onto the Sprite2D node"
```
