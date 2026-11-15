# Handoff notes

Newest note on top.

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
