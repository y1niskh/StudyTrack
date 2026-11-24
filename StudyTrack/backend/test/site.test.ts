import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { startApi, testConfig } from "./helpers.ts";

/* Un seul serveur pour le site et l'API (tâche 3.2). Un faux site construit dans un dossier temporaire remplace frontend/dist. */

let t: Awaited<ReturnType<typeof startApi>>;
let root = "";

before(async () => {
  const site = mkdtempSync(join(tmpdir(), "studytrack-site-"));
  mkdirSync(join(site, "assets"));
  writeFileSync(join(site, "index.html"), "<!doctype html><title>StudyTrack</title><div id=root></div>");
  writeFileSync(join(site, "assets", "app.js"), "console.log('ok')");
  t = await startApi(undefined, { ...testConfig, siteDir: site });
  root = (await t.api("/health")).url.replace(/\/api\/health$/, "");
});
after(() => t.close());

test("la page d'accueil et un fichier du site sont servis", async () => {
  const home = await fetch(`${root}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /<title>StudyTrack<\/title>/);
  const js = await fetch(`${root}/assets/app.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get("content-type") ?? "", /javascript/);
});

test("une page du routeur (/paiements) rechargée reçoit index.html", async () => {
  const res = await fetch(`${root}/paiements`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<div id=root>/);
});

test("l'API reste l'API : adresse inconnue sous /api → 404 JSON, pas la page du site", async () => {
  const res = await fetch(`${root}/api/nexiste-pas`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).message, "Cette adresse n'existe pas.");
});

test("en-têtes de sécurité sur le site ; pas de HTTPS forcé hors production", async () => {
  const res = await fetch(`${root}/`);
  const csp = res.headers.get("content-security-policy") ?? "";
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /upgrade-insecure-requests/);
});

test("sans site construit (siteDir absent) : seule l'API répond", async () => {
  const apiOnly = await startApi();
  try {
    const base = (await apiOnly.api("/health")).url.replace(/\/api\/health$/, "");
    assert.equal((await fetch(`${base}/`)).status, 404);
  } finally {
    await apiOnly.close();
  }
});
