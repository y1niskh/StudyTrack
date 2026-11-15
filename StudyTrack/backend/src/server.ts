import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { pgDb } from "./db.ts";

const { DATABASE_URL, PORT = "5000" } = process.env;
const config = loadConfig(process.env);
if (!DATABASE_URL || typeof config === "string") {
  console.error(typeof config === "string" ? config : "DATABASE_URL manquant : copier backend/.env.example en backend/.env et le remplir.");
  process.exit(1);
}

createApp(pgDb(DATABASE_URL), config).listen(Number(PORT), () => console.log(`API StudyTrack : http://localhost:${PORT}/api`));
