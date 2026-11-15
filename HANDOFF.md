# Handoff notes

Newest note on top.

---

## 2026-11-15 · Claude (session 1, later)

**Done**
- Phase 0 is built (tasks 0.3 to 0.5, on `phase-0`, not pushed):
  - 0.3 `src/errors.ts`, slim `app.ts`, tests found in `src/**` and `test/`.
  - 0.4 `migrations/001_init.sql` (was `schema.sql`), `src/migrate.ts`, `npm run db:migrate`; tests build PGlite
    from the same migrations; a test proves a second run applies nothing.
  - 0.5 zod installed (used from phase 1), oxlint with `npm run lint` (fails on warnings).
- 5 tests pass; lint and typecheck clean.

**Next**
- Phase 0 end-of-phase material: phase report PDF (covers parts 0.3–0.5; 0.1 has no report), slide deck, code guide.
- Then ask before merging `phase-0` into `master`, and before pushing.
- Then branch `phase-1` from `master`; task 1.1 (auth). Explain the plan first and wait for OK.

**Watch out**
- `migrate.ts` is run by hand, never on server start (two instances starting together could race).
- In the PGlite test adapter, a query **without** parameters goes through `exec` (several statements allowed),
  like `pg`. Queries with user input must always pass parameters.

---

## 2026-11-15 · Claude (session 1)

**Done**
- Read the repo, the contract and `mock.ts`. Chose Express + Supabase Postgres (database only), one user (the mother),
  httpOnly cookie, Render with portable code.
- Task 0.1: backend skeleton, first schema, `/api/health`, 4 PGlite tests (commit `3fc37bd`).
- Task 0.2: adopted the build-and-learn method: `docs/PRD.md`, `docs/TRD.md`, `docs/PLAN.md` (phases), `CLAUDE.md`,
  this file. Branch renamed `backend` → `phase-0`.

**Next**
- Task 0.3: move to the TRD layout (`errors.ts`, `src/modules/`, tests next to their module). Explain the plan
  and wait for OK first.

**Watch out**
- Nothing pushed yet: `phase-0` exists only locally.
- `schema.sql` isn't applied anywhere, so it can still be turned into `migrations/001_init.sql` (task 0.4) freely.
- No Supabase project yet (task 3.3).
- Part 0.1 was built before the method: no report for it (decided by the user).
