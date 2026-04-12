import { existsSync } from "fs";
import { join } from "path";
import os from "os";

function findGodotBinary(): string {
  // Respect explicit env var first
  if (process.env.GODOT_PATH) return process.env.GODOT_PATH;

  const platform = os.platform();

  const candidates: string[] = [];

  if (platform === "win32") {
    candidates.push(
      "C:\\Program Files\\Godot\\Godot.exe",
      "C:\\Program Files (x86)\\Godot\\Godot.exe",
      join(os.homedir(), "AppData\\Local\\Godot\\Godot.exe"),
      "godot.exe",
      "godot4.exe"
    );
  } else if (platform === "darwin") {
    candidates.push(
      "/Applications/Godot.app/Contents/MacOS/Godot",
      "/Applications/Godot_4.app/Contents/MacOS/Godot",
      "/usr/local/bin/godot",
      "/opt/homebrew/bin/godot",
      join(os.homedir(), "Applications/Godot.app/Contents/MacOS/Godot"),
      "godot"
    );
  } else {
    // Linux
    candidates.push(
      "/usr/bin/godot",
      "/usr/local/bin/godot",
      "/snap/bin/godot",
      join(os.homedir(), ".local/bin/godot"),
      "godot"
    );
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  // Fall back to PATH lookup
  return "godot";
}

export const config = {
  godotPath: findGodotBinary(),
  readOnlyMode: process.env.READ_ONLY_MODE === "true",
  debug: process.env.DEBUG === "true",
};
