// pos/controllers/supplierController.js — suppliers (inventory staff, admin).
import { Supplier } from "../models/index.js";

function readSupplier(body) {
  const v = (k, n) => String(body[k] || "").trim().slice(0, n) || null;
  return { name: v("name", 150), contact_person: v("contact_person", 100), phone: v("phone", 20), email: v("email", 100), address: v("address", 255) };
}

export const listSuppliers = async (req, res) => {
  const suppliers = await Supplier.findAll({ order: [["supplier_code", "ASC"]], raw: true });
  res.render("suppliers/index", { title: "Suppliers", suppliers });
};

export const newSupplier = (req, res) => res.render("suppliers/form", { title: "New supplier", supplier: {}, isNew: true });

export const createSupplier = async (req, res) => {
  const data = readSupplier(req.body);
  if (!data.name) return res.status(422).render("suppliers/form", { title: "New supplier", supplier: req.body, isNew: true, error_msg: ["Enter the supplier name."] });
  const s = await Supplier.create({ ...data, status: "active" });
  req.flash("success_msg", `${s.supplier_code} ${s.name} added.`);
  res.redirect("/suppliers");
};

export const editSupplier = async (req, res) => {
  const supplier = await Supplier.findByPk(req.params.id, { raw: true });
  if (!supplier) return res.redirect("/suppliers");
  res.render("suppliers/form", { title: `Edit ${supplier.supplier_code}`, supplier });
};

export const updateSupplier = async (req, res) => {
  const s = await Supplier.findByPk(req.params.id);
  if (!s) return res.redirect("/suppliers");
  const data = readSupplier(req.body);
  if (!data.name) return res.status(422).render("suppliers/form", { title: `Edit ${s.supplier_code}`, supplier: { ...req.body, id: s.id, supplier_code: s.supplier_code }, error_msg: ["Enter the supplier name."] });
  await s.update(data);
  req.flash("success_msg", `${s.supplier_code} saved.`);
  res.redirect("/suppliers");
};

export const toggleSupplier = async (req, res) => {
  const s = await Supplier.findByPk(req.params.id);
  if (s) {
    await s.update({ status: s.status === "active" ? "inactive" : "active" });
    req.flash("success_msg", `${s.supplier_code} is now ${s.status}.`);
  }
  res.redirect("/suppliers");
};
