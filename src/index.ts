#!/usr/bin/env node
import { startServer } from "./server.js";

startServer().catch((err) => {
  process.stderr.write(`[godot-mcp] Fatal error: ${err.message}\n`);
  process.exit(1);
});
