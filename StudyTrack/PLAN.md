# StudyTrack backend: plan

Branch: `backend`. Reference for routes, JSON shapes and business rules: `docs/API_CONTRACT.md`.
Business-rule reference implementation: `frontend/src/services/mock.ts`.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Users | **One person** (mum). Sign-up is only open to the email(s) in `ALLOWED_EMAILS`. | The site is public on the internet: a stranger must not be able to create an account. |
| Data ownership | Keep `owner_id` on every row and filter by it, as the contract says. | Costs nothing, and matches the contract if a second account ever appears. |
| Server | Node + Express, **TypeScript** | Same language as the frontend. |
| Database | **Supabase Postgres, used as a database only** (driver: `pg`) | Data is relational; transactions are simple. No Supabase Auth, no row-level security: only the server talks to the database. |
| Login | Our own: bcrypt password hash + JWT (30 days), in an **httpOnly cookie** | Safer than `localStorage`: page scripts can't read the token. 30 days so mum isn't logged out all the time. |
| Hosting | **Render** to start, **one service**: Express serves the API *and* the built frontend. Code stays host-agnostic (see "Portability") so it can move to Railway, Fly.io, a VPS or Vercel without a rewrite. | Same address for the site and the API, so the cookie works (`SameSite=Strict`), no CORS. A frontend on another domain would need third-party cookies, which browsers are blocking. |
| Git | Commit on `backend` locally; push only when asked. | |

## Database (`backend/schema.sql`)

```text
users          id, name, email (unique, lowercase), password_hash, token_version, created_at
login_attempts ip, at                         (rate limit; rows older than 15 min are deleted)
students       id, owner_id, name            unique (owner_id, lower(name))
teachers       id, owner_id, name            unique (owner_id, lower(name))
subjects       id, owner_id, name            unique (owner_id, lower(name))
enrollments    id, owner_id, student_id, teacher_id, subject_id, cycle_size (4|8), price, active
               unique (owner_id, student_id, teacher_id, subject_id)
slots          id, owner_id, enrollment_id, weekday 0-6, time 'HH:MM', since (date)
               unique (owner_id, enrollment_id, weekday, time)
payment_cycles id, owner_id, enrollment_id, number, amount, status, paid_at, events jsonb
               unique (owner_id, enrollment_id, number)
lessons        id, owner_id, enrollment_id, date (timestamptz), status, notes, slot_id, occurrence (date), cycle_id
               unique (owner_id, slot_id, occurrence) where slot_id is not null
```

- `lessons.cycle_id` instead of an array on the cycle: a lesson can never be in two cycles (rule 5). The API still returns `lessonIds[]`.
- Deleting students/teachers/subjects cascades to enrollments → lessons, slots, cycles (used by `reset-year`).
- `events` is append-only: `{ type: "paid" | "unpaid", at }`.
- "Today" is computed in the Algeria time zone (`Africa/Algiers`).

## Routes

As in `docs/API_CONTRACT.md` §3, plus two for the cookie:

| Route | What it does |
|---|---|
| `POST /api/auth/register` | Only for emails in `ALLOWED_EMAILS` (others: `403` with a French message). Sets the cookie. |
| `POST /api/auth/login` | Sets the cookie. Limited to 10 attempts per 15 min per IP. |
| `POST /api/auth/logout` | **New.** Clears the cookie. |
| `GET /api/enrollments`, `/lessons`, `/payment-cycles`, `/slots` | Lists |
| `POST/PATCH/DELETE /api/lessons` | With the cycle rules |
| `POST/DELETE /api/slots` | |
| `PATCH /api/payment-cycles/:id/mark-paid` / `mark-unpaid` | |
| `POST /api/reset-year` | |
| `GET /api/health` | For Render's health check |

Register and login still return `{ user }` in the body (the frontend shows the name); the token is only in the cookie.

## Where the server differs from `mock.ts`

1. `mark-paid` checks the cycle is full (`409` "Ce cycle n'est pas encore complet."). The mock doesn't.
2. The next cycle is created only when a completed lesson needs one, not right after a payment. The contract allows both.
3. Every lesson/cycle operation is one transaction that locks the enrollment row, so nothing is ever half done.
4. All input is validated on the server (`400` with a French message).

