import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { pgDb } from "./db.ts";

const { DATABASE_URL, DATABASE_CA_CERT, NODE_ENV, PORT = "5000" } = process.env;
const config = loadConfig(process.env);
const problem = typeof config === "string" ? config
  : !DATABASE_URL ? "DATABASE_URL manquant : copier backend/.env.example en backend/.env et le remplir."
  // En production, jamais de connexion à la base sans chiffrement vérifié.
  : NODE_ENV === "production" && !DATABASE_CA_CERT ? "DATABASE_CA_CERT manquant : le certificat SSL de Supabase est obligatoire en production."
  : "";
if (problem || typeof config === "string" || !DATABASE_URL) {
  console.error(problem);
  process.exit(1);
}

createApp(pgDb(DATABASE_URL, DATABASE_CA_CERT), config).listen(Number(PORT), () => console.log(`API StudyTrack : http://localhost:${PORT}/api`));
