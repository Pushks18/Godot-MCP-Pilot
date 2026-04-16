/**
 * Minimal .tscn (Godot scene text) parser and writer.
 *
 * The format consists of bracketed section headers followed by key=value pairs.
 * Example:
 *   [gd_scene format=3 uid="uid://abc123"]
 *   [ext_resource type="Script" path="res://player.gd" id="1_abc"]
 *   [node name="Player" type="CharacterBody2D"]
 *   [node name="Sprite2D" type="Sprite2D" parent="."]
 */

export interface TscnSection {
  header: string; // raw header line, e.g. [node name="Foo" type="Node2D" parent="."]
  attrs: Record<string, string>; // parsed header attributes
  props: string[]; // raw property lines
}

export interface TscnScene {
  sections: TscnSection[];
}

/** Parse a .tscn text into structured sections. */
export function parseTscn(text: string): TscnScene {
  const lines = text.split(/\r?\n/);
  const sections: TscnSection[] = [];
  let current: TscnSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      if (current) sections.push(current);
      current = {
        header: trimmed,
        attrs: parseHeaderAttrs(trimmed),
        props: [],
      };
    } else if (current && trimmed !== "") {
      current.props.push(line);
    }
  }
  if (current) sections.push(current);

  return { sections };
}

/** Serialize a parsed scene back to text. */
export function serializeTscn(scene: TscnScene): string {
  const parts: string[] = [];
  for (const section of scene.sections) {
    parts.push(section.header);
    if (section.props.length > 0) {
      parts.push(...section.props);
    }
    parts.push("");
  }
  return parts.join("\n");
}

/** Parse key="value" pairs from a header line like [node name="Foo" type="Node2D"]. */
export function parseHeaderAttrs(header: string): Record<string, string> {
  const inner = header.slice(1, -1); // strip [ ]
  const attrs: Record<string, string> = {};
  // Match: key="value" or key=value
  const re = /(\w+)=(?:"([^"]*)"|([\w.:/+-]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    attrs[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  // Also grab the section type (first word)
  const firstWord = inner.match(/^(\w+)/);
  if (firstWord) attrs["_type"] = firstWord[1];
  return attrs;
}

// Attributes that Godot always expects to be quoted strings.
// NOTE: "instance" is intentionally excluded — Godot writes it unquoted as a
// resource reference: instance=ExtResource("1_abc"), NOT instance="ExtResource(...)"
const QUOTED_ATTRS = new Set(["name", "type", "parent", "path", "groups"]);

/** Build a header string from a section type and attributes. */
export function buildHeader(type: string, attrs: Record<string, string | undefined>): string {
  let header = `[${type}`;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "_type" || v === undefined) continue;
    // Always quote string-valued attrs; leave bare numeric/keyword values unquoted
    if (QUOTED_ATTRS.has(k) || /[^a-zA-Z0-9_.:/+-]/.test(v)) {
      header += ` ${k}="${v}"`;
    } else {
      header += ` ${k}=${v}`;
    }
  }
  header += "]";
  return header;
}

/** Create a minimal new scene text with the given root node type. */
export function createMinimalScene(rootNodeType: string, uid?: string): string {
  const uidPart = uid ? ` uid="${uid}"` : "";
  return [
    `[gd_scene format=3${uidPart}]`,
    "",
    `[node name="${rootNodeType}" type="${rootNodeType}"]`,
    "",
  ].join("\n");
}

/** Find a node section by its Godot scene path (e.g. "." or "Player/Sprite2D"). */
export function findNodeSection(
  scene: TscnScene,
  nodePath: string
): TscnSection | undefined {
  for (const section of scene.sections) {
    if (section.attrs["_type"] !== "node") continue;
    const resolved = resolveNodePath(scene, section);
    if (resolved === nodePath) return section;
  }
  return undefined;
}

/**
 * Compute the full scene path of a node section (e.g. "Player/Sprite2D").
 * The root node has path ".".
 */
export function resolveNodePath(scene: TscnScene, section: TscnSection): string {
  const name = section.attrs["name"] ?? "";
  const parent = section.attrs["parent"];
  if (parent === undefined) return "."; // root
  if (parent === ".") return name;
  return `${parent}/${name}`;
}

/** Add a node section to the scene. */
export function addNodeSection(
  scene: TscnScene,
  nodeType: string,
  nodeName: string,
  parentPath?: string,
  properties?: Record<string, string>
): TscnScene {
  const attrs: Record<string, string | undefined> = {
    name: nodeName,
    type: nodeType,
    parent: parentPath ?? ".",
  };
  const header = buildHeader("node", attrs);
  const props: string[] = [];
  if (properties) {
    for (const [k, v] of Object.entries(properties)) {
      props.push(`${k} = ${v}`);
    }
  }
  const newSection: TscnSection = { header, attrs: { ...attrs, _type: "node" } as Record<string, string>, props };
  return { sections: [...scene.sections, newSection] };
}

/** Remove a node section by scene path. Also removes its children. */
export function removeNodeSection(scene: TscnScene, nodePath: string): TscnScene {
  const filtered = scene.sections.filter((section) => {
    if (section.attrs["_type"] !== "node") return true;
    const path = resolveNodePath(scene, section);
    // Remove the node and any descendants
    if (path === nodePath) return false;
    if (path.startsWith(nodePath + "/")) return false;
    return true;
  });
  return { sections: filtered };
}

/** Update properties of a node section. */
export function editNodeSection(
  scene: TscnScene,
  nodePath: string,
  properties: Record<string, string>
): TscnScene {
  const sections = scene.sections.map((section) => {
    if (section.attrs["_type"] !== "node") return section;
    if (resolveNodePath(scene, section) !== nodePath) return section;

    // Merge properties: update existing or append
    const newProps = [...section.props];
    for (const [k, v] of Object.entries(properties)) {
      const idx = newProps.findIndex((p) => p.match(new RegExp(`^\\s*${k}\\s*=`)));
      if (idx >= 0) {
        newProps[idx] = `${k} = ${v}`;
      } else {
        newProps.push(`${k} = ${v}`);
      }
    }
    return { ...section, props: newProps };
  });
  return { sections };
}
