// shop/scripts/seed-delivery-photos.js — TEST DATA ONLY.
// Gives a sample proof-of-delivery photo to every delivered order that has none and was delivered
// on or after FROM (default 2026-11-16, the day proof photos became required). Orders delivered
// earlier keep "No photo. This order was delivered before proof-of-delivery photos were required."
// Run from the shop folder:  node scripts/seed-delivery-photos.js
// Another start date:         node scripts/seed-delivery-photos.js 2026-11-01
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Op } from "sequelize";
import { sequelize, Order } from "../models/index.js";
import * as deliveryPhotoService from "../services/deliveryPhotoService.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const samples = fs.readdirSync(path.join(here, "sample-deliveries")).filter((f) => f.endsWith(".jpg")).sort();
const FROM = process.argv[2] || "2026-11-16";

try {
  const orders = await Order.findAll({
    where: { order_status: "delivered", delivered_at: { [Op.gte]: new Date(`${FROM}T00:00:00+08:00`) } },
    order: [["delivered_at", "ASC"]]
  });
  let added = 0;
  for (const o of orders) {
    if (deliveryPhotoService.photoFile(o.order_code)) continue; // already has a real photo
    const sample = samples[added % samples.length];
    const buffer = fs.readFileSync(path.join(here, "sample-deliveries", sample));
    deliveryPhotoService.savePhoto(o.order_code, { buffer, mimetype: "image/jpeg" });
    console.log(`✓ ${o.order_code}: ${sample}`);
    added++;
  }
  console.log(added ? `Added ${added} sample photo(s).` : `Every order delivered since ${FROM} already has a photo.`);
} catch (err) {
  console.error("✗", err.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
