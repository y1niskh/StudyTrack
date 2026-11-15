import express, { type CookieOptions } from "express";
import type { Config } from "../../config.ts";
import type { Db } from "../../db.ts";
import { parseBody } from "../../errors.ts";
import { loginBody, registerBody } from "./schema.ts";
import { login, logout, register, userFromToken } from "./service.ts";

export const COOKIE = "st_session";

export function authRoutes(db: Db, cfg: Config) {
  // httpOnly : aucun script de la page ne peut lire le jeton. SameSite=Strict : un autre site ne peut pas l'envoyer.
  const cookie: CookieOptions = { httpOnly: true, secure: cfg.secureCookies, sameSite: "strict", path: "/api" };
  const r = express.Router();

  r.post("/register", async (req, res) => {
    const { user, token } = await register(db, cfg, parseBody(registerBody, req.body));
    res.cookie(COOKIE, token, { ...cookie, maxAge: 30 * 864e5 }).status(201).json({ user });
  });

  r.post("/login", async (req, res) => {
    const { user, token } = await login(db, cfg, parseBody(loginBody, req.body), req.ip ?? "inconnue");
    res.cookie(COOKIE, token, { ...cookie, maxAge: 30 * 864e5 }).json({ user });
  });

  // Toujours 204, même sans session valide : se déconnecter deux fois n'est pas une erreur.
  r.post("/logout", async (req, res) => {
    const user = await userFromToken(db, cfg, req.cookies?.[COOKIE]);
    if (user) await logout(db, user.id);
    res.clearCookie(COOKIE, cookie).status(204).end();
  });

  return r;
}
