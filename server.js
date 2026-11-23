// server.js - one entry point for hosting all five MindaFresh modules on ONE domain (Hostinger Node.js web app).
//   /          landing page
//   /shop      Online Shop        /pos         POS
//   /attendance  Attendance       /hr          HR
//   /accounting  Accounting
// Each module is started as its own process on a private port (3001..3005). This gateway sends each /<module>/... request to the
// right process and adds the /<module> prefix to the addresses in the pages (see deploy/rewrite.mjs). The modules are not changed.
import http from "node:http";
import net from "node:net";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { discoverSegments, makeRewriter } from "./deploy/rewrite.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.SESSION_SECRET || "";
const FORCE_HTTPS = process.env.FORCE_HTTPS === "1";
const MODULE_ENV = process.env.MODULE_NODE_ENV || "production";
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
if (SECRET.length < 32 && MODULE_ENV === "production") { console.error("Set SESSION_SECRET (at least 32 characters) in the app's environment variables."); process.exit(1); }

const MODS = [
  { id: "shop", port: 3001, name: "Online Shop", who: "Customers (register or log in). Staff: /shop/admin/login", entry: "/shop/", staff: "/shop/admin/login" },
  { id: "pos", port: 3002, name: "POS", who: "Cashier, Inventory Staff, Admin", entry: "/pos/login" },
  { id: "attendance", port: 3003, name: "Attendance", who: "Employee kiosk and HR / Admin log in", entry: "/attendance/login" },
  { id: "hr", port: 3004, name: "HR (PeoplePay)", who: "HR staff, Admin, and every employee's own profile", entry: "/hr/login" },
  { id: "accounting", port: 3005, name: "Accounting and Finance", who: "Accountant, Admin", entry: "/accounting/login" }
];
const byId = Object.fromEntries(MODS.map((m) => [m.id, m]));
for (const m of MODS) { m.dir = path.join(ROOT, m.id); m.rw = makeRewriter(m.id, discoverSegments(m.dir).filter((s) => s !== m.id)); m.up = false; m.restarts = 0; m.last = ""; }

