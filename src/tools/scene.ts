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
  resolveNodePath,
  buildHeader,
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

/** Duplicate a node (and its children) under the same parent with a new name. */
export function duplicateNode(
  projectPath: string,
  scenePath: string,
  nodePath: string,
  newName: string
): { duplicated: boolean; newPath: string } {
  const { fsPath, scene } = readScene(projectPath, scenePath);

  if (nodePath === ".") {
    throw new Error("Cannot duplicate the root node");
  }

  const targetSection = findNodeSection(scene, nodePath);
  if (!targetSection) {
    throw new Error(`Node "${nodePath}" not found in scene "${scenePath}"`);
  }

  // Gather the node and all its descendants
  const sections = scene.sections.filter((s) => {
    if (s.attrs["_type"] !== "node") return false;
    const p = resolveNodePath(scene, s);
    return p === nodePath || p.startsWith(nodePath + "/");
  });

  if (sections.length === 0) {
    throw new Error(`Node "${nodePath}" not found`);
  }

  // Determine parent path (strip last segment from nodePath)
  const lastSlash = nodePath.lastIndexOf("/");
  const originalParent = lastSlash >= 0 ? nodePath.slice(0, lastSlash) : ".";
  const originalName = lastSlash >= 0 ? nodePath.slice(lastSlash + 1) : nodePath;

  // Clone sections, rewriting paths
  const cloned = sections.map((s) => {
    const oldPath = resolveNodePath(scene, s);
    let newNodeName: string;
    let newParent: string;

    if (oldPath === nodePath) {
      // Root of the duplicated subtree
      newNodeName = newName;
      newParent = originalParent;
    } else {
      // Descendant — replace leading nodePath segment with newName path
      newNodeName = s.attrs["name"] ?? "";
      const descendantSuffix = oldPath.slice(nodePath.length + 1); // e.g. "Sprite2D"
      const newAncestorPath =
        originalParent === "." ? newName : `${originalParent}/${newName}`;
      const parts = descendantSuffix.split("/");
      parts.pop(); // last part is the node name
      newParent = parts.length === 0 ? newAncestorPath : `${newAncestorPath}/${parts.join("/")}`;
    }

    const newAttrs: Record<string, string | undefined> = {
      ...s.attrs,
      name: newNodeName,
      parent: newParent,
    };
    delete newAttrs["_type"];

    const newHeader = buildHeader("node", newAttrs);
    return {
      header: newHeader,
      attrs: { ...newAttrs, _type: "node" } as Record<string, string>,
      props: [...s.props],
    };
  });

  const newScene = { sections: [...scene.sections, ...cloned] };
  writeScene(fsPath, newScene);

  const newPath = originalParent === "." ? newName : `${originalParent}/${newName}`;
  return { duplicated: true, newPath };
}

/** Move a node to a different parent in the same scene. */
export function moveNode(
  projectPath: string,
  scenePath: string,
  nodePath: string,
  newParentPath: string
): { moved: boolean; newPath: string } {
  const { fsPath, scene } = readScene(projectPath, scenePath);

  if (nodePath === ".") {
    throw new Error("Cannot move the root node");
  }

  const targetSection = findNodeSection(scene, nodePath);
  if (!targetSection) {
    throw new Error(`Node "${nodePath}" not found in scene "${scenePath}"`);
  }

  // Validate new parent exists
  if (newParentPath !== ".") {
    const parentSection = findNodeSection(scene, newParentPath);
    if (!parentSection) {
      throw new Error(`Target parent "${newParentPath}" not found in scene`);
    }
  }

  // Prevent moving a node into its own subtree
  if (newParentPath.startsWith(nodePath + "/") || newParentPath === nodePath) {
    throw new Error(`Cannot move "${nodePath}" into its own subtree`);
  }

  const nodeName = targetSection.attrs["name"] ?? "";
  const oldParentPath =
    targetSection.attrs["parent"] !== undefined ? targetSection.attrs["parent"] : ".";

  const newSections = scene.sections.map((s) => {
    if (s.attrs["_type"] !== "node") return s;
    const currentPath = resolveNodePath(scene, s);

    if (currentPath === nodePath) {
      // Update the node's own parent
      const newAttrs: Record<string, string | undefined> = { ...s.attrs, parent: newParentPath };
      delete newAttrs["_type"];
      return {
        ...s,
        header: buildHeader("node", newAttrs),
        attrs: { ...newAttrs, _type: "node" } as Record<string, string>,
      };
    }

    if (currentPath.startsWith(nodePath + "/")) {
      // Update descendant parent paths
      const suffix = currentPath.slice(nodePath.length + 1); // e.g. "Sprite2D" or "Sub/Sprite"
      const parts = suffix.split("/");
      parts.pop(); // remove node's own name; we take it from attrs
      const descendantName = s.attrs["name"] ?? "";

      let newParent: string;
      if (parts.length === 0) {
        // Direct child of moved node
        newParent =
          newParentPath === "."
            ? nodeName
            : `${newParentPath}/${nodeName}`;
      } else {
        const ancestorSuffix = parts.join("/");
        newParent =
          newParentPath === "."
            ? `${nodeName}/${ancestorSuffix}`
            : `${newParentPath}/${nodeName}/${ancestorSuffix}`;
      }

      const newAttrs: Record<string, string | undefined> = { ...s.attrs, parent: newParent };
      delete newAttrs["_type"];
      return {
        ...s,
        header: buildHeader("node", newAttrs),
        attrs: { ...newAttrs, _type: "node" } as Record<string, string>,
      };
    }

    return s;
  });

  writeScene(fsPath, { sections: newSections });
  const newPath =
    newParentPath === "." ? nodeName : `${newParentPath}/${nodeName}`;
  return { moved: true, newPath };
}

