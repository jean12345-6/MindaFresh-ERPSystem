// pos/utils/upload.js — image-only uploads saved to pos/public/uploads (served at /uploads/...).
// Accepts PNG, JPEG, WEBP, GIF only, max 3 MB. The file CONTENT is checked (not just the name), so a PDF renamed to .png is refused.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { publicBase } from "./publicUrl.js";

const DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 3 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });

function sniff(buf) {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length > 6 && ["GIF87a", "GIF89a"].includes(buf.toString("ascii", 0, 6))) return "gif";
  return null;
}

// Redirect target after a failed upload: only a path on this site, never an outside address.
function safeBack(req) {
  try { const u = new URL(req.get("referer") || "", "http://x"); return u.pathname.startsWith("/") && !u.pathname.startsWith("//") ? u.pathname : "/"; } catch { return "/"; }
}

// Express middleware: parses one image field. On a bad file it flashes the error and redirects back.
export const imageField = (field) => (req, res, next) => {
  upload.single(field)(req, res, (err) => {
    const fail = (msg) => { req.flash("error_msg", msg); res.redirect(safeBack(req)); };
    if (err) return fail(err.code === "LIMIT_FILE_SIZE" ? "The image must be 3 MB or smaller." : "The upload failed. Try again.");
    if (!req.file) return next();
    const ext = sniff(req.file.buffer);
    if (!ext) return fail("Only image files are allowed (PNG, JPG, WEBP or GIF).");
    try {
      fs.mkdirSync(DIR, { recursive: true });
      const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
      fs.writeFileSync(path.join(DIR, name), req.file.buffer);
      req.uploadedImage = `/uploads/${name}`;              // for this POS only (store image)
      req.uploadedImageUrl = `${publicBase()}/uploads/${name}`; // full address, so the Online Shop can load it too
      next();
    } catch (e) { next(e); }
  });
};

// Delete an old uploaded file (only ever inside public/uploads).
export function removeUpload(url) {
  if (!url || !url.includes("/uploads/")) return;
  const file = path.join(DIR, path.basename(url));
  try { fs.unlinkSync(file); } catch { /* already gone */ }
}
