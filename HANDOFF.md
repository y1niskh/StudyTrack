# Handoff notes

Newest note on top.

---

## 2026-11-15 · Session 1 (Phase 2 built)

**Done**
- Area 2.4: `POST /slots` (find or create student/teacher/subject/enrollment by name, case and spaces ignored;
  cycleSize/price only when creating) and `DELETE /slots/:id` (removes future planned sessions only).
- Area 2.5: `POST /reset-year` (deletes students/teachers/subjects, cascade does the rest; account kept).
- Phase 2 complete on `phase-2`: every route of the contract exists. 69 tests pass; lint and typecheck clean.

**Next**
- Ask before merging `phase-2` into `master` and pushing (fetch first). Then Phase 3 (frontend cookie, Supabase, Render).

**Watch out**
- Deleting a slot sets `slot_id` to null on the sessions it keeps.

---

## 2026-11-15 · Session 1 (area 2.3)

**Done**
- Area 2.3: `PATCH /payment-cycles/:id/mark-paid` (full + unpaid only, optional `paidAt`) and `/mark-unpaid`
  (paid only, `paidAt` removed). Both append to `events`, never remove; enrollment row locked. 7 tests + 2 harness lines.
  60 tests pass; lint and typecheck clean.

**Next**
- Area 2.4: `POST /slots` (find or create names + enrollment), `DELETE /slots/:id`.

**Watch out**
- `phase-2` is local only.

---

## 2026-11-15 · Session 1 (area 2.2)

**Done**
- `phase-1` merged into `master` and pushed (`f672334`).
- Area 2.2: `POST/PATCH/DELETE /lessons` with the cycle rules (`cycleFor()` in `cycles/service.ts`), paid cycles locked
  (409), duplicate slot date (409), enrollment row locked in every change. 13 tests from contract §4 + 3 harness lines.
  51 tests pass; lint and typecheck clean.

**Next**
- Area 2.3: `mark-paid` / `mark-unpaid` (tests first).

**Watch out**
- `phase-2` is local only.

---

## 2026-11-15 · Session 1 (area 2.1)

