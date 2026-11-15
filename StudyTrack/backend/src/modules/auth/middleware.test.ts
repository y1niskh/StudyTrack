import cookieParser from "cookie-parser";
import express from "express";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { sessionCookie, startApi, testConfig } from "../../../test/helpers.ts";
import { errorHandler } from "../../errors.ts";
import { currentUser, requireAuth } from "./middleware.ts";

let t: Awaited<ReturnType<typeof startApi>>;
let protectedUrl = "";
let closeProtected = () => {};
let cookie = "";

// Une petite application avec une seule route protégée, sur la même base que l'API : aucune vraie route protégée
// n'existe encore (elles arrivent en phase 2).
before(async () => {
  t = await startApi();
  const app = express().use(cookieParser());
  app.get("/protege", requireAuth(t.db, testConfig), (_req, res) => { res.json(currentUser(res)); });
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  protectedUrl = `http://localhost:${(server.address() as AddressInfo).port}/protege`;
  closeProtected = () => server.close();

  const body = JSON.stringify({ name: "Maman", email: "maman@example.com", password: "un-long-mot-de-passe" });
  cookie = sessionCookie(await t.api("/auth/register", { method: "POST", body }));
});
after(async () => { closeProtected(); await t.close(); });

const get = (c = "") => fetch(protectedUrl, { headers: { Cookie: c } });

test("session valide : la route reçoit l'utilisateur connecté", async () => {
  const res = await get(cookie);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).email, "maman@example.com");
});

test("sans cookie : 401 avec un message simple", async () => {
  const res = await get();
  assert.equal(res.status, 401);
  assert.equal((await res.json()).message, "Ta session a expiré. Connecte-toi à nouveau.");
});

test("jeton modifié : 401", async () => {
  assert.equal((await get(cookie + "x")).status, 401);
  assert.equal((await get("st_session=pas-un-jeton")).status, 401);
});

test("jeton d'avant une déconnexion : 401", async () => {
  const body = JSON.stringify({ email: "maman@example.com", password: "un-long-mot-de-passe" });
  const old = sessionCookie(await t.api("/auth/login", { method: "POST", body }));
  assert.equal((await get(old)).status, 200);
  await t.api("/auth/logout", { method: "POST", body: "{}", headers: { Cookie: old } });
  assert.equal((await get(old)).status, 401);
  assert.equal((await get(cookie)).status, 401, "déconnecté partout, y compris l'autre session");
});

test("requête qui modifie sans JSON (formulaire d'un autre site) : 415, rien n'est fait", async () => {
  const form = await t.api("/auth/register", {
    method: "POST",
    body: "name=Pirate&email=maman%40example.com&password=un-long-mot-de-passe",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  assert.equal(form.status, 415);
  assert.equal((await form.json()).message, "Les données envoyées sont invalides.");
  const text = await t.api("/auth/logout", { method: "POST", body: "{}", headers: { "Content-Type": "text/plain" } });
  assert.equal(text.status, 415);
  assert.equal((await t.api("/health")).status, 200, "les lectures (GET) ne sont pas concernées");
});
