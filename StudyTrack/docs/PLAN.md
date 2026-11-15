# StudyTrack backend: PLAN (order of work)

What: `PRD.md` · How: `TRD.md` · Routes and rules: `API_CONTRACT.md`.
One task at a time, in this order. A row is done when its "done when" is true, tests pass and it is committed.
One branch per phase (`phase-0`, `phase-1`…), made from `master`; `master` changes only when a phase is finished.

## Phase 0: setup (branch `phase-0`)

| # | Task | Done when |
|---|---|---|
| 0.1 | ✅ Project skeleton, first schema, `/api/health`, PGlite tests | `npm test` passes (4 tests); commit `3fc37bd` |
| 0.2 | ✅ Method documents: PRD, TRD, PLAN, `CLAUDE.md`, `HANDOFF.md` | Documents committed |
| 0.3 | Code layout of the TRD: `errors.ts`, `src/modules/`, tests next to their module | `/api/health` and the 4 tests still pass in the new layout |
| 0.4 | Migrations: `schema.sql` → `migrations/001_init.sql`, `migrate.ts`, `npm run db:migrate`; tests use the same files | A test proves that running migrate twice applies nothing the second time |
| 0.5 | Tooling: oxlint (`npm run lint`), zod installed | `npm run lint`, `npm run typecheck`, `npm test` all clean |

## Phase 1: foundation (branch `phase-1`)

| # | Task | Done when |
|---|---|---|
| 1.1 | Area **auth**: `POST /auth/register` (allowlist), `/auth/login` (rate limit in database), `/auth/logout` (token_version), cookie | Tests: allowed / refused sign-up, duplicate email `409`, wrong password `401` same message, 11th attempt refused, logout invalidates the old cookie |
| 1.2 | `requireAuth` middleware + JSON-only check on routes that change data | Tests: no cookie `401`, forged or old-version token `401`, form-encoded `POST` refused |
| 1.3 | **Safety harness** `test/safety.test.ts` (TRD §6), empty table ready for the routes | The harness runs; adding a route is one line |

## Phase 2: features (branch `phase-2`), one area at a time

Each area: zod schema → service with SQL → routes → tests (including its lines in the safety harness).

| # | Area | Routes | Done when |
|---|---|---|---|
| 2.1 | **enrollments + lists** | `GET /enrollments` (with names), `GET /lessons`, `GET /payment-cycles` (with `lessonIds`), `GET /slots` | JSON exactly as the examples of contract §3; dates and local dates in the right format |
| 2.2 | **lessons + cycle rules** | `POST/PATCH/DELETE /lessons` | Every case of contract §4 about lessons passes, written before the code |
| 2.3 | **payments** | `PATCH /payment-cycles/:id/mark-paid`, `/mark-unpaid` | Full cycle only; history only grows; unpaid makes sessions editable again |
| 2.4 | **slots** | `POST /slots` (find or create student/teacher/subject/enrollment), `DELETE /slots/:id` | Names matched ignoring case and spaces; delete keeps past/confirmed sessions |
| 2.5 | **new year** | `POST /reset-year` | Everything of the user erased, account kept, other users untouched |

## Phase 3: launch (branch `phase-3`)

| # | Task | Done when |
|---|---|---|
| 3.1 | Frontend: cookie (`credentials: "include"`, no `Authorization` header, `localStorage` keeps only `user`), logout calls the API | Frontend `npm run build` passes |
| 3.2 | Express serves `frontend/dist` in production; root `npm run build` / `npm start` | One local process serves the site and the API |
| 3.3 | Supabase project (Frankfurt or Paris), `npm run db:migrate` on it | `/api/health` answers with the real database |
| 3.4 | Local end-to-end with `VITE_USE_MOCK=false`: the path of contract §8 | Every step of the path works |
| 3.5 | Render deploy, environment variables, HTTPS check, her account created | She can log in on her phone |
| 3.6 | Remove `mock.ts` and the `MOCK` branches | Frontend builds without them |
