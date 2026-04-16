#!/usr/bin/env node
/**
 * godot-mcp-pilot setup script
 *
 * Detects your Godot binary and writes the MCP config to the right place:
 *   - Claude Code  →  <your-game-project>/.mcp.json
 *   - Claude Desktop → ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
 *                      %APPDATA%\Claude\claude_desktop_config.json (Windows)
 *
 * Run with:  node scripts/setup.js
 *       or:  npm run setup
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");
const { execFileSync } = require("child_process");

// ─── helpers ────────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

function bold(s) { return `\x1b[1m${s}\x1b[0m`; }
function green(s) { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s) { return `\x1b[33m${s}\x1b[0m`; }
function red(s) { return `\x1b[31m${s}\x1b[0m`; }
function dim(s) { return `\x1b[2m${s}\x1b[0m`; }

function checkGodot(binPath) {
  try {
    const out = execFileSync(binPath, ["--version"], { timeout: 5000, stdio: ["ignore", "pipe", "ignore"] });
    return out.toString().trim();
  } catch {
    return null;
  }
}

// ─── Godot candidate paths ──────────────────────────────────────────────────

function getCandidates() {
  const platform = os.platform();
  const home = os.homedir();

  if (platform === "win32") {
    return [
      "C:\\Program Files\\Godot\\Godot.exe",
      "C:\\Program Files (x86)\\Godot\\Godot.exe",
      path.join(home, "AppData\\Local\\Godot\\Godot.exe"),
    ];
  }

  if (platform === "darwin") {
    const appNames = [
      "Godot.app", "Godot_4.app",
      "Godot_v4.4.app", "Godot_v4.3.app", "Godot_v4.2.app",
      "Godot_v4.1.app",
    ];
    const dirs = [
      "/Applications",
      path.join(home, "Applications"),
      path.join(home, "Downloads"),
      path.join(home, "Desktop"),
    ];
    const candidates = [];
    for (const dir of dirs) {
      for (const app of appNames) {
        candidates.push(path.join(dir, app, "Contents/MacOS/Godot"));
      }
    }
    candidates.push("/usr/local/bin/godot", "/opt/homebrew/bin/godot");
    return candidates;
  }

  // Linux
  return [
    "/usr/bin/godot",
    "/usr/local/bin/godot",
    "/snap/bin/godot",
    path.join(home, ".local/bin/godot"),
  ];
}

// ─── Claude Desktop config path ─────────────────────────────────────────────

function claudeDesktopConfigPath() {
  const platform = os.platform();
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library/Application Support/Claude/claude_desktop_config.json");
  }
  if (platform === "win32") {
    return path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json");
  }
  // Linux
  return path.join(os.homedir(), ".config/Claude/claude_desktop_config.json");
}

// ─── Write .mcp.json (Claude Code) ──────────────────────────────────────────

function writeMcpJson(gameProjectDir, godotPath) {
  const mcpPath = path.join(gameProjectDir, ".mcp.json");
  let existing = {};
  if (fs.existsSync(mcpPath)) {
    try { existing = JSON.parse(fs.readFileSync(mcpPath, "utf8")); } catch {}
  }

  existing.mcpServers = existing.mcpServers || {};
  existing.mcpServers.godot = {
    command: "npx",
    args: ["godot-mcp-pilot"],
    ...(godotPath ? { env: { GODOT_PATH: godotPath } } : {}),
  };

  fs.writeFileSync(mcpPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
  return mcpPath;
}

// ─── Update Claude Desktop config ───────────────────────────────────────────

function updateClaudeDesktopConfig(godotPath) {
  const cfgPath = claudeDesktopConfigPath();
  let cfg = {};
  if (fs.existsSync(cfgPath)) {
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")); } catch {}
  } else {
    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
  }

  cfg.mcpServers = cfg.mcpServers || {};
  cfg.mcpServers.godot = {
    command: "npx",
    args: ["godot-mcp-pilot"],
    ...(godotPath ? { env: { GODOT_PATH: godotPath } } : {}),
  };

  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  return cfgPath;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n" + bold("godot-mcp-pilot setup") + "\n");

  // ── Step 1: Find Godot ────────────────────────────────────────────────────
  console.log("Searching for Godot...");
  const candidates = getCandidates();
  let foundGodot = null;
  let foundVersion = null;

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const version = checkGodot(c);
      if (version) {
        foundGodot = c;
        foundVersion = version;
        break;
      }
    }
  }

  let godotPath;
  if (foundGodot) {
    console.log(green(`✓ Found Godot ${foundVersion}`));
    console.log(dim(`  ${foundGodot}`));
    const ans = await ask(`\nUse this path? [Y/n] `);
    if (ans.trim().toLowerCase() === "n") {
      godotPath = (await ask("Enter full path to Godot binary: ")).trim();
      const version = checkGodot(godotPath);
      if (!version) {
        console.log(yellow("⚠ Could not verify that binary. Using it anyway."));
      } else {
        console.log(green(`✓ Godot ${version}`));
      }
    } else {
      godotPath = foundGodot;
    }
  } else {
    console.log(yellow("⚠ Godot not found automatically."));
    console.log(dim("  Check https://godotengine.org/download if you haven't installed it yet.\n"));
    godotPath = (await ask("Enter full path to Godot binary (or press Enter to skip): ")).trim();
    if (godotPath) {
      const version = checkGodot(godotPath);
      if (!version) {
        console.log(yellow("⚠ Could not run that binary. Check the path."));
      } else {
        console.log(green(`✓ Godot ${version}`));
      }
    } else {
      godotPath = null;
    }
  }

  // ── Step 2: Which client? ──────────────────────────────────────────────────
  console.log(`
${bold("Which AI client are you using?")}
  1) Claude Code  (CLI / IDE extension)
  2) Claude Desktop
  3) Both
  4) Other (show me the config snippet)
`);
  const clientChoice = (await ask("Choice [1-4]: ")).trim();

  // ── Step 3: Claude Code setup ─────────────────────────────────────────────
  if (["1", "3"].includes(clientChoice)) {
    console.log(`
${bold("Claude Code — .mcp.json location")}
${yellow("IMPORTANT:")} Claude Code reads .mcp.json from the directory where you ${bold("launch")} it.
That means the file must live in your ${bold("game project folder")}, not here.

Example: if your game is at ~/games/my-platformer, the file goes to
         ~/games/my-platformer/.mcp.json
`);
    const gameDir = (await ask("Path to your Godot game project (or '.' for current directory): ")).trim();
    const resolvedDir = gameDir === "." ? process.cwd() : path.resolve(gameDir.replace(/^~/, os.homedir()));

    if (!fs.existsSync(resolvedDir)) {
      console.log(yellow(`⚠ Directory not found: ${resolvedDir}. Creating it anyway.`));
      fs.mkdirSync(resolvedDir, { recursive: true });
    }

    const mcpPath = writeMcpJson(resolvedDir, godotPath);
    console.log(green(`\n✓ Written: ${mcpPath}`));
    console.log(dim(`\nNext: open Claude Code from inside ${resolvedDir}`));
    console.log(dim(`  cd ${resolvedDir} && claude`));
    console.log(dim(`\nThe godot MCP tools will be available immediately.`));
  }

  // ── Step 4: Claude Desktop setup ─────────────────────────────────────────
  if (["2", "3"].includes(clientChoice)) {
    const cfgPath = updateClaudeDesktopConfig(godotPath);
    console.log(green(`\n✓ Updated: ${cfgPath}`));
    console.log(dim("\nNext: quit and reopen Claude Desktop to load the new config."));
    console.log(dim("      Settings → Developer → MCP Servers should show 'godot'."));
  }

  // ── Step 5: Other / snippet ───────────────────────────────────────────────
  if (clientChoice === "4") {
    const snippet = {
      mcpServers: {
        godot: {
          command: "npx",
          args: ["godot-mcp-pilot"],
          ...(godotPath ? { env: { GODOT_PATH: godotPath } } : {}),
        },
      },
    };
    console.log("\nAdd this to your MCP config file:\n");
    console.log(JSON.stringify(snippet, null, 2));
    console.log(dim("\nCursor: .cursor/mcp.json in your project root"));
    console.log(dim("Cline:  .cline/mcp_settings.json"));
    console.log(dim("Windsurf: ~/.codeium/windsurf/mcp_config.json"));
  }

  // ── Step 6: 3D support note ───────────────────────────────────────────────
  console.log(`
${bold("What can godot-mcp-pilot build?")}
  ✓ 2D games   — scenes, sprites, tilemaps, physics
  ✓ 3D games   — MeshInstance3D, Camera3D, lights, physics bodies
  ✓ GDScript   — create, modify, analyze scripts
  ✓ Project settings, autoloads, input maps
  ✓ Run & debug — launch editor or headless, capture output

  Use ${bold("CharacterBody3D")} / ${bold("Node3D")} node types for 3D scenes,
  the same way you'd use CharacterBody2D for 2D.

${green("Setup complete!")} Start Claude Code in your game directory and try:
  "Create a 3D platformer scene with a CharacterBody3D player and a floor"
`);

  rl.close();
}

main().catch((err) => {
  console.error(red(`\nSetup failed: ${err.message}`));
  rl.close();
  process.exit(1);
});
