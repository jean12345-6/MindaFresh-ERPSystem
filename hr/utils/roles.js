export const SELF_SERVICE_ROLES = Object.freeze(["employee", "cashier", "inventory_staff"]);
export const STAFF_ROLES = Object.freeze(["admin", "hr_staff", "accountant", ...SELF_SERVICE_ROLES]);
export const isSelfService = (role) => SELF_SERVICE_ROLES.includes(role);
