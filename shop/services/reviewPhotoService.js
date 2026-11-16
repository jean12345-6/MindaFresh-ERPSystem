// shop/services/reviewPhotoService.js — photos a customer attaches to their product review.
// Up to 3 per review, saved as files owned by the Shop: public/images/reviews/<review id>-<1..3>.jpg|png|webp.
// Reviews are public, so these photos are public too (only visible reviews are listed on the product page).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { EXTS, checkImage } from "../utils/imageFile.js";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "images", "reviews");
export const MAX_PHOTOS = 3;
const NAME = /^(\d+)-([1-3])\.(jpg|png|webp)$/;

function filesOf(reviewId) {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR)
    .map((f) => f.match(NAME))
    .filter((m) => m && Number(m[1]) === Number(reviewId))
    .sort((a, b) => a[2] - b[2])
    .map((m) => m[0]);
}

// +photoUrls(reviewId): the review's photos, in order
export const photoUrls = (reviewId) =>
  filesOf(reviewId).map((f) => `/images/reviews/${f}?v=${Math.floor(fs.statSync(path.join(DIR, f)).mtimeMs)}`);

// +checkPhotos(files): every file must be a real image (checked before anything is saved)
export function checkPhotos(files = []) {
  return files.slice(0, MAX_PHOTOS).map((file) => ({ file, ext: checkImage(file) }));
}

// +replacePhotos(reviewId, checked): the new photos replace the old ones
export function replacePhotos(reviewId, checked) {
  removePhotos(reviewId);
  if (!checked.length) return;
  fs.mkdirSync(DIR, { recursive: true });
  checked.forEach(({ file, ext }, i) => fs.writeFileSync(path.join(DIR, `${reviewId}-${i + 1}.${ext}`), file.buffer));
}

export function removePhotos(reviewId) {
  filesOf(reviewId).forEach((f) => fs.rmSync(path.join(DIR, f), { force: true }));
}