**Done**
- Phase 1 material: `docs/reports/phase-1-area-1.pdf` (auth line by line + 15-question multiple-choice quiz, no answers).
  Answers in `docs/reports/phase-1-quiz-answers.md` (local only): give them when the user asks.
  Phase 1 report and code guide were skipped (user's choice, short on time).
- Branch `phase-2` made from `phase-1` (phase-1 NOT merged into master yet: ask before merging/pushing).
- Area 2.1: `GET /enrollments` (flat, with names), `PATCH /enrollments/:id` (cycleSize/price, unpaid cycles take the
  price, paid untouched, enrollment row locked), `GET /lessons`, `/payment-cycles` (with `lessonIds`), `/slots`.
  Helpers: `compact()` in `db.ts` (drops null fields), `idParam()` in `errors.ts` (non-uuid id → 404).
  5 lines in the safety harness. 35 tests pass; lint and typecheck clean.

**Next**
- Area 2.2: lessons + cycle rules (`POST/PATCH/DELETE /lessons`), tests from contract §4 written first.

**Watch out**
- Each module router does `r.use(requireAuth(...))`, so an unknown path under a module answers 401 before 404.

---

## 2026-11-15 · Session 1 (task 1.3, Phase 1 built)

**Done**
- Task 1.3: safety harness. `test/safety.ts` (`seedOwner`, `snapshot`, `checkRoute`) and `test/safety.test.ts` with the
  `PROTECTED` table (empty: no protected route yet) and 3 self-tests proving the harness accepts a route that filters
  by owner and catches a route that leaks or modifies another user's data.
- 22 tests pass; lint and typecheck clean. Phase 1 (1.1–1.3) is built on `phase-1`, not merged, not pushed.

**Next**
- End-of-phase material for Phase 1 (the user asked for none before this point): area auth line-by-line PDF,
  walkthrough, syntax list, quiz; Phase 1 report and code guide. Ask about the slide deck (skipped for Phase 0).
- Then ask before merging `phase-1` into `master` and pushing (fetch first: someone else pushes frontend work).

**Watch out**
- Every phase 2 route adds one line to `PROTECTED`; `expect` defaults to 404, lists use `expect: 200`.

---

## 2026-11-15 · Session 1 (task 1.2)

**Done**
- Task 1.2: `src/modules/auth/middleware.ts` (`requireAuth(db, cfg)` → 401 « Ta session a expiré… », `currentUser(res)`).
- `app.ts`: every `/api` request other than GET/HEAD must have `Content-Type: application/json`, else 415 (CSRF).
- 19 tests pass (5 new in `middleware.test.ts`, on a small test-only app since no real route is protected yet);
  lint and typecheck clean. TRD §4 lists 415 and 429.

**Next**
- Task 1.3: safety harness `test/safety.test.ts`. Explain the plan first, wait for OK.

**Watch out**
- No PDFs until the end of Phase 1 (see the note below).
- The frontend must keep sending `Content-Type: application/json` on DELETE and on logout (task 3.1), even without a body.

---

## 2026-11-15 · Session 1 (task 1.1)

**Done**
- Task 1.1, area auth (`src/modules/auth/`): register (allowlist), login (10 failures per IP per 15 min → 429),
  logout (token_version +1), cookie `st_session` (httpOnly, SameSite=Strict, Path=/api, Secure in production).
- `src/config.ts` (`loadConfig`: refuses to start without a 32+ char `JWT_SECRET`); `createApp(db, config)`;
  `parseBody()` in `errors.ts` (zod → 400 with the first French message).
- 14 tests pass (9 new in `auth.test.ts`); lint and typecheck clean.

**Next**
- Task 1.2: turn `userFromToken` into the `requireAuth` middleware + JSON-only check on routes that change data.
  Explain the plan first, wait for OK.

**Watch out**
- **No PDFs, reports or quizzes until the end of Phase 1** (user's request). Then: area/part material + Phase 1 report.
- `trust proxy` is 1: locally a client can fake `X-Forwarded-For` (tests use it to get separate IPs). Behind
  Render's single proxy it can't. Check the real hop count at deploy (task 3.5).
- The attempt limit is per IP, not per account: fine for one user with a strong password.

---

## 2026-11-15 · Session 1 (end of Phase 0)

**Done**
- Phase 0 report and code guide PDFs in `StudyTrack/docs/reports/` (not in git). Slide deck skipped (user's choice).
- `phase-0` merged into `master` together with 2 new commits from GitHub (Settings page, contract route
  `PATCH /enrollments/:id`); pushed to `origin/master` (`a2b97e0`).
- Branch `phase-1` created from `master`. The new route is added to PLAN 2.1, PRD (F7) and TRD (enrollments module).

**Next**
- Task 1.1 (auth: register with allowlist, login with rate limit, logout, cookie). Explain the plan and files first,
  wait for OK.

**Watch out**
- Someone else also pushes to `master` (frontend work). Always `git fetch` and look before merging or pushing.
- `phase-0` and `phase-1` exist only locally.

---

## 2026-11-15 · Session 1 (later)

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

## 2026-11-15 · Session 1

**Done**
- Read the repo, the contract and `mock.ts`. Chose Express + Supabase Postgres (database only), one user (the mother),
  httpOnly cookie, Render with portable code.
- Task 0.1: backend skeleton, first schema, `/api/health`, 4 PGlite tests (commit `3fc37bd`).
- Task 0.2: adopted the build-and-learn method: `docs/PRD.md`, `docs/TRD.md`, `docs/PLAN.md` (phases), the working rules,
  this file. Branch renamed `backend` → `phase-0`.

**Next**
- Task 0.3: move to the TRD layout (`errors.ts`, `src/modules/`, tests next to their module). Explain the plan
  and wait for OK first.

**Watch out**
- Nothing pushed yet: `phase-0` exists only locally.
- `schema.sql` isn't applied anywhere, so it can still be turned into `migrations/001_init.sql` (task 0.4) freely.
- No Supabase project yet (task 3.3).
- Part 0.1 was built before the method: no report for it (decided by the user).
