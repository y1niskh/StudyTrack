import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import type { Config } from "./config.ts";
import type { Db } from "./db.ts";
import { errorHandler, HttpError } from "./errors.ts";
import { authRoutes } from "./modules/auth/routes.ts";
import { cycleRoutes } from "./modules/cycles/routes.ts";
import { enrollmentRoutes } from "./modules/enrollments/routes.ts";
import { lessonRoutes } from "./modules/lessons/routes.ts";
import { slotRoutes } from "./modules/slots/routes.ts";
import { yearRoutes } from "./modules/year/routes.ts";

/** Construit l'application sans la démarrer : server.ts l'écoute sur un port, les tests l'utilisent avec une base en mémoire,
    un hébergeur « serverless » pourrait l'importer directement. Chaque module (src/modules/<zone>/routes.ts) s'ajoute ici. */
export function createApp(db: Db, config: Config) {
  const app = express();
  app.set("trust proxy", 1); // derrière le proxy de l'hébergeur : vraie IP du client, cookies Secure
  // « upgrade-insecure-requests » force le HTTPS : utile en production, mais casserait le site en local (http://localhost).
  app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: config.secureCookies ? [] : null } } }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  const api = express.Router();
  // Protection CSRF : un formulaire d'un autre site ne peut envoyer que du texte ou du « form-urlencoded », jamais du JSON
  // (cela demanderait une autorisation CORS que ce serveur ne donne pas). Le frontend envoie toujours application/json.
  api.use((req, _res, next) => {
    if (req.method === "GET" || req.method === "HEAD") return next();
    if (!req.headers["content-type"]?.startsWith("application/json")) throw new HttpError(415, "Les données envoyées sont invalides.");
    next();
  });
  api.get("/health", async (_req, res) => {
    await db.query("select 1");
    res.json({ ok: true });
  });
  api.use("/auth", authRoutes(db, config));
  api.use("/enrollments", enrollmentRoutes(db, config));
  api.use("/lessons", lessonRoutes(db, config));
  api.use("/payment-cycles", cycleRoutes(db, config));
  api.use("/slots", slotRoutes(db, config));
  api.use("/reset-year", yearRoutes(db, config));
  api.use((_req, res) => {
    res.status(404).json({ message: "Cette adresse n'existe pas." });
  });
  app.use("/api", api);

  // Le site construit, à la même adresse que l'API : le cookie SameSite=Strict marche, pas de CORS.
  // Toute autre adresse en GET (/connexion, /paiements…) reçoit index.html : c'est le routeur de React qui choisit la page.
  const siteDir = config.siteDir;
  if (siteDir) {
    app.use(express.static(siteDir, { index: "index.html" }));
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      res.sendFile("index.html", { root: siteDir });
    });
  }

  app.use(errorHandler);
  return app;
}
