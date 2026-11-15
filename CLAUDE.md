# StudyTrack

A web app (Android phone and computer) for a mother in Algeria to follow her children's private lessons and the cash
payments due to their teachers. The React frontend is done (`StudyTrack/frontend/`); this work builds its backend
(`StudyTrack/backend/`).

## Read these first

- `StudyTrack/docs/PRD.md`: what the backend must do
- `StudyTrack/docs/TRD.md`: how it's built
- `StudyTrack/docs/API_CONTRACT.md`: every route, JSON shape, French error message and cycle rule the frontend expects
- `StudyTrack/docs/PLAN.md`: the order of work. Do tasks in this order, one at a time
- `HANDOFF.md`: where the last session stopped. Read it at the start of every session

If something in a request conflicts with these documents, stop and ask.
`frontend/src/services/mock.ts` is the reference implementation of the business rules.

## How to work with me

- I'm learning **TypeScript** and **backend development with Express**. Explain what you do in simple words.
- Before each task, explain your plan and the files you'll create or change, then **wait for my OK**.
- Before running any command that changes something (installing packages, migrations, deploys,
  deleting files, anything on Supabase or Render), say what it does and wait for my OK.
- One task at a time. Finish it (code, tests passing, committed) before starting the next.
- When a test fails, explain why before fixing it.
- After every code change, run `npm test`, `npm run lint` and `npm run typecheck`, then check the change for
  security issues (data filtered by `owner_id`, input validation with zod, secrets, SQL injection, cookie settings)
  and tell me what you found.
- **Never push without asking.** Commit locally, then ask before every `git push`.
- **One branch per phase**, made from `master` (`phase-0`, `phase-1`…). `master` changes only when a whole phase is
  done; then ask before merging and pushing `master`.

## Reports and learning

- **A PDF report after each part and each phase**, written as a Claude Docs doc, then exported to
  PDF into `StudyTrack/docs/reports/` (in `.gitignore`, never committed). Reports are in English.
  - After each part (`phase-1-part-1.pdf`): every change made (files, functions, tests), why, and
    how it was checked, in simple words.
  - After a phase (`phase-1.pdf`): what the phase built and why it matters, plus what I learned
    (the TypeScript and backend ideas it used, explained simply).
- **When a phase ends, also:** a slide deck explaining every part with a concrete example, and a
  code guide PDF: the architecture (every folder and file, a request's journey), then each part's
  code explained in simple words with the key code shown.
- **At the end of each area, before starting the next one:**
  - A PDF (`phase-N-area-M.pdf`) explaining every new file line by line: schema, service, routes,
    then changed files, then each test.
  - A walkthrough: which files the area added or changed, where they sit, how a request reaches them.
  - Why each piece was written this way and not another (the alternatives and why they were rejected).
  - New TypeScript, Express or SQL syntax met in the area, each linked to where it appears.
  - A quiz on the area (where things are, why they are done that way, what a line does). I answer,
    you correct and explain what I got wrong. Move on only after I say the quiz went well.

## Handoffs between sessions

- At the start of a session: switch to the current phase's branch, read `HANDOFF.md`,
  say where the last session stopped and what's next, then run the tests and show the results.
- Never end a session with failing tests or uncommitted changes.
- At the end of a session, when asked, write a new note at the **top** of `HANDOFF.md`: date and
  name, then **Done**, **Next** (exactly where an unfinished task stopped) and **Watch out**.
  Commit it, then ask before pushing.

## Stack (do not change without asking)

Node 22.18+ running TypeScript directly (no build step) · Express 5 · zod · Supabase Postgres used as a database only
(driver `pg`) · bcryptjs + jsonwebtoken in an httpOnly cookie · helmet · `node:test` + PGlite · oxlint · hosted on
Render, kept portable (TRD §7).

## Non-negotiable rules

1. Data is only ever reached through its owner: every query filters by `owner_id` from the token; another user's
   resource answers `404`.
2. Every new endpoint gets a line in the `PROTECTED` table of `test/safety.test.ts` proving rule 1 and the `401`.
3. A paid cycle is locked: no route changes or deletes its sessions, and `events` is never shortened.
4. Every operation touching a session and a cycle runs in one transaction that locks the enrollment row.
5. Never edit an applied migration; write a new one.
6. Never commit secrets: only `.env.example` with fake values.
7. Never put real user data in tests, fixtures or prompts.

## Code style

- Module structure: `src/modules/<area>/routes.ts` (reads the request), `service.ts` (rules and
  queries), `schema.ts` (zod validation), `<area>.test.ts`.
- No queries outside `service.ts` (exceptions: `migrate.ts`, and the `select 1` of `/api/health` in `app.ts`); no business rules in `routes.ts`.
- Error format: `{ "message": "texte en français" }`, the format the frontend reads (TRD §4). Messages are simple
  French for a non-technical person, no jargon, never a stack trace.
- Only erasable TypeScript (no `enum`, no constructor parameter properties); imports end in `.ts`.
- Small functions, clear names. Comments explain *why*, not *what*. Comments in French, like the frontend.

## Commands (in `StudyTrack/backend/`)

- `npm run dev` · `npm test` · `npm run lint` · `npm run typecheck` · `npm run db:migrate`
