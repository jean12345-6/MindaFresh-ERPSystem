// pos/middleware/security.js — hardening that needs no extra packages.
// securityHeaders: basic browser protections. sameOrigin: blocks cross-site form posts (CSRF). loginLimiter: slows password guessing.

export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

// Every POST must come from this same site. Browsers always send Origin (or at least Referer) on form posts.
export function sameOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const source = req.get("origin") || req.get("referer");
  if (source) {
    let host = "";
    try { host = new URL(source).host; } catch { /* malformed header */ }
    if (host !== req.get("host")) {
      return res.status(403).render("error", { title: "Request blocked", heading: "Request blocked", message: "This request did not come from the POS itself, so it was stopped. Go back and try again from the POS page." });
    }
  }
  next();
}

// Max 8 failed logins per IP + username in 15 minutes. A good login clears the count.
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000, MAX_FAILS = 8;
const keyOf = (req) => `${req.ip}|${String(req.body?.username || "").toLowerCase().slice(0, 60)}`;

export function loginLimiter(req, res, next) {
  const k = keyOf(req);
  const now = Date.now();
  const rec = attempts.get(k);
  if (rec && now - rec.first > WINDOW_MS) attempts.delete(k);
  const cur = attempts.get(k);
  if (cur && cur.count >= MAX_FAILS) {
    const mins = Math.ceil((WINDOW_MS - (now - cur.first)) / 60000);
    return res.status(429).render("error", { title: "Too many attempts", heading: "Too many login attempts", message: `Wait about ${mins} minute(s), then try again.` });
  }
  res.on("finish", () => {
    // a redirect to /login means failure; anything else to a page means success
    const failed = res.statusCode === 302 && String(res.getHeader("location") || "") === "/login";
    if (failed) {
      const r = attempts.get(k) || { count: 0, first: Date.now() };
      r.count += 1; attempts.set(k, r);
    } else if (res.statusCode === 302) attempts.delete(k);
  });
  next();
}
setInterval(() => { const now = Date.now(); for (const [k, v] of attempts) if (now - v.first > WINDOW_MS) attempts.delete(k); }, 10 * 60 * 1000).unref();
