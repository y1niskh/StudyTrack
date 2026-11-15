import { createApp } from "./app.ts";
import { pgDb } from "./db.ts";

const { DATABASE_URL, PORT = "5000" } = process.env;
if (!DATABASE_URL) {
  console.error("DATABASE_URL manquant : copier backend/.env.example en backend/.env et le remplir.");
  process.exit(1);
}

createApp(pgDb(DATABASE_URL)).listen(Number(PORT), () => console.log(`API StudyTrack : http://localhost:${PORT}/api`));
