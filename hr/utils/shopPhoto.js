// shared/utils/shopPhoto.js — product photos uploaded in the Online Shop admin (owner: Ali)
// The photo files live on the Shop's laptop. Any module shows them over the LAN with:
//   <img src="{{shopPhoto product_code}}" alt="" onerror="this.remove()">
// Set SHOP_URL in the module's .env:  http://<Shop laptop IP>:3001   (solo mode: http://localhost:3001)
// The Shop answers 404 when a product has no photo, so onerror removes the broken image.

export function shopPhotoUrl(productCode) {
  const base = (process.env.SHOP_URL || "http://localhost:3001").replace(/\/+$/, "");
  return `${base}/photos/${encodeURIComponent(productCode || "")}`;
}

// Call once in index.js:  import hbs from "hbs"; import { registerShopPhoto } from "./utils/shopPhoto.js"; registerShopPhoto(hbs);
export function registerShopPhoto(hbs) {
  hbs.registerHelper("shopPhoto", (code) => shopPhotoUrl(code));
}