## Security

- Sign-up allowlist: `ALLOWED_EMAILS` (comma-separated, compared lowercase and trimmed). Empty or missing = sign-up closed for everyone (fails closed). Other emails: `403` "Les inscriptions sont fermées."
- Cookie: `httpOnly`, `Secure` in production, `SameSite=Strict`.
- `helmet` headers, including a Content-Security-Policy that only allows the app's own scripts (main defense against script injection stealing the session).
- `users.token_version`: put in the JWT and checked on every request. Logout or a password change increments it, which invalidates every old token ("log out everywhere").
- Login rate limit stored **in the database** (`login_attempts` table), not in memory, so it works on any host, including serverless or several instances.
- CSRF: `SameSite=Strict` + routes that change data only accept `Content-Type: application/json` (an HTML form can't send that).
- Passwords: bcrypt. Same message for unknown email and wrong password.
- Secrets only in `backend/.env` (never committed): `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_EMAILS`.
- Errors: never send stack traces to the browser; log them on the server.

## Portability (host anywhere)

- All settings come from environment variables (`DATABASE_URL`, `JWT_SECRET`, `ALLOWED_EMAILS`, `PORT`, `NODE_ENV`); nothing host-specific in the code.
- No state in memory (sessions in the cookie, rate limit in the database), so restarts, sleeping or several instances don't break anything.
- `app.ts` builds the Express app and **exports it**; `server.ts` only calls `listen(PORT)`. A serverless host (Vercel) can import `app` directly instead.
- `app.set("trust proxy", 1)`: Render, Railway, Fly and Vercel all sit behind a proxy; needed for `Secure` cookies and for the real client IP in the rate limit.
- Standard commands at the repo root: `npm run build` and `npm start`. Every Node host understands that. No Dockerfile until a host needs one.
- `DATABASE_URL` uses Supabase's **session pooler** (IPv4, works for always-on servers); for a serverless host switch to the **transaction pooler** (port 6543), no code change.

## Frontend changes (small)

- `services/http.ts`: `credentials: "include"`, remove the `Authorization` header.
- `services/session.ts`: keep only `{ user }` in `localStorage` (no token).
- `logout()` also calls `POST /api/auth/logout`.
- `.env.development`: `VITE_USE_MOCK=false` once the backend runs.

## Files

```text
backend/
  package.json        express, pg, bcryptjs, jsonwebtoken, cookie-parser, helmet
                      dev: typescript (type check only), @electric-sql/pglite (real Postgres inside the tests, no internet)
  tsconfig.json       no build step: Node 22.18+ runs .ts files directly; `npm run typecheck` checks types
  schema.sql
  .env.example
  src/db.ts           connection + transaction helper
  src/cycles.ts       attach / detach / lock check
  src/app.ts          routes
  src/server.ts       starts the server, serves frontend/dist in production
  test/api.test.ts    contract §4 cases, run with `node --test`
```

## Steps

1. ✅ Project setup + `schema.sql` + `/api/health`.
2. Auth: register (allowed emails), login (rate limit), logout, cookie check middleware.
3. The four list routes.
4. Tests from contract §4, then lessons + cycle rules until they pass.
5. Slots, mark-paid / mark-unpaid, reset-year (+ tests).
6. Frontend cookie changes.
7. **Supabase:** you create a free project (region Frankfurt or Paris, close to Algeria). I apply `schema.sql` through the Supabase connector (with your OK). Use the **session pooler** connection string in `DATABASE_URL` (works over IPv4, which Render needs).
8. Run locally against Supabase, `VITE_USE_MOCK=false`, walk the test path in contract §8.
9. **Render:** one web service, build = install + build frontend + build backend, start = `node backend/src/server.ts`, env vars set in Render's dashboard.

Render's free plan sleeps after 15 min without visits (first load then takes ~1 min). If that bothers mum: Render's paid plan or Railway (~5 $/month).

## Not doing now

- `GET /auth/me`, CRUD for students/teachers/subjects/enrollments (contract §7): no page uses them yet.
- Supabase Auth, row-level security, CORS: not needed with this setup.
- Password reset by email: one user; reset by hand in the database if ever needed.
