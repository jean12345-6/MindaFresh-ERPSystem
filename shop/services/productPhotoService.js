// shop/services/productPhotoService.js — the photo the Online Shop shows for each product.
// Products belong to POS, so the Shop never writes the products table. The admin's photo is a file
// owned by the Shop: public/images/products/<product_code>.jpg|png|webp.
// The admin's photo is shown first; POS's products.image_url is the fallback.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AppError } from "../utils/appError.js";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "images", "products");
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const CODE = /^PRD-\d{4,}$/;
const fileFor = (code, ext) => path.join(DIR, `${code}.${ext}`);

// The first bytes of the file must really be a JPG, PNG or WebP (not just the name)
function realType(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "webp";
  return null;
}

// URL of the Shop's photo for this product, or null. ?v= changes when the photo changes, so browsers reload it.
export function photoUrl(code) {
  if (!CODE.test(code || "")) return null;
  for (const ext of Object.values(TYPES)) {
    const file = fileFor(code, ext);
    if (fs.existsSync(file)) return `/images/products/${code}.${ext}?v=${Math.floor(fs.statSync(file).mtimeMs)}`;
  }
  return null;
}

// +photoFile(code): the photo file on disk, or null. Used by GET /photos/:code, which POS shows over the LAN.
export function photoFile(code) {
  if (!CODE.test(code || "")) return null;
  for (const ext of Object.values(TYPES)) {
    const file = fileFor(code, ext);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

// What the storefront shows: the photo the Shop admin uploaded first (a local file, works with no internet),
// else POS's image_url (often an internet link), else the placeholder
export const imageFor = (product) => photoUrl(product.product_code) || product.image_url;

// Save an uploaded photo (multer memory file) as <code>.<ext>, replacing the old one
export function savePhoto(code, file) {
  if (!CODE.test(code)) throw new AppError("VALIDATION_ERROR", "Unknown product code.");
  if (!file) throw new AppError("VALIDATION_ERROR", "Please choose a photo first.");
  const ext = realType(file.buffer);
  if (!ext || !TYPES[file.mimetype]) throw new AppError("VALIDATION_ERROR", "The photo must be a JPG, PNG or WebP image.");
  fs.mkdirSync(DIR, { recursive: true });
  removePhoto(code);
  fs.writeFileSync(fileFor(code, ext), file.buffer);
}

export function removePhoto(code) {
  if (!CODE.test(code)) return;
  for (const ext of Object.values(TYPES)) fs.rmSync(fileFor(code, ext), { force: true });
}
