import { rows } from "../models/db.js";
export async function profilePage(req, res, next) {
  try {
    const [employee] = await rows("SELECT e.*,d.name AS department FROM employees e JOIN departments d ON d.id=e.department_id WHERE e.id=:id", { id: req.user.employee_id });
    res.render("profile", {title: "My profile", activeProfile: true, employee});
  } catch (error) { next(error); }
}
