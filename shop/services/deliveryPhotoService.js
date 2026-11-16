// shop/services/deliveryPhotoService.js — proof of delivery.
// The rider (or admin) takes a photo when handing over the order. It is saved as a file owned by the Shop:
// uploads/deliveries/<order_code>.jpg|png|webp. The folder is NOT public: the photo shows the customer's home,
// so it is served only through GET /delivery-photos/:code to the order's customer and to staff.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AppError } from "../utils/appError.js";
import { EXTS, checkImage } from "../utils/imageFile.js";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads", "deliveries");
const CODE = /^ORD-\d{4,}$/;
const fileFor = (code, ext) => path.join(DIR, `${code}.${ext}`);

// +photoFile(code): the proof photo on disk, or null
export function photoFile(code) {
  if (!CODE.test(code || "")) return null;
  for (const ext of EXTS) {
    const file = fileFor(code, ext);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

// +photoUrl(code): where the order pages load the proof photo from, or null
export function photoUrl(code) {
  const file = photoFile(code);
  return file ? `/delivery-photos/${code}?v=${Math.floor(fs.statSync(file).mtimeMs)}` : null;
}

// +savePhoto(code, file): save the uploaded photo (multer memory file), replacing an old one
export function savePhoto(code, file) {
  if (!CODE.test(code || "")) throw new AppError("VALIDATION_ERROR", "Unknown order code.");
  if (!file) throw new AppError("VALIDATION_ERROR", "Please take or choose a photo of the delivered order first.");
  const ext = checkImage(file);
  fs.mkdirSync(DIR, { recursive: true });
  removePhoto(code);
  fs.writeFileSync(fileFor(code, ext), file.buffer);
}

export function removePhoto(code) {
  if (!CODE.test(code || "")) return;
  for (const ext of EXTS) fs.rmSync(fileFor(code, ext), { force: true });
}
