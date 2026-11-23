// Runs after `npm install` at the repo root: installs each module's own dependencies (production only).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.SKIP_MODULE_INSTALL === "1") process.exit(0);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
for (const m of ["shop", "pos", "attendance", "hr", "accounting"]) {
  const dir = path.join(root, m);
  if (!fs.existsSync(path.join(dir, "package.json"))) { console.log(`skip ${m} (no package.json)`); continue; }
  const lock = fs.existsSync(path.join(dir, "package-lock.json"));
  console.log(`installing ${m} ...`);
  execFileSync(npm, [lock ? "ci" : "install", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: dir, stdio: "inherit", shell: process.platform === "win32" });
}
