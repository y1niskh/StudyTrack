import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { sessionCookie, startApi, testConfig } from "../../../test/helpers.ts";
import { userFromToken } from "./service.ts";

let t: Awaited<ReturnType<typeof startApi>>;
before(async () => { t = await startApi(); });
after(() => t.close());

const MAMAN = { name: "Maman", email: "maman@example.com", password: "un-long-mot-de-passe" };
// Chaque test a sa propre « adresse IP » (en-tête du proxy), pour que la limite de tentatives d'un test ne gêne pas les autres.
const post = (path: string, body: unknown, ip: string, cookie = "") =>
  t.api(path, { method: "POST", body: JSON.stringify(body), headers: { "X-Forwarded-For": ip, Cookie: cookie } });
const message = async (res: Response) => (await res.json()).message;

test("inscription d'une adresse autorisée : 201, cookie httpOnly, jamais le mot de passe", async () => {
  const res = await post("/auth/register", { ...MAMAN, email: "  MAMAN@Example.com " }, "10.0.0.1");
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.deepEqual(Object.keys(body.user).sort(), ["email", "id", "name"]);
  assert.equal(body.user.email, "maman@example.com");
  const raw = res.headers.getSetCookie()[0];
  assert.match(raw, /^st_session=/);
  assert.match(raw, /HttpOnly/);
  assert.match(raw, /SameSite=Strict/);
  assert.match(raw, /Path=\/api/);
});

test("deuxième inscription avec le même e-mail : 409", async () => {
  const res = await post("/auth/register", MAMAN, "10.0.0.2");
  assert.equal(res.status, 409);
  assert.equal(await message(res), "Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.");
});

test("adresse non autorisée : 403, aucun compte créé", async () => {
  const res = await post("/auth/register", { ...MAMAN, email: "inconnu@example.com" }, "10.0.0.3");
  assert.equal(res.status, 403);
  assert.equal(await message(res), "Les inscriptions sont fermées.");
  const { rows } = await t.db.query("select 1 from users where email = 'inconnu@example.com'");
  assert.equal(rows.length, 0);
});

test("liste d'adresses vide : inscriptions fermées pour tout le monde", async () => {
  const closed = await startApi(undefined, { ...testConfig, allowedEmails: [] });
  try {
    const res = await closed.api("/auth/register", { method: "POST", body: JSON.stringify(MAMAN) });
    assert.equal(res.status, 403);
  } finally {
    await closed.close();
  }
});

test("données invalides : 400 avec le message du frontend", async () => {
  const res = await post("/auth/register", { ...MAMAN, email: "x@example.com", password: "court" }, "10.0.0.4");
  assert.equal(res.status, 400);
  assert.equal(await message(res), "Le mot de passe doit contenir au moins 8 caractères.");
  assert.equal((await post("/auth/register", {}, "10.0.0.4")).status, 400);
});

test("connexion : bon mot de passe 200 ; mauvais mot de passe et e-mail inconnu, même 401", async () => {
  const ok = await post("/auth/login", { email: MAMAN.email, password: MAMAN.password }, "10.0.0.5");
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).user.name, "Maman");
  assert.ok(sessionCookie(ok));

  const wrong = await post("/auth/login", { email: MAMAN.email, password: "pas-le-bon" }, "10.0.0.5");
  const unknown = await post("/auth/login", { email: "personne@example.com", password: "pas-le-bon" }, "10.0.0.5");
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(await message(wrong), "E-mail ou mot de passe incorrect.");
  assert.equal(await message(unknown), "E-mail ou mot de passe incorrect.");
});

test("10 tentatives ratées : la 11e est refusée, même avec le bon mot de passe", async () => {
  for (let i = 0; i < 10; i++) {
    assert.equal((await post("/auth/login", { email: MAMAN.email, password: "pas-le-bon" }, "10.0.0.6")).status, 401);
  }
  const blocked = await post("/auth/login", { email: MAMAN.email, password: MAMAN.password }, "10.0.0.6");
  assert.equal(blocked.status, 429);
  assert.equal(await message(blocked), "Trop de tentatives. Réessaie dans 15 minutes.");
  // une autre adresse IP n'est pas bloquée
  assert.equal((await post("/auth/login", { email: MAMAN.email, password: MAMAN.password }, "10.0.0.7")).status, 200);
});

test("déconnexion : 204, cookie effacé, et tous les anciens jetons deviennent invalides", async () => {
  const phone = sessionCookie(await post("/auth/login", { email: MAMAN.email, password: MAMAN.password }, "10.0.0.8"));
  const computer = sessionCookie(await post("/auth/login", { email: MAMAN.email, password: MAMAN.password }, "10.0.0.8"));
  const token = (c: string) => c.slice("st_session=".length);
  assert.ok(await userFromToken(t.db, testConfig, token(phone)));

  const res = await post("/auth/logout", {}, "10.0.0.8", phone);
  assert.equal(res.status, 204);
  assert.match(res.headers.getSetCookie()[0], /^st_session=;/);

  assert.equal(await userFromToken(t.db, testConfig, token(phone)), null);
  assert.equal(await userFromToken(t.db, testConfig, token(computer)), null, "déconnecté partout");
  assert.equal((await post("/auth/logout", {}, "10.0.0.8")).status, 204, "sans session : pas une erreur");
});

test("jeton faux ou signé avec un autre secret : refusé", async () => {
  const cookie = sessionCookie(await post("/auth/login", { email: MAMAN.email, password: MAMAN.password }, "10.0.0.9"));
  const token = cookie.slice("st_session=".length);
  assert.equal(await userFromToken(t.db, testConfig, token + "x"), null);
  assert.equal(await userFromToken(t.db, { ...testConfig, jwtSecret: "un-autre-secret-de-test-0123456789abcdef" }, token), null);
  assert.equal(await userFromToken(t.db, testConfig, "pas-un-jeton"), null);
});
