import cookieParser from "cookie-parser";
import express from "express";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import { errorHandler, HttpError } from "../src/errors.ts";
import { currentUser, requireAuth } from "../src/modules/auth/middleware.ts";
import { sessionCookie, startApi, testConfig } from "./helpers.ts";
import { checkRoute, type Ids, type ProtectedRoute, seedOwner } from "./safety.ts";

/* ROUTES PROTÉGÉES : chaque nouvelle route de l'API ajoute sa ligne ici (règle 2 de CLAUDE.md).
   Exemples pour la phase 2 :
     { method: "GET", path: "/lessons", expect: 200 },
     { method: "PATCH", path: "/lessons/:lessonId", body: () => ({ notes: "modifié par B" }) },
     { method: "POST", path: "/lessons", body: (ids) => ({ enrollmentId: ids.enrollmentId, date: "2026-11-20T10:00:00.000Z", status: "completed" }) }, */
const PROTECTED: ProtectedRoute[] = [];

const config = { ...testConfig, allowedEmails: ["a@example.com", "b@example.com"] };
let t: Awaited<ReturnType<typeof startApi>>;
let a: { id: string; ids: Ids };
let cookieB = "";

before(async () => {
  t = await startApi(undefined, config);
  const register = (email: string) =>
    t.api("/auth/register", { method: "POST", body: JSON.stringify({ name: "Test", email, password: "un-long-mot-de-passe" }) });
  const resA = await register("a@example.com");
  const id = (await resA.json()).user.id;
  a = { id, ids: await seedOwner(t.db, id) };
  cookieB = sessionCookie(await register("b@example.com"));
});
after(() => t.close());

describe("chaque route protégée : 401 sans session, rien chez l'autre utilisateur", () => {
  for (const route of PROTECTED) {
    test(`${route.method} ${route.path}`, () => checkRoute(t.api, t.db, route, a, cookieB));
  }
});

/* Le filet lui-même est testé : il doit laisser passer une route qui filtre par propriétaire, et attraper une route
   qui l'oublie. Sans ce test, un filet cassé laisserait tout passer sans rien dire. */
describe("le filet de sécurité", () => {
  let send: (path: string, init: RequestInit) => Promise<Response>;
  let close = () => {};
  before(async () => {
    const app = express().use(express.json()).use(cookieParser());
    const auth = requireAuth(t.db, config);
    app.get("/api/bonne/:lessonId", auth, async (req, res) => {
      const { rows } = await t.db.query("select id from lessons where id = $1 and owner_id = $2", [req.params.lessonId, currentUser(res).id]);
      if (!rows[0]) throw new HttpError(404, "Ce cours n'existe plus.");
      res.json(rows[0]);
    });
    app.get("/api/fuite/:lessonId", auth, async (req, res) => {
      res.json((await t.db.query("select id from lessons where id = $1", [req.params.lessonId])).rows[0] ?? {});
    });
    app.delete("/api/efface/:lessonId", auth, async (req, _res) => {
      await t.db.query("update lessons set notes = 'effacé' where id = $1", [req.params.lessonId]);
      throw new HttpError(404, "Ce cours n'existe plus."); // répond 404 mais a quand même touché aux données de A
    });
    app.use(errorHandler);
    const server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    const base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
    send = (path, init) => fetch(base + path, init);
    close = () => server.close();
  });
  after(() => close());

  test("accepte une route qui filtre par propriétaire", () =>
    checkRoute(send, t.db, { method: "GET", path: "/bonne/:lessonId" }, a, cookieB));

  test("attrape une route qui renvoie les données de l'autre utilisateur", () =>
    assert.rejects(checkRoute(send, t.db, { method: "GET", path: "/fuite/:lessonId", expect: 200 }, a, cookieB), /renvoie une donnée/));

  test("attrape une route qui modifie les données de l'autre utilisateur, même si elle répond 404", () =>
    assert.rejects(checkRoute(send, t.db, { method: "DELETE", path: "/efface/:lessonId" }, a, cookieB), /modifié/));
});
