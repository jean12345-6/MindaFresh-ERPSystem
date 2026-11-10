// XianFire structure adapted for MindaFresh PeoplePay.
// XianFire framework: Christian I. Cabrera, Mindoro State University (MIT).
import "dotenv/config";
import "./models/index.js";
import express from "express";
import path from "path";
import session from "express-session";
import flash from "./middleware/flash.js";
import fs from "fs";
import hbs from "hbs";
import helmet from "helmet";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";
import router from "./routes/index.js";
import { sequelize } from "./models/db.js";
import { csrf } from "./middleware/csrf.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3004;

if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.length < 32 ||
  process.env.SESSION_SECRET.startsWith("replace-")
) {
  throw new Error(
    "Set a unique SESSION_SECRET with at least 32 characters in .env.",
  );
}
if (process.env.DB_NAME !== "mindafresh_db") {
  throw new Error("DB_NAME must be mindafresh_db.");
}

app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public")));

// XianFire's standard session setup. No disk writes on Windows.
// This memory store is for local development; sessions reset on server restart.
app.use(
  session({
    name: "peoplepay.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);
app.use(flash());

// The same hbs-backed .xian view engine used by XianFire.
app.engine("xian", (filePath, options, callback) => {
  hbs.__express(filePath, options, callback);
});
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "xian");

const partialsDir = path.join(__dirname, "views/partials");
const registerPartials = (directory, prefix = "") => {
  fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      registerPartials(fullPath, prefix + entry.name + "/");
    } else if (entry.name.endsWith(".xian")) {
      const partialName = prefix + entry.name.replace(".xian", "");
      const content = fs.readFileSync(fullPath, "utf8");
      hbs.registerPartial(partialName, content);
    }
  });
};
registerPartials(partialsDir);

hbs.registerHelper(
  "money",
  (value) =>
    "₱" +
    Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
);
hbs.registerHelper("date", (value) =>
  value
    ? new Date(String(value).slice(0, 10) + "T00:00:00").toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" },
      )
    : "—",
);
hbs.registerHelper("selected", (a, b) =>
  String(a) === String(b) ? "selected" : "",
);
hbs.registerHelper("eq", (a, b) => a === b);

app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  next();
});
app.use(csrf);
app.use("/", router);

app.use((req, res) => {
  res
    .status(404)
    .render("error", {
      title: "Page not found",
      message: "The page you requested does not exist.",
    });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const message =
    err.name === "SequelizeUniqueConstraintError"
      ? "This account, department, or payroll period already exists."
      : err.name?.startsWith("Sequelize")
        ? "Database connection or schema error. Check your shared MySQL setup."
        : err.message || "The request could not be completed.";
  if (req.method === "POST") {
    req.flash("error_msg", message);
    const safePages = [
      "/login",
      "/employees",
      "/departments",
      "/users",
      "/leaves",
      "/payroll",
      "/settings",
    ];
    return res.redirect(
      safePages.includes(req.body.return_to)
        ? req.body.return_to
        : "/dashboard",
    );
  }
  return res
    .status(err.status || 500)
    .render("error", { title: "Unable to load page", message });
});

export default app;
export const startServer = async (port = PORT) => {
  await sequelize.authenticate();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`🔥 XianFire PeoplePay running at http://localhost:${port}`);
      resolve(server);
    });
    server.on("error", reject);
  });
};

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  startServer().catch((error) => {
    console.error("PeoplePay could not start:", error.message);
    process.exitCode = 1;
  });
}
