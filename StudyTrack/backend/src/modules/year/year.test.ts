import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionCookie, startApi, testConfig } from "../../../test/helpers.ts";
import { seedOwner, snapshot } from "../../../test/safety.ts";

test("POST /reset-year : tout est effacé, le compte reste, l'autre utilisateur n'est pas touché", async () => {
  const t = await startApi(undefined, { ...testConfig, allowedEmails: ["a@example.com", "b@example.com"] });
  try {
    const register = async (email: string) => {
      const res = await t.api("/auth/register", { method: "POST", body: JSON.stringify({ name: "Test", email, password: "un-long-mot-de-passe" }) });
      return { cookie: sessionCookie(res), id: (await res.json()).user.id as string };
    };
    const a = await register("a@example.com");
    const b = await register("b@example.com");
    await seedOwner(t.db, a.id);
    await seedOwner(t.db, b.id);
    const bBefore = await snapshot(t.db, b.id);

    const res = await t.api("/reset-year", { method: "POST", body: "{}", headers: { Cookie: a.cookie } });
    assert.equal(res.status, 204);

    for (const rows of Object.values(await snapshot(t.db, a.id))) assert.equal(rows.length, 0);
    assert.deepEqual(await snapshot(t.db, b.id), bBefore);
    const login = await t.api("/auth/login", { method: "POST", body: JSON.stringify({ email: "a@example.com", password: "un-long-mot-de-passe" }) });
    assert.equal(login.status, 200, "le compte est gardé");
  } finally {
    await t.close();
  }
});
