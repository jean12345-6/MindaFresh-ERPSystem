import { validDate } from "./dates.js";
export const need = (condition, message) => {
  if (!condition) {
    const e = Error(message);
    e.status = 422;
    throw e;
  }
};
export function employeeInput(b) {
  const v = {};
  for (const [k, max] of [
    ["first_name", 50],
    ["last_name", 50],
    ["position", 100],
  ]) {
    need(
      typeof b[k] === "string" && b[k].trim() && b[k].length <= max,
      "Invalid " + k,
    );
    v[k] = b[k].trim();
  }
  for (const [k, max] of [
    ["email", 100],
    ["phone", 20],
    ["middle_name", 50],
    ["address", 255],
  ]) {
    need(
      b[k] == null || (typeof b[k] === "string" && b[k].length <= max),
      "Invalid " + k,
    );
    v[k] = b[k]?.trim() || null;
  }
  need(!v.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email), "Invalid email");
  v.birth_date = b.birth_date || null;
  need(!v.birth_date || validDate(v.birth_date), "Invalid birth date");
  v.department_id = Number(b.department_id);
  need(
    Number.isInteger(v.department_id) && v.department_id > 0,
    "Select a department",
  );
  v.daily_rate = Number(b.daily_rate);
  need(
    Number.isFinite(v.daily_rate) && v.daily_rate > 0 && v.daily_rate <= 100000,
    "Invalid daily rate",
  );
  v.hire_date = b.hire_date;
  need(validDate(v.hire_date), "Invalid hire date");
  need(
    ["regular", "probationary", "contractual"].includes(b.employment_type),
    "Invalid employment type",
  );
  need(
    ["active", "inactive", "resigned"].includes(b.status),
    "Invalid employee status",
  );
  v.employment_type = b.employment_type;
  v.status = b.status;
  return v;
}
