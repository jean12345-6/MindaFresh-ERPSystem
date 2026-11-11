// pos/scripts/start-prod.js — starts the POS in production mode on any OS (Windows has no `NODE_ENV=production node ...`).
//   npm run start:prod
process.env.NODE_ENV = "production";
await import("../index.js");
