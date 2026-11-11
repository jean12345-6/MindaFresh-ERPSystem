// pos/controllers/settingsController.js — admin: POS settings (stored in pos/data/settings.json).
import { getSettings, saveSettings, resetSettings, parseSettingsForm, DEFAULT_IMAGE_URL, SHORTCUT_ACTIONS, ALLOWED_KEYS, DEFAULT_SHORTCUTS } from "../utils/settings.js";
import { removeUpload } from "../utils/upload.js";
import { sequelize } from "../models/index.js";
import { publicBase } from "../utils/publicUrl.js";
import { ensureBarcode } from "../utils/barcode.js";

export const settingsPage = async (req, res) => {
  const s = getSettings();
  const shortcuts = SHORTCUT_ACTIONS.map((a) => ({
    ...a, def: DEFAULT_SHORTCUTS[a.id],
    options: ALLOWED_KEYS.map((k) => ({ key: k, selected: k === s.shortcuts[a.id] }))
  }));
  const units = ["pc", "kg", "pack", "box", "tray"].map((u) => ({ u, selected: u === s.defaultUnit }));
  const pays = ["cash", "gcash", "card"].map((p) => ({ p, selected: p === s.defaultPayment }));
  res.render("settings/index", { title: "Settings", s, shortcuts, units, pays, imageBase: publicBase(), hasBarcode: await ensureBarcode() });
};

export const saveSettingsAction = (req, res) => {
  let next;
  try { next = parseSettingsForm(req.body); } catch (e) {
    req.flash("error_msg", e.message);
    return res.redirect("/settings");
  }
  const old = getSettings().storeImageUrl;
  let storeImageUrl = old;
  if (req.uploadedImage) storeImageUrl = req.uploadedImage;
  else if (req.body.reset_image === "1") storeImageUrl = DEFAULT_IMAGE_URL;
  saveSettings({ ...next, storeImageUrl });
  if (storeImageUrl !== old) removeUpload(old);
  req.flash("success_msg", "Settings saved.");
  res.redirect("/settings");
};

export const resetSettingsAction = (req, res) => {
  removeUpload(getSettings().storeImageUrl);
  resetSettings();
  req.flash("success_msg", "All settings were reset to the defaults.");
  res.redirect("/settings");
};

// Point every uploaded product photo at this laptop's current address (needed when the Wi-Fi address changes).
export const refreshImageLinksAction = async (req, res) => {
  const base = publicBase();
  const [, meta] = await sequelize.query("UPDATE products SET image_url = CONCAT(:base, SUBSTRING(image_url, LOCATE('/uploads/', image_url))) WHERE image_url LIKE '%/uploads/%' AND image_url <> CONCAT(:base, SUBSTRING(image_url, LOCATE('/uploads/', image_url)))", { replacements: { base } });
  const n = meta?.affectedRows ?? meta ?? 0;
  req.flash("success_msg", n ? `${n} product image link(s) now point to ${base}.` : "All product image links already point to this laptop.");
  res.redirect("/settings");
};
