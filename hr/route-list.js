import "dotenv/config";
import router from "./routes/index.js";
import { sequelize } from "./models/db.js";
for (const layer of router.stack)
  if (layer.route)
    console.log(
      Object.keys(layer.route.methods).join(",").toUpperCase().padEnd(8) +
        layer.route.path,
    );
await sequelize.close();
