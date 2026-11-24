import pg from "pg";

/** Exécute une requête SQL paramétrée ($1, $2…). Les valeurs ne sont jamais collées dans le texte SQL. */
export type Query = (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;

/** Accès à la base. `tx` exécute tout `fn` dans une transaction : tout est enregistré, ou rien. */
export interface Db {
  query: Query;
  tx<T>(fn: (q: Query) => Promise<T>): Promise<T>;
}

/** Connexion chiffrée ET vérifiée avec le certificat de Supabase (DATABASE_CA_CERT) : personne ne peut se faire passer
    pour la base. Sans certificat (tests, base locale) : pas de SSL. Dans un fichier .env, les retours à la ligne du
    certificat peuvent être écrits `\n`. */
export function sslOptions(ca: string | undefined) {
  return ca ? { ca: ca.replace(/\\n/g, "\n"), rejectUnauthorized: true } : undefined;
}

// Ne pas ajouter `?sslmode=…` à DATABASE_URL : ce paramètre remplacerait ces réglages SSL.
export function pgDb(connectionString: string, ca?: string): Db {
  const pool = new pg.Pool({ connectionString, max: 5, ssl: sslOptions(ca) });
  pool.on("error", (e) => console.error("Erreur de connexion à la base :", e.message)); // évite un arrêt du serveur

  return {
    query: (text, params) => pool.query(text, params as any[]),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn((text, params) => client.query(text, params as any[]));
        await client.query("commit");
        return result;
      } catch (e) {
        await client.query("rollback").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

/** Retire les champs `null` d'une ligne : le contrat les décrit comme facultatifs (`price?`, `notes?`…), donc absents. */
export const compact = <T extends Record<string, unknown>>(row: T) =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as Partial<T>;
