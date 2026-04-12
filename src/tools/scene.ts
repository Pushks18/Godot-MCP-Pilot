import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { mkdirSync } from "fs";
import { validatePath, resPathToFs } from "../utils/path.js";
import {
  parseTscn,
  serializeTscn,
  createMinimalScene,
  findNodeSection,
  addNodeSection,
  removeNodeSection,
  editNodeSection,
  TscnScene,
} from "../utils/tscn.js";

function readScene(projectPath: string, scenePath: string): { fsPath: string; text: string; scene: TscnScene } {
  const absProject = resolve(projectPath);
  const fsPath = scenePath.startsWith("res://")
    ? resPathToFs(absProject, scenePath)
    : validatePath(absProject, scenePath);

  if (!existsSync(fsPath)) {
    throw new Error(`Scene file not found: "${scenePath}"`);
  }

  const text = readFileSync(fsPath, "utf8");
  const scene = parseTscn(text);
  return { fsPath, text, scene };
}

function writeScene(fsPath: string, scene: TscnScene): void {
  mkdirSync(dirname(fsPath), { recursive: true });
  writeFileSync(fsPath, serializeTscn(scene), "utf8");
}

/** List all .tscn scene files in a project. */
export function listProjectScenes(projectPath: string): { scenes: string[] } {
  const absPath = resolve(projectPath);
  const scenes: string[] = [];

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
        } else if (entry.endsWith(".tscn") || entry.endsWith(".scn")) {
          // Return as res:// path
          const rel = full.slice(absPath.length + 1).replace(/\\/g, "/");
          scenes.push(`res://${rel}`);
        }
      } catch {
        // skip
      }
    }
  }

  walk(absPath);
  return { scenes };
}

/** Read a scene file and return its raw text plus a structured node list. */
export function readSceneFile(
  projectPath: string,
  scenePath: string
): { content: string; nodes: Array<{ path: string; type: string }> } {
  const { text, scene } = readScene(projectPath, scenePath);

  const nodes: Array<{ path: string; type: string }> = [];
  for (const section of scene.sections) {
    if (section.attrs["_type"] === "node") {
      const name = section.attrs["name"] ?? "";
      const parent = section.attrs["parent"];
      const type = section.attrs["type"] ?? "Node";
      const path = parent === undefined ? "." : parent === "." ? name : `${parent}/${name}`;
      nodes.push({ path, type });
    }
  }

  return { content: text, nodes };
}

/** Create a new .tscn with a given root node type. */
export function createScene(
  projectPath: string,
  scenePath: string,
  rootNodeType = "Node"
): { created: boolean; path: string } {
  const absProject = resolve(projectPath);
  const fsPath = scenePath.startsWith("res://")
    ? resPathToFs(absProject, scenePath)
    : validatePath(absProject, scenePath);

  if (existsSync(fsPath)) {
    throw new Error(`Scene already exists: "${scenePath}"`);
  }

  const text = createMinimalScene(rootNodeType);
  mkdirSync(dirname(fsPath), { recursive: true });
  writeFileSync(fsPath, text, "utf8");

  return { created: true, path: fsPath };
}

/** Save a scene (overwrite existing or copy to newPath). */
export function saveScene(
  projectPath: string,
  scenePath: string,
  newPath?: string
): { saved: boolean; path: string } {
  const { fsPath, scene } = readScene(projectPath, scenePath);

  let targetPath = fsPath;
  if (newPath) {
    const absProject = resolve(projectPath);
    targetPath = newPath.startsWith("res://")
      ? resPathToFs(absProject, newPath)
      : validatePath(absProject, newPath);
  }

  writeScene(targetPath, scene);
  return { saved: true, path: targetPath };
}

/** Add a node to an existing scene. */
export function addNode(
  projectPath: string,
  scenePath: string,
  nodeType: string,
  nodeName: string,
  parentNodePath?: string,
  properties?: Record<string, string>
): { added: boolean; nodePath: string } {
  const { fsPath, scene } = readScene(projectPath, scenePath);

  const parent = parentNodePath ?? ".";
  // Validate parent exists
  if (parent !== ".") {
    const parentSection = findNodeSection(scene, parent);
    if (!parentSection) {
      throw new Error(`Parent node "${parent}" not found in scene`);
    }
  }

  const newScene = addNodeSection(scene, nodeType, nodeName, parent, properties);
  writeScene(fsPath, newScene);

  const nodePath = parent === "." ? nodeName : `${parent}/${nodeName}`;
  return { added: true, nodePath };
}

/** Edit properties of an existing node. */
export function editNode(
  projectPath: string,
  scenePath: string,
  nodePath: string,
  properties: Record<string, string>
): { edited: boolean } {
  const { fsPath, scene } = readScene(projectPath, scenePath);

  const section = findNodeSection(scene, nodePath);
  if (!section) {
    throw new Error(`Node "${nodePath}" not found in scene "${scenePath}"`);
  }

  const newScene = editNodeSection(scene, nodePath, properties);
  writeScene(fsPath, newScene);

  return { edited: true };
}

/** Remove a node (and its children) from a scene. */
export function removeNode(
  projectPath: string,
  scenePath: string,
  nodePath: string
): { removed: boolean } {
  const { fsPath, scene } = readScene(projectPath, scenePath);

  if (nodePath === ".") {
    throw new Error("Cannot remove the root node");
  }

  const section = findNodeSection(scene, nodePath);
  if (!section) {
    throw new Error(`Node "${nodePath}" not found in scene "${scenePath}"`);
  }

  const newScene = removeNodeSection(scene, nodePath);
  writeScene(fsPath, newScene);

  return { removed: true };
}

/** Load a texture into a Sprite2D node. */
export function loadSprite(
  projectPath: string,
  scenePath: string,
  nodePath: string,
  texturePath: string
): { loaded: boolean } {
  const { fsPath, scene } = readScene(projectPath, scenePath);

  const section = findNodeSection(scene, nodePath);
  if (!section) {
    throw new Error(`Node "${nodePath}" not found in scene "${scenePath}"`);
  }

  const nodeType = section.attrs["type"] ?? "";
  if (!nodeType.includes("Sprite") && !nodeType.includes("TextureRect")) {
    // Allow it but warn in the response — user knows best
  }

  // Ensure the texture is referenced as an ext_resource
  const resPath = texturePath.startsWith("res://") ? texturePath : `res://${texturePath}`;
  const existingExt = scene.sections.find(
    (s) => s.attrs["_type"] === "ext_resource" && s.attrs["path"] === resPath
  );

  let resourceId: string;
  let newScene: TscnScene;

  if (existingExt) {
    resourceId = existingExt.attrs["id"];
    newScene = scene;
  } else {
    // Generate a simple id
    resourceId = `tex_${Date.now()}`;
    const extHeader = `[ext_resource type="Texture2D" path="${resPath}" id="${resourceId}"]`;
    const extSection = {
      header: extHeader,
      attrs: { _type: "ext_resource", type: "Texture2D", path: resPath, id: resourceId },
      props: [],
    };
    // Insert after the gd_scene header
    const sections = [...scene.sections];
    const insertAt = sections.findIndex((s) => s.attrs["_type"] !== "gd_scene") ?? 1;
    sections.splice(Math.max(insertAt, 1), 0, extSection);
    newScene = { sections };
  }

  // Set texture property on the node
  const textureValue = `ExtResource("${resourceId}")`;
  const updatedScene = editNodeSection(newScene, nodePath, { texture: textureValue });
  writeScene(fsPath, updatedScene);

  return { loaded: true };
}
