import crypto from "node:crypto";

export const csrf = (req, res, next) => {
  if (!req.session.csrf)
    req.session.csrf = crypto.randomBytes(32).toString("hex");
  res.locals.csrf = req.session.csrf;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const given = Buffer.from(
      String(req.get("X-CSRF-Token") || req.body._csrf || ""),
    );
    const expected = Buffer.from(req.session.csrf);
    if (
      given.length !== expected.length ||
      !crypto.timingSafeEqual(given, expected)
    ) {
      const error = new Error(
        "Your form expired. Reload the page and try again.",
      );
      error.status = 403;
      return next(error);
    }
  }
  next();
};
