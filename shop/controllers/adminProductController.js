// adminProductController — use case "Manage product photos" (Admin)
// Products, prices and stock are managed in POS. Here the admin only sets the photo the Online Shop shows.
import multer from "multer";
import { Product, Category, StockLevel } from "../models/index.js";
import * as photoService from "../services/productPhotoService.js";
import { AppError } from "../utils/appError.js";

// The photo stays in memory until productPhotoService checks it and saves it
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: photoService.MAX_BYTES, files: 1 } }).single("photo");

// GET /admin/products — every product from POS, with its photo
export const list = async (req, res, next) => {
  try {
    const products = await Product.findAll({ include: [Category, StockLevel], order: [["product_code", "ASC"]] });
    res.render("admin-products", {
      title: "Product photos",
      nav: "products",
      products: products.map((p) => ({
        product_code: p.product_code,
        name: p.name,
        category: p.Category?.name,
        unit: p.unit,
        price: Number(p.selling_price),
        stock: p.StockLevel?.quantity_on_hand ?? 0,
        online: p.status === "active" && Boolean(p.is_online),
        image_url: photoService.imageFor(p),
        fromPos: Boolean(p.image_url), // POS set an image_url: shown only when the Shop has no uploaded photo
        hasShopPhoto: Boolean(photoService.photoUrl(p.product_code))
      }))
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/products/:code/photo  (multipart form, field "photo")
export const uploadPhoto = (req, res, next) => {
  upload(req, res, async (uploadErr) => {
    try {
      if (uploadErr) {
        throw new AppError("VALIDATION_ERROR", uploadErr.code === "LIMIT_FILE_SIZE"
          ? "The photo is too big. Please use one under 2 MB." : "The photo could not be uploaded. Please try again.");
      }
      const product = await Product.findOne({ where: { product_code: req.params.code } });
      if (!product) throw new AppError("VALIDATION_ERROR", "Product not found.");
      photoService.savePhoto(product.product_code, req.file);
      req.flash("success_msg", `Photo saved for ${product.name}.`);
    } catch (err) {
      if (!(err instanceof AppError)) return next(err);
      req.flash("error_msg", err.message);
    }
    res.redirect("/admin/products");
  });
};

// POST /admin/products/:code/photo/remove
export const removePhoto = async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { product_code: req.params.code } });
    if (!product) throw new AppError("VALIDATION_ERROR", "Product not found.");
    photoService.removePhoto(product.product_code);
    req.flash("success_msg", `Photo removed from ${product.name}.`);
  } catch (err) {
    if (!(err instanceof AppError)) return next(err);
    req.flash("error_msg", err.message);
  }
  res.redirect("/admin/products");
};
