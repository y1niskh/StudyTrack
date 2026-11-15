import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import type { Config } from "./config.ts";
import type { Db } from "./db.ts";
import { errorHandler } from "./errors.ts";
import { authRoutes } from "./modules/auth/routes.ts";

/** Construit l'application sans la démarrer : server.ts l'écoute sur un port, les tests l'utilisent avec une base en mémoire,
    un hébergeur « serverless » pourrait l'importer directement. Chaque module (src/modules/<zone>/routes.ts) s'ajoute ici. */
export function createApp(db: Db, config: Config) {
  const app = express();
  app.set("trust proxy", 1); // derrière le proxy de l'hébergeur : vraie IP du client, cookies Secure
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  const api = express.Router();
  api.get("/health", async (_req, res) => {
    await db.query("select 1");
    res.json({ ok: true });
  });
  api.use("/auth", authRoutes(db, config));
  api.use((_req, res) => {
    res.status(404).json({ message: "Cette adresse n'existe pas." });
  });
  app.use("/api", api);

  app.use(errorHandler);
  return app;
}
