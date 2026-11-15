import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Config } from "../../config.ts";
import type { Db } from "../../db.ts";
import { HttpError } from "../../errors.ts";
import type { LoginBody, RegisterBody } from "./schema.ts";

export interface User { id: string; name: string; email: string }
interface UserRow extends User { password_hash: string; token_version: number }

const ROUNDS = 12;
const MAX_FAILS = 10; // tentatives ratées par adresse IP sur 15 minutes
const BAD_LOGIN = "E-mail ou mot de passe incorrect.";
// Pour un e-mail inconnu, on vérifie quand même un mot de passe (contre ce faux hachage) : la réponse prend
// le même temps, donc on ne peut pas deviner quels e-mails ont un compte.
const DUMMY_HASH = bcrypt.hashSync("aucun-compte-avec-cet-email", ROUNDS);

const publicUser = (u: User): User => ({ id: u.id, name: u.name, email: u.email });

function signToken(cfg: Config, u: { id: string; token_version: number }) {
  return jwt.sign({ v: u.token_version }, cfg.jwtSecret, { subject: u.id, expiresIn: "30d", algorithm: "HS256" });
}

export async function register(db: Db, cfg: Config, input: RegisterBody) {
  if (!cfg.allowedEmails.includes(input.email)) throw new HttpError(403, "Les inscriptions sont fermées.");
  const hash = await bcrypt.hash(input.password, ROUNDS);
  const { rows } = await db.query(
    `insert into users (name, email, password_hash) values ($1, $2, $3)
     on conflict (email) do nothing
     returning id, name, email, token_version`,
    [input.name, input.email, hash],
  );
  const u: UserRow | undefined = rows[0];
  if (!u) throw new HttpError(409, "Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.");
  return { user: publicUser(u), token: signToken(cfg, u) };
}

export async function login(db: Db, cfg: Config, input: LoginBody, ip: string) {
  await db.query("delete from login_attempts where at < now() - interval '15 minutes'");
  const fails = (await db.query("select count(*)::int as n from login_attempts where ip = $1", [ip])).rows[0].n;
  // ponytail: compté puis enregistré sans verrou, deux essais simultanés peuvent dépasser la limite d'un ou deux ; sans gravité pour 10.
  if (fails >= MAX_FAILS) throw new HttpError(429, "Trop de tentatives. Réessaie dans 15 minutes.");

  const u: UserRow | undefined = (await db.query(
    "select id, name, email, password_hash, token_version from users where email = $1", [input.email],
  )).rows[0];
  const ok = await bcrypt.compare(input.password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !ok) {
    await db.query("insert into login_attempts (ip) values ($1)", [ip]);
    throw new HttpError(401, BAD_LOGIN);
  }
  return { user: publicUser(u), token: signToken(cfg, u) };
}

/** L'utilisateur d'un jeton, ou null si le jeton est absent, faux, expiré ou d'avant une déconnexion. */
export async function userFromToken(db: Db, cfg: Config, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, cfg.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
  if (typeof payload === "string" || typeof payload.sub !== "string" || !Number.isInteger(payload.v)) return null;
  const { rows } = await db.query(
    "select id, name, email from users where id::text = $1 and token_version = $2", [payload.sub, payload.v],
  );
  return rows[0] ?? null;
}

/** Déconnecte partout : tous les jetons déjà donnés à cet utilisateur deviennent invalides. */
export async function logout(db: Db, userId: string) {
  await db.query("update users set token_version = token_version + 1 where id = $1", [userId]);
}
