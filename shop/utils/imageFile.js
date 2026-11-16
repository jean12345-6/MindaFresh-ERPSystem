// shop/utils/imageFile.js — checks for uploaded photos (proof of delivery, review photos)
import { AppError } from "./appError.js";

export const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const EXTS = Object.values(TYPES);
export const MAX_BYTES = 2 * 1024 * 1024; // 2 MB per photo

// The first bytes of the file must really be a JPG, PNG or WebP (not just the name)
export function realType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "webp";
  return null;
}

// +checkImage(file): the file's extension, or an error a person can act on
export function checkImage(file) {
  const ext = realType(file?.buffer);
  if (!ext || !TYPES[file.mimetype]) throw new AppError("VALIDATION_ERROR", "Photos must be JPG, PNG or WebP images.");
  return ext;
}

// The message for a multer upload error
export function uploadMessage(err, max = 1) {
  if (err.code === "LIMIT_FILE_SIZE") return "A photo is too big. Please use photos under 2 MB each.";
  if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") return `You can attach up to ${max} photo${max > 1 ? "s" : ""}.`;
  return "The photo could not be uploaded. Please try again.";
}
