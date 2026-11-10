
      /*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
// Staff login through the shared authService (users ⨝ employees, blueprint Section 6).
// The generated User model and its sequelize.sync() are removed: tables come only from schema.sql.
import { login } from "../services/authService.js";

// Roles that may open the Accounting module
const ALLOWED = ["accountant", "admin", "hr_staff"];

export const loginPage = (req, res) => {
  if (req.session.user) return res.redirect(req.session.user.role === "hr_staff" ? "/salary-releases" : "/dashboard");
  res.render("login", { title: "Login" });
};

export const loginUser = async (req, res, next) => {
  const { username, password } = req.body;
  try {
    const user = await login((username || "").trim(), password || "");
    if (!ALLOWED.includes(user.role)) {
      req.flash("error_msg", "Your account cannot open the Accounting module.");
      return res.redirect("/login");
    }
    req.session.user = user;
    res.redirect(user.role === "hr_staff" ? "/salary-releases" : "/dashboard");
  } catch (err) {
    if (err.name === "AppError") { req.flash("error_msg", err.message); return res.redirect("/login"); }
    next(err);
  }
};

export const logoutUser = (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
};