const secretFor = (id) => crypto.createHmac("sha256", SECRET || "dev-only-secret").update(id).digest("hex");
const freePort = () => new Promise((resolve) => { const srv = net.createServer(); srv.listen(0, "127.0.0.1", () => { const p = srv.address().port; srv.close(() => resolve(p)); }); });
async function startModule(m) {
  m.port = await freePort(); // only used for PORT/log text; the real link is the unix socket below
  m.sock = process.platform === "win32" ? "\\\\.\\pipe\\mf-" + process.pid + "-" + m.id : path.join(os.tmpdir(), "mf-" + process.pid + "-" + m.id + ".sock");
  try { fs.unlinkSync(m.sock); } catch {}
  const env = { ...process.env, PORT: String(m.port), NODE_ENV: MODULE_ENV, TZ: process.env.TZ || "Asia/Manila", SESSION_SECRET: secretFor(m.id),
    TRUST_PROXY: "1", DB_PORT: process.env.DB_PORT || "3306", DB_PASSWORD: process.env.DB_PASS || process.env.DB_PASSWORD || "", ALLOW_ANY_DB_NAME: "1" };
  if (FORCE_HTTPS) env.COOKIE_SECURE = "1";
  if (m.id === "pos" && PUBLIC_URL) env.PUBLIC_URL = PUBLIC_URL + "/pos";
  // Shared hosting caps threads per account: keep each module to the fewest threads (small V8 pool, 2 libuv threads).
  env.UV_THREADPOOL_SIZE = "2"; env.MF_SOCKET = m.sock;
  let child;
  let restarted = false;
  const again = (why) => {
    if (restarted) return; restarted = true;
    m.up = false; m.restarts++;
    const wait = Math.min(30, m.restarts * 3);
    console.error(`[${m.id}] stopped (${why}). Restart ${m.restarts} in ${wait}s`);
    if (m.restarts <= 40) setTimeout(() => startModule(m), wait * 1000);
  };
  try { child = spawn(process.execPath, ["--require", path.join(ROOT, "deploy", "bind-ipv4.cjs"), "--v8-pool-size=1", "--max-old-space-size=160", "index.js"], { cwd: m.dir, env, stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { return again(e.message); }
  const log = (b) => { for (const line of String(b).split("\n")) if (line.trim()) { m.last = line.trim().slice(0, 300); console.log(`[${m.id}] ${line.trim()}`); } };
  child.stdout.on("data", log); child.stderr.on("data", log);
  child.on("error", (e) => again(e.code || e.message)); // e.g. EAGAIN when the host is out of threads
  child.on("exit", (code, sig) => again("code " + code + (sig ? " " + sig : "")));
  m.child = child;
}
// Modules listen on a unix socket (this host blocks loopback TCP between processes), so the gateway checks and proxies over that socket.
function probe(m) {
  if (!m.sock || !m.child) return;
  const s = net.connect({ path: m.sock }); s.setTimeout(1500);
  s.on("connect", () => { m.up = true; m.err = ""; s.destroy(); });
  s.on("error", (e) => { m.up = false; m.err = e.code || e.message; s.destroy(); });
  s.on("timeout", () => { m.up = false; m.err = "timeout"; s.destroy(); });
}
setInterval(() => MODS.forEach(probe), 2000);
MODS.forEach((m, i) => setTimeout(() => startModule(m), i * 2500)); // one at a time: the host limits how many threads start at once
process.on("SIGTERM", () => { MODS.forEach((m) => m.child?.kill()); process.exit(0); });
process.on("uncaughtException", (e) => console.error("gateway error:", e.message));

const REWRITE_TYPES = /^(text\/html|text\/css|text\/javascript|application\/javascript|application\/json)/i;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function landing(res) {
  const rows = MODS.map((m) => `<a class="card" href="${m.entry}"><b>${esc(m.name)}</b><span>${esc(m.who)}</span><i class="${m.up ? "ok" : "no"}">${m.up ? "online" : "starting..."}</i></a>`).join("");
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MindaFresh ERP</title><style>
body{margin:0;font-family:system-ui,Segoe UI,Arial,sans-serif;background:#FFF7EF;color:#2A1A12}main{max-width:760px;margin:0 auto;padding:40px 20px}h1{margin:0 0 4px}p{margin:0 0 24px;color:#6b4f3f}
.card{display:block;position:relative;background:#fff;border:1px solid #ead8c8;border-radius:14px;padding:16px 90px 16px 18px;margin:0 0 12px;text-decoration:none;color:inherit}.card:hover{border-color:#C2410C}
.card b{display:block;font-size:18px}.card span{display:block;color:#6b4f3f;font-size:14px;margin-top:2px}.card i{position:absolute;right:16px;top:18px;font-style:normal;font-size:12px;font-weight:700;padding:3px 9px;border-radius:99px}
.ok{background:#e7f6ec;color:#17692f}.no{background:#fdecea;color:#a1271c}</style></head><body><main>
<h1>MindaFresh ERP</h1><p>MindaFresh Food Distribution, Inc. Pick a module.</p>${rows}</main></body></html>`);
}
function notReady(res, m) {
  res.writeHead(503, { "content-type": "text/html; charset=utf-8", "retry-after": "5", "cache-control": "no-store" });
  res.end(`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="5"><title>${esc(m.name)} is starting</title><body style="font-family:system-ui;padding:40px"><h2>${esc(m.name)} is starting</h2><p>This page reloads by itself in a few seconds.</p><p style="color:#888;font-size:13px">${esc(m.last)}</p></body>`);
}

const server = http.createServer((req, res) => {
  const url = req.url || "/";
  if (url === "/healthz") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(Object.fromEntries(MODS.map((m) => [m.id, m.up ? "up" : "down" + (m.err ? " (" + m.err + ")" : "")])))); }
  if (url === "/" || url.startsWith("/?")) return landing(res);
  const mm = url.match(/^\/([a-z]+)(\/.*|\?.*)?$/);
  const m = mm && byId[mm[1]];
  if (!m) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); return res.end("Not found. Open / to pick a module."); }
  if (!mm[2]) { res.writeHead(302, { location: `/${m.id}/` }); return res.end(); }
  if (mm[2].startsWith("?")) { res.writeHead(302, { location: `/${m.id}/${mm[2]}` }); return res.end(); }
  if (!m.up) return notReady(res, m);

  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").toLowerCase();
  const proto = FORCE_HTTPS ? "https" : (req.headers["x-forwarded-proto"] || "http");
  const headers = { ...req.headers, host: req.headers.host, "accept-encoding": "identity", "x-forwarded-host": host, "x-forwarded-proto": proto, "x-forwarded-for": String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress };
  const up = http.request({ socketPath: m.sock, method: req.method, path: mm[2], headers }, (ur) => {
    const h = { ...ur.headers };
    const names = new Set([host, req.headers.host?.toLowerCase(), `localhost:${m.port}`, `127.0.0.1:${m.port}`].filter(Boolean));
    if (h.location) h.location = m.rw.location(h.location, names);
    if (h["set-cookie"]) h["set-cookie"] = [].concat(h["set-cookie"]).map((c) => m.rw.cookie(c));
    const ct = String(h["content-type"] || "");
    if (!REWRITE_TYPES.test(ct)) { res.writeHead(ur.statusCode, h); return ur.pipe(res); }
    const chunks = [];
    ur.on("data", (c) => chunks.push(c));
    ur.on("end", () => {
      let t = Buffer.concat(chunks).toString("utf8");
      t = /^text\/html/i.test(ct) ? m.rw.html(t) : m.rw.text(t);
      const buf = Buffer.from(t, "utf8");
      delete h["content-length"]; delete h.etag; delete h["content-encoding"];
      h["content-length"] = buf.length;
      res.writeHead(ur.statusCode, h); res.end(buf);
    });
  });
  up.on("error", (e) => { if (!res.headersSent) { res.writeHead(502, { "content-type": "text/plain" }); } res.end("The " + m.name + " module did not answer: " + e.message); });
  req.pipe(up);
});
server.listen(PORT, () => console.log(`MindaFresh gateway on port ${PORT}. Modules: ${MODS.map((m) => m.id).join(", ")} (private ports are chosen at start)`));
