// accounting/controllers/handle.js — wraps async controllers.
// An AppError (wrong input, duplicate) is shown as a red message on the page it came from.
// Anything else goes to the error page in index.js.
export const handle = (fn, backTo) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    if (err.name === "AppError" || err.name === "SequelizeValidationError") {
      req.flash("error_msg", err.message);
      return res.redirect(typeof backTo === "function" ? backTo(req) : backTo || req.get("Referrer") || "/dashboard");
    }
    next(err);
  }
};
