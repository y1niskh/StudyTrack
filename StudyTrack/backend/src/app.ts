import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import type { Db } from "./db.ts";

/** Erreur prévue : son message (en français) est montré tel quel à l'utilisateur. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const GENERIC = "Une erreur est survenue. Réessaie dans un instant.";

/** Construit l'application sans la démarrer : server.ts l'écoute sur un port, les tests l'utilisent avec une base en mémoire,
    un hébergeur « serverless » pourrait l'importer directement. */
export function createApp(db: Db) {
  const app = express();
  app.set("trust proxy", 1); // derrière le proxy de l'hébergeur : vraie IP du client, cookies Secure
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));

  const api = express.Router();
  api.get("/health", async (_req, res) => {
    await db.query("select 1");
    res.json({ ok: true });
  });
  api.use((_req, res) => {
    res.status(404).json({ message: "Cette adresse n'existe pas." });
  });
  app.use("/api", api);

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) return void res.status(err.status).json({ message: err.message });
    if (err?.type === "entity.parse.failed") return void res.status(400).json({ message: "Les données envoyées sont invalides." });
    console.error(err); // détail dans les journaux du serveur, jamais envoyé au navigateur
    res.status(500).json({ message: GENERIC });
  };
  app.use(onError);

  return app;
}
