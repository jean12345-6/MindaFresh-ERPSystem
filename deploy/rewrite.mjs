// deploy/rewrite.mjs - puts a module's pages under /<prefix>/ so five apps can share one domain.
// The modules write root addresses such as href="/products" or fetch("/cashier/checkout").
// The gateway adds the module prefix to those addresses in what it sends to the browser. The modules are not changed.
import fs from "node:fs";
import path from "node:path";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The first path segments a module uses (css, js, cashier, products ...), found from its own files.
export function discoverSegments(dir) {
  const segs = new Set();
  const grab = (text) => { for (const m of text.matchAll(/["'`(=]\/([A-Za-z][A-Za-z0-9_.-]*)(?=[\/?#"'`)\s]|$)/g)) segs.add(m[1]); };
  const walk = (d, depth = 0) => {
    let list; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (depth < 6) walk(p, depth + 1); continue; }
      if (/\.(js|mjs|cjs|xian|hbs|html|css)$/.test(e.name) && fs.statSync(p).size < 400000) { try { grab(fs.readFileSync(p, "utf8")); } catch { /* skip */ } }
    }
  };
  for (const sub of ["views", "routes", "controllers", "middleware", "services", "utils", "helpers", "public"]) walk(path.join(dir, sub));
  for (const f of ["index.js", "storage.js", "app.js"]) { try { grab(fs.readFileSync(path.join(dir, f), "utf8")); } catch { /* skip */ } }
  // everything in public/ is served from the root: its names are segments too
  try { for (const e of fs.readdirSync(path.join(dir, "public"))) segs.add(e); } catch { /* none */ }
  for (const s of ["css", "js", "img", "images", "uploads", "fonts", "audio", "vendor"]) { try { if (fs.statSync(path.join(dir, "public", s)).isDirectory()) segs.add(s); } catch { /* none */ } }
  return [...segs].filter((s) => !/^(api)$/i.test(s) || true);
}

export function makeRewriter(prefix, segs) {
  const P = "/" + prefix;
  const segAlt = segs.map(esc).sort((a, b) => b.length - a.length).join("|");
  const startsPrefix = (rest) => rest === prefix || rest.startsWith(prefix + "/") || rest.startsWith(prefix + "?") || rest.startsWith(prefix + "#");
  // 1) attributes: any root-relative address
  const attrRe = /(\b(?:href|src|action|formaction|poster|data-src|data-href|data-url|data-action)\s*=\s*)(["'])\/(?!\/)([^"']*)/gi;
  const metaRe = /(content\s*=\s*["']\s*\d+\s*;\s*url=)\/(?!\/)/gi;
  // 2) quoted strings in scripts/json/css that start with a known segment
  const strRe = segAlt ? new RegExp("([\"'`(])\\/(" + segAlt + ")(?=[\\/?#\"'`)\\s\\\\]|$)", "g") : null;
  const urlRe = /(url\(\s*)(["']?)\/(?!\/)([^)"']*)/gi;
  const locRe = /((?:window\.)?location(?:\.href|\.assign|\.replace)?\s*(?:=|\()\s*)(["'])\/\2/g;
  const srcsetRe = /(\bsrcset\s*=\s*["'])([^"']*)/gi;
  const fixAttr = (rest) => (startsPrefix(rest) ? "/" + rest : P + "/" + rest);
  return {
    html(t) {
      t = t.replace(attrRe, (m, a, q, rest) => a + q + fixAttr(rest));
      t = t.replace(metaRe, (m, a) => a + P + "/");
      t = t.replace(srcsetRe, (m, a, list) => a + list.split(",").map((it) => { const s = it.trim(); return s.startsWith("/") && !s.startsWith("//") ? P + s : it; }).join(","));
      return this.text(t);
    },
    text(t) {
      if (strRe) t = t.replace(strRe, (m, q, seg) => q + P + "/" + seg);
      t = t.replace(urlRe, (m, a, q, rest) => (startsPrefix(rest) ? m : a + q + P + "/" + rest));
      t = t.replace(locRe, (m, a, q) => a + q + P + "/" + q);
      return t;
    },
    location(loc, hostNames) {
      if (!loc) return loc;
      if (loc.startsWith("//")) return loc;
      if (loc.startsWith("/")) return startsPrefix(loc.slice(1)) ? loc : P + loc;
      const m = loc.match(/^https?:\/\/([^/]+)(\/.*)?$/i);
      if (m && hostNames.has(m[1].toLowerCase())) { const rest = m[2] || "/"; return startsPrefix(rest.slice(1)) ? rest : P + rest; }
      return loc;
    },
    cookie(c) {
      if (/;\s*path=/i.test(c)) return c.replace(/;\s*path=([^;]*)/i, (m, p) => "; Path=" + (p === "/" ? P : P + p));
      return c + "; Path=" + P;
    }
  };
}
