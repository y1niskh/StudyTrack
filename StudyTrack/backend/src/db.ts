import pg from "pg";

/** Exécute une requête SQL paramétrée ($1, $2…). Les valeurs ne sont jamais collées dans le texte SQL. */
export type Query = (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;

/** Accès à la base. `tx` exécute tout `fn` dans une transaction : tout est enregistré, ou rien. */
export interface Db {
  query: Query;
  tx<T>(fn: (q: Query) => Promise<T>): Promise<T>;
}

export function pgDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 5 });
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
