# StudyTrack backend: TRD (how it's built)

What it must do: `PRD.md`. Exact routes and JSON: `API_CONTRACT.md`. Order of work: `PLAN.md`.

## 1. Stack

| Part | Choice | Why |
|---|---|---|
| Runtime | Node 22.18+ (24 locally) running **TypeScript directly** (type stripping) | No build step. `tsc` only checks types. Only "erasable" TypeScript: no `enum`, no constructor parameter properties. Imports end in `.ts`. |
| Server | Express 5 | Async errors reach the error handler automatically. |
| Validation | zod | One schema per route body, readable French error messages. |
| Database | **Supabase Postgres, as a database only**, driver `pg` | Relational data, real transactions. No Supabase Auth, no row-level security: only the server talks to the database. |
| Auth | bcryptjs + jsonwebtoken, token in an **httpOnly cookie** | See §5. |
| Security headers | helmet | Content-Security-Policy and the usual headers. |
| Tests | `node:test` + **PGlite** (real Postgres in memory) | No internet, no Docker, same SQL as production. |
| Lint | oxlint (same as the frontend) | Fast, no config. |

## 2. Folders

```text
StudyTrack/backend/
  migrations/            001_init.sql, 002_….sql: applied in order, never edited once applied
  src/
    server.ts            reads env, starts listening (the only file that knows about the port)
    app.ts               builds the Express app: middleware, module routers, error handler. Exported, not started.
    db.ts                pg pool + tx() helper
    migrate.ts           applies migrations/ that aren't applied yet (npm run db:migrate)
    errors.ts            HttpError + the error handler
    modules/
      auth/              routes.ts · service.ts · schema.ts · middleware.ts (requireAuth) · auth.test.ts
      enrollments/       routes.ts · service.ts · schema.ts · enrollments.test.ts (GET + PATCH cycleSize / price)
      lessons/           routes.ts · service.ts · schema.ts · lessons.test.ts
      cycles/            routes.ts · service.ts (attach / detach / markPaid / markUnpaid) · cycles.test.ts
      slots/             routes.ts · service.ts · schema.ts · slots.test.ts
      year/              routes.ts · service.ts · year.test.ts (reset-year)
  test/
    helpers.ts           PGlite database with all migrations, startApi(), login helper
    safety.test.ts       the safety harness: every protected route (§6)
```

- `routes.ts` reads the request (params, body via `schema.ts`, the user from `requireAuth`) and sends the response.
- `service.ts` holds the rules and **all** SQL. No SQL anywhere else; no business rule in `routes.ts`.
- `schema.ts` holds the zod schemas.

## 3. Database

Tables (`migrations/001_init.sql`):

```text
users          id, name, email (unique, lowercase), password_hash, token_version, created_at
login_attempts ip, at
students       id, owner_id, name        unique (owner_id, lower(name))
teachers       id, owner_id, name        unique (owner_id, lower(name))
subjects       id, owner_id, name        unique (owner_id, lower(name))
enrollments    id, owner_id, student_id, teacher_id, subject_id, cycle_size, price, active
slots          id, owner_id, enrollment_id, weekday, time 'HH:MM', since
payment_cycles id, owner_id, enrollment_id, number, amount, status, paid_at, events jsonb
lessons        id, owner_id, enrollment_id, date, status, notes, slot_id, occurrence, cycle_id
```

- **Constraints carry the rules the database can check**, so a bug can't break them:
  `completed ⇔ cycle_id is set` (rules 1 and 5), `paid ⇔ paid_at is set`, unique names ignoring case,
  unique `(slot_id, occurrence)`, unique `(enrollment, weekday, time)`, unique `(enrollment, number)`.
- A lesson points to its cycle (`cycle_id`); the API rebuilds `lessonIds[]` for the frontend.
- Deleting students/teachers/subjects cascades to everything below them (used by `reset-year`).
- Money in whole DA (`integer`). Instants in `timestamptz` (UTC); local dates (`since`, `occurrence`) in `date`,
  returned as `"YYYY-MM-DD"` with `to_char` (never through a JS `Date`, which would shift them).
