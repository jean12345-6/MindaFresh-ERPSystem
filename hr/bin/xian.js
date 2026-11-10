#!/usr/bin/env node
// PeoplePay CLI adapter for the XianFire project conventions.
// XianFire © 2025 Christian I. Cabrera, Mindoro State University (MIT).
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cmd = process.argv[2] || "start";
const commands = {
  start: ["index.js"],
  dev: ["--watch", "index.js"],
  migrate: ["migrate.js"],
  test: ["--test", "tests/payroll.test.js", "tests/xian-views.test.js"],
  "route:list": ["route-list.js"],
};
if (!commands[cmd]) {
  console.log(
    "PeoplePay / XianFire: xian start | dev | migrate | test | route:list",
  );
  process.exit(cmd === "help" ? 0 : 1);
}
const child = spawn(process.execPath, commands[cmd], { cwd, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
