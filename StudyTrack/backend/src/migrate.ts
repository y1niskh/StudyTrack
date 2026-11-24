import { readdirSync, readFileSync } from "node:fs";
import { pgDb, type Db } from "./db.ts";

const DIR = new URL("../migrations/", import.meta.url);

/** Applique dans l'ordre les fichiers de migrations/ qui ne le sont pas encore, chacun dans sa propre transaction :
    un fichier est appliqué en entier ou pas du tout. Renvoie les noms des fichiers appliqués. */
export async function migrate(db: Db): Promise<string[]> {
  await db.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await db.query("select name from schema_migrations")).rows.map((r) => r.name));
  const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort(); // 001_, 002_… : l'ordre du nom est l'ordre d'application

  const applied: string[] = [];
  for (const name of files) {
    if (done.has(name)) continue;
    const sql = readFileSync(new URL(name, DIR), "utf8");
    await db.tx(async (q) => {
      await q(sql);
      await q("insert into schema_migrations (name) values ($1)", [name]);
    });
    applied.push(name);
  }
  return applied;
}

// `npm run db:migrate` : exécuté directement (pas importé par un test).
if (import.meta.filename === process.argv[1]) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL manquant : copier backend/.env.example en backend/.env et le remplir.");
    process.exit(1);
  }
  migrate(pgDb(url, process.env.DATABASE_CA_CERT)).then(
    (applied) => {
      console.log(applied.length ? `Migrations appliquées : ${applied.join(", ")}` : "Base déjà à jour.");
      process.exit(0);
    },
    (e) => {
      console.error("Migration échouée, rien n'a été enregistré pour ce fichier :", e.message);
      process.exit(1);
    },
  );
}
