import type { RequestHandler, Response } from "express";
import type { Config } from "../../config.ts";
import type { Db } from "../../db.ts";
import { HttpError } from "../../errors.ts";
import { COOKIE } from "./routes.ts";
import { type User, userFromToken } from "./service.ts";

/** À placer devant toute route protégée : sans session valide → 401 (le frontend déconnecte et renvoie vers la connexion).
    Sinon l'utilisateur est rangé dans res.locals, à lire avec currentUser(res). */
export function requireAuth(db: Db, cfg: Config): RequestHandler {
  return async (req, res, next) => {
    const user = await userFromToken(db, cfg, req.cookies?.[COOKIE]);
    if (!user) throw new HttpError(401, "Ta session a expiré. Connecte-toi à nouveau.");
    res.locals.user = user;
    next();
  };
}

/** L'utilisateur connecté. Toujours appelé derrière requireAuth : c'est son id qui filtre chaque requête (owner_id). */
export const currentUser = (res: Response): User => res.locals.user;