- "Today" = `(now() at time zone 'Africa/Algiers')::date`.
- **Migrations:** `npm run db:migrate` applies each file of `migrations/` not yet listed in the `schema_migrations`
  table, each in its own transaction. Tests apply the same files to PGlite.

## 4. API rules

- Base `/api`, JSON both ways. Ids are `id` (uuid strings).
- **Error format: `{ "message": "texte en français" }`.** The frontend shows `message` as is
  (`frontend/src/services/http.ts`). This overrides the `{ error: { code, message } }` format of the generic method.
- Codes: `400` invalid input · `401` not logged in / token expired · `403` sign-up not allowed ·
  `404` doesn't exist **or belongs to someone else** · `409` business conflict · `415` a request that changes data without `Content-Type: application/json` · `429` too many failed logins · `500` (generic message, details only in the server log).
- Every query filters by `owner_id = <user from the token>`. Never trust an id or owner from the client.
- Every operation touching a lesson and a cycle runs in **one transaction** and starts by locking the enrollment row
  (`select … for update`), so two requests at the same time can't put sessions in the wrong cycle.
- Routes that change data only accept `Content-Type: application/json` (CSRF protection, with the cookie's `SameSite`).

## 5. Authentication

- **Sign-up** only for emails in `ALLOWED_EMAILS` (comma-separated, compared trimmed and lowercase).
  Empty = sign-up closed. Otherwise `403` « Les inscriptions sont fermées. »
- Passwords: bcrypt. Login answers the same message for an unknown email or a wrong password.
- **Rate limit:** 10 failed logins per IP per 15 minutes, counted in `login_attempts` (in the database, so it works on any host).
- **Token:** JWT `{ sub: userId, v: token_version }`, 30 days, signed with `JWT_SECRET`, in cookie `st_session`:
  `httpOnly`, `Secure` in production, `SameSite=Strict`, `Path=/api`.
- `requireAuth` checks the signature **and** that `v` equals `users.token_version`; logout increments it
  (invalidates every token: "log out everywhere").
- Register and login return `{ user: { id, name, email } }`; the token is only in the cookie.

## 6. Tests

- `npm test` runs every `*.test.ts` with `node:test`, each file on a fresh PGlite database.
- Business rules: the cases of `API_CONTRACT.md` §4, written **before** the code they test.
- **Safety harness** (`test/safety.test.ts`): a table listing every protected route. For each one it checks
  (1) no cookie → `401`, (2) a second user acting on the first user's data → `404` and nothing changed.
  **Every new endpoint is added to this table.**
- No real personal data in tests: invented names and `@example.com` emails.

## 7. Configuration and deployment

- Settings only from environment variables: `DATABASE_URL`, `JWT_SECRET` (64+ random chars), `ALLOWED_EMAILS`,
  `PORT`, `NODE_ENV`. `.env` is never committed; `.env.example` has fake values.
- `app.set("trust proxy", 1)` (every host puts a proxy in front: real client IP, `Secure` cookies).
- No state in memory: restarts, sleeping or several instances break nothing.
- **Render**, one web service: Express serves `/api` **and** the built frontend (`frontend/dist`), so the site and the
  API share one address (cookie works, no CORS).
- `DATABASE_URL`: Supabase **session pooler** (IPv4) for an always-on server; **transaction pooler** (port 6543) for a
  serverless host. No code change between the two.
- Moving host = copy the environment variables and set the build/start commands. Nothing else.

## 8. Commands (in `StudyTrack/backend/`)

| Command | Does |
|---|---|
| `npm run dev` | Server with auto-restart, reads `.env` |
| `npm test` | All tests |
| `npm run lint` | oxlint |
| `npm run typecheck` | tsc, types only |
| `npm run db:migrate` | Applies new migrations to `DATABASE_URL` |
| `npm start` | Production start |
