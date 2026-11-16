// shop/services/reviewService.js — use cases "Write review" (Customer) and "Moderate reviews" (Admin)
// Rules: only a customer who received the product (order delivered, or returned after delivery) may review it;
// one review per customer per product (writing again updates it); rating 1–5; the admin hides, never deletes.
import { fn, col, Op } from "sequelize";
import { ProductReview, Product, Customer, Order, OrderItem } from "../models/index.js";
import { AppError } from "../utils/appError.js";
import { round1 } from "../utils/rating.js";
import * as reviewPhotoService from "./reviewPhotoService.js";

const RECEIVED = ["delivered", "returned"];
const MAX_COMMENT = 500;

// "Ana R." — first name and last initial, so full names are not shown publicly
const publicName = (c) => `${c.first_name} ${(c.last_name || "").charAt(0)}.`.trim();

// +findPurchase(customerId, productId): the latest received order that contains this product, or null
export async function findPurchase(customerId, productId) {
  return Order.findOne({
    where: { customer_id: customerId, order_status: { [Op.in]: RECEIVED } },
    include: [{ model: OrderItem, where: { product_id: productId }, attributes: [] }],
    order: [["delivered_at", "DESC"], ["id", "DESC"]]
  });
}

// +summaries(productIds): { [productId]: { average, count } } for visible reviews — used by the product cards
export async function summaries(productIds) {
  if (!productIds.length) return {};
  const rows = await ProductReview.findAll({
    attributes: ["product_id", [fn("AVG", col("rating")), "average"], [fn("COUNT", col("id")), "count"]],
    where: { product_id: { [Op.in]: productIds }, status: "visible" },
    group: ["product_id"],
    raw: true
  });
  return Object.fromEntries(rows.map((r) => [r.product_id, { average: round1(r.average), count: Number(r.count) }]));
}

// +forProduct(productId, customerId): what the product page shows (reading only — reviews are written from My orders)
export async function forProduct(productId, customerId = null) {
  const rows = await ProductReview.findAll({
    where: { product_id: productId, status: "visible" },
    include: [Customer],
    order: [["updated_at", "DESC"]]
  });
  const count = rows.length;
  const average = count ? round1(rows.reduce((s, r) => s + r.rating, 0) / count) : 0;
  const breakdown = [5, 4, 3, 2, 1].map((level) => {
    const n = rows.filter((r) => r.rating === level).length;
    return { level, n, percent: count ? Math.round((n / count) * 100) : 0 };
  });

  // For a logged-in customer: the order to rate it from (or where their review was written)
  let mine = null;
  let rateFrom = null;
  if (customerId) {
    const own = await ProductReview.findOne({ where: { product_id: productId, customer_id: customerId }, include: [Order] });
    if (own) mine = { hidden: !own.isVisible(), order_code: own.Order?.order_code };
    else rateFrom = (await findPurchase(customerId, productId))?.order_code || null;
  }

  return {
    count,
    average,
    breakdown,
    mine,
    rateFrom,
    reviews: rows.map((r) => ({
      name: publicName(r.Customer),
      rating: r.rating,
      comment: r.comment,
      date: r.updated_at,
      photos: reviewPhotoService.photoUrls(r.id),
      verified: true, // every review is tied to a delivered order
      own: customerId && r.customer_id === customerId
    }))
  };
}

// +mineForOrder(customerId, productIds): the customer's own reviews of these products, for the order page
export async function mineForOrder(customerId, productIds) {
  if (!productIds.length) return {};
  const rows = await ProductReview.findAll({ where: { customer_id: customerId, product_id: { [Op.in]: productIds } } });
  return Object.fromEntries(rows.map((r) => [r.product_id,
    { rating: r.rating, comment: r.comment || "", hidden: !r.isVisible(), photos: reviewPhotoService.photoUrls(r.id) }]));
}

// +saveReview(customerId, orderCode, productCode, { rating, comment, remove_photos }, photos) — from a delivered
// order on My orders. Creates the review, or updates the customer's own review of that product.
// photos: up to 3 uploaded images; new photos replace the old ones. remove_photos = "1" removes them.
export async function saveReview(customerId, orderCode, productCode, { rating, comment, remove_photos }, photos = []) {
  const order = await Order.findOne({
    where: { order_code: orderCode, customer_id: customerId },
    include: [{ model: OrderItem, include: [Product] }]
  });
  if (!order) throw new AppError("VALIDATION_ERROR", "Order not found.");
  if (!RECEIVED.includes(order.order_status)) throw new AppError("VALIDATION_ERROR", "You can rate the products after this order is delivered.");
  const item = order.OrderItems.find((i) => i.Product?.product_code === productCode);
  if (!item) throw new AppError("VALIDATION_ERROR", "That product is not in this order.");

  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new AppError("VALIDATION_ERROR", "Please choose a rating from 1 to 5 stars.");
  const text = (comment || "").trim();
  if (text.length > MAX_COMMENT) throw new AppError("VALIDATION_ERROR", `Please keep your review under ${MAX_COMMENT} characters.`);
  if (photos.length > reviewPhotoService.MAX_PHOTOS)
    throw new AppError("VALIDATION_ERROR", `You can attach up to ${reviewPhotoService.MAX_PHOTOS} photos.`);
  const checked = reviewPhotoService.checkPhotos(photos); // all photos are checked before anything is saved

  const existing = await ProductReview.findOne({ where: { customer_id: customerId, product_id: item.product_id } });
  const review = existing
    ? await existing.update({ rating: stars, comment: text || null })
    : await ProductReview.create({ customer_id: customerId, product_id: item.product_id, order_id: order.id, rating: stars, comment: text || null });
  if (checked.length) reviewPhotoService.replacePhotos(review.id, checked);
  else if (remove_photos === "1") reviewPhotoService.removePhotos(review.id);
  return { product: item.Product, created: !existing, hidden: !review.isVisible(), photos: checked.length };
}

// +listForAdmin({ status }): every review with its product, customer and order, newest first
export async function listForAdmin({ status = "" } = {}) {
  const where = ["visible", "hidden"].includes(status) ? { status } : {};
  const [rows, counts] = await Promise.all([
    ProductReview.findAll({ where, include: [Product, Customer, Order], order: [["updated_at", "DESC"]] }),
    ProductReview.findAll({ attributes: ["status", [fn("COUNT", col("id")), "n"]], group: ["status"], raw: true })
  ]);
  const by = Object.fromEntries(counts.map((c) => [c.status, Number(c.n)]));
  return {
    status: where.status || "",
    counts: { all: (by.visible || 0) + (by.hidden || 0), visible: by.visible || 0, hidden: by.hidden || 0 },
    reviews: rows.map((r) => ({
      id: r.id,
      product_name: r.Product?.name,
      product_code: r.Product?.product_code,
      customer_name: `${r.Customer?.first_name} ${r.Customer?.last_name}`,
      customer_code: r.Customer?.customer_code,
      order_code: r.Order?.order_code,
      rating: r.rating,
      comment: r.comment,
      photos: reviewPhotoService.photoUrls(r.id),
      status: r.status,
      date: r.updated_at
    }))
  };
}

// +setStatus(reviewId, status) — the admin hides an inappropriate review, or shows it again
export async function setStatus(reviewId, status) {
  if (!["visible", "hidden"].includes(status)) throw new AppError("VALIDATION_ERROR", "Unknown review status.");
  const review = await ProductReview.findByPk(reviewId, { include: [Product] });
  if (!review) throw new AppError("VALIDATION_ERROR", "Review not found.");
  await review.update({ status });
  return review;
}
