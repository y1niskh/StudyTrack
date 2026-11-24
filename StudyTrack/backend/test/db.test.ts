import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { sslOptions } from "../src/db.ts";

test("certificat donné : connexion chiffrée et vérifiée ; les \\n du fichier .env deviennent des retours à la ligne", () => {
  assert.deepEqual(sslOptions("-----BEGIN-----\\nABC\\n-----END-----"), {
    ca: "-----BEGIN-----\nABC\n-----END-----",
    rejectUnauthorized: true,
  });
});

test("pas de certificat (tests, base locale) : pas de SSL", () => {
  assert.equal(sslOptions(undefined), undefined);
  assert.equal(sslOptions(""), undefined);
});

test("en production, le serveur refuse de démarrer sans le certificat", () => {
  const server = fileURLToPath(new URL("../src/server.ts", import.meta.url));
  const run = spawnSync(process.execPath, [server], {
    env: {
      PATH: process.env.PATH, NODE_ENV: "production", DATABASE_URL: "postgresql://x:y@localhost:1/z",
      JWT_SECRET: "secret-de-test-uniquement-0123456789abcdef",
    },
    encoding: "utf8",
    timeout: 20_000,
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /DATABASE_CA_CERT manquant/);
});