/** Attach or detach a GDScript from a node in a scene. */
export function setSceneScript(
  projectPath: string,
  scenePath: string,
  nodePath: string,
  scriptPath?: string
): { updated: boolean } {
  const { fsPath, scene } = readScene(projectPath, scenePath);

  const nodeSection = findNodeSection(scene, nodePath);
  if (!nodeSection) {
    throw new Error(`Node "${nodePath}" not found in scene "${scenePath}"`);
  }

  if (!scriptPath) {
    // Detach: remove 'script' property from the node
    const newScene = editNodeSection(scene, nodePath, { script: "__REMOVE__" });
    // Filter out the __REMOVE__ placeholder
    const cleaned = {
      sections: newScene.sections.map((s) => {
        if (resolveNodePath(newScene, s) !== nodePath || s.attrs["_type"] !== "node") return s;
        return { ...s, props: s.props.filter((p) => !p.match(/^\s*script\s*=\s*__REMOVE__/)) };
      }),
    };
    writeScene(fsPath, cleaned);
    return { updated: true };
  }

  // Attach: add ext_resource entry for the script if not already present
  const resPath = scriptPath.startsWith("res://") ? scriptPath : `res://${scriptPath}`;

  let resourceId: string;
  let newScene: TscnScene;

  const existingExt = scene.sections.find(
    (s) =>
      s.attrs["_type"] === "ext_resource" &&
      s.attrs["path"] === resPath &&
      s.attrs["type"] === "Script"
  );

  if (existingExt) {
    resourceId = existingExt.attrs["id"];
    newScene = scene;
  } else {
    resourceId = `script_${Date.now()}`;
    const extHeader = `[ext_resource type="Script" path="${resPath}" id="${resourceId}"]`;
    const extSection = {
      header: extHeader,
      attrs: {
        _type: "ext_resource",
        type: "Script",
        path: resPath,
        id: resourceId,
      },
      props: [],
    };

    const sections = [...scene.sections];
    // Insert after the last existing ext_resource (or after gd_scene header)
    let insertAt = 1;
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].attrs["_type"] === "ext_resource") insertAt = i + 1;
    }
    sections.splice(insertAt, 0, extSection);
    newScene = { sections };
  }

  const scriptValue = `ExtResource("${resourceId}")`;
  const updated = editNodeSection(newScene, nodePath, { script: scriptValue });
  writeScene(fsPath, updated);
  return { updated: true };
}

/** Instantiate a packed scene (sub-scene) as a child node in this scene. */
export function instantiateScene(
  projectPath: string,
  scenePath: string,
  subScenePath: string,
  parentNodePath?: string,
  nodeName?: string
): { instantiated: boolean; nodePath: string } {
  const { fsPath, scene } = readScene(projectPath, scenePath);

  const parent = parentNodePath ?? ".";
  if (parent !== ".") {
    const parentSection = findNodeSection(scene, parent);
    if (!parentSection) {
      throw new Error(`Parent node "${parent}" not found in scene "${scenePath}"`);
    }
  }

  const resPath = subScenePath.startsWith("res://")
    ? subScenePath
    : `res://${subScenePath}`;

  // Derive node name from scene filename if not given
  const defaultName =
    resPath
      .split("/")
      .pop()
      ?.replace(/\.tscn$|\.scn$/, "") ?? "Instance";
  const name = nodeName ?? defaultName;

  // Reuse existing ext_resource for this packed scene if present
  let resourceId: string;
  let workingScene: TscnScene;

  const existingExt = scene.sections.find(
    (s) =>
      s.attrs["_type"] === "ext_resource" &&
      s.attrs["path"] === resPath &&
      s.attrs["type"] === "PackedScene"
  );

  if (existingExt) {
    resourceId = existingExt.attrs["id"];
    workingScene = scene;
  } else {
    resourceId = `ps_${Date.now()}`;
    const extHeader = `[ext_resource type="PackedScene" path="${resPath}" id="${resourceId}"]`;
    const extSection = {
      header: extHeader,
      attrs: {
        _type: "ext_resource",
        type: "PackedScene",
        path: resPath,
        id: resourceId,
      },
      props: [],
    };

    const sections = [...scene.sections];
    let insertAt = 1;
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].attrs["_type"] === "ext_resource") insertAt = i + 1;
    }
    sections.splice(insertAt, 0, extSection);
    workingScene = { sections };
  }

  // Build the instance node header (no 'type' attr — Godot uses instance= instead)
  const instanceValue = `ExtResource("${resourceId}")`;
  const instanceAttrs: Record<string, string | undefined> = {
    name,
    parent,
    instance: instanceValue,
  };
  const instanceHeader = buildHeader("node", instanceAttrs);
  const instanceSection = {
    header: instanceHeader,
    attrs: { ...instanceAttrs, _type: "node" } as Record<string, string>,
    props: [],
  };

  const newScene = { sections: [...workingScene.sections, instanceSection] };
  writeScene(fsPath, newScene);

  const newNodePath = parent === "." ? name : `${parent}/${name}`;
  return { instantiated: true, nodePath: newNodePath };
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
