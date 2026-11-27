# StudyTrack backend: PRD (what it must do)

Details of every route and JSON shape: `API_CONTRACT.md`. This document says *what* and *why*; `TRD.md` says *how*.

## 1. The product

StudyTrack helps a mother follow her children's private lessons in Algeria: which lessons happen each week, which
ones took place, and when a block of lessons (a **cycle**) must be paid in cash to the teacher.

The frontend (React, `frontend/`) talks to this backend; the fake browser server it started with (`mock.ts`) was removed at launch.
The backend replaces that fake server so the data is safe, shared between her phone and computer, and never lost.

## 2. Users

| Who | What they do |
|---|---|
| **The mother** (the only user) | Adds weekly lessons, confirms or cancels each session, marks cycles as paid, corrects a payment made by mistake, starts a new school year. |

- One account. Nobody else may create one (sign-up limited to an allowlist of emails).
- She is not technical and may be elderly: every message is in **simple French**, with no technical words.
- She uses an Android phone and a computer.

## 3. Features

| # | Feature | Contract |
|---|---|---|
| F1 | Create an account (allowed emails only), log in, log out | §3 Authentification |
| F2 | See everything: enrollments (child + subject + teacher), sessions, payment cycles, weekly lessons | §3 Lecture |
| F3 | Add, edit, delete a session; confirm or cancel it | §3 Séances |
| F4 | Add a weekly lesson ("Maths with M. Arris every Saturday at 12:00"); stop it | §3 Cours qui se répètent |
| F5 | Mark a full cycle as paid; correct a payment made by mistake | §3 Paiement |
| F6 | New school year: erase all data, keep the account | §3 Nouvelle année |
| F7 | Settings: change how many sessions make a cycle, or the price, of an enrollment (paid cycles never change) | §3 Cours suivis |

## 4. Business rules (the heart of the app)

Full text and the list of test cases: `API_CONTRACT.md` §4.

1. Only **completed** sessions count towards a cycle.
2. A completed session joins the **first cycle that isn't full**, among unpaid cycles and the latest cycle even if paid
   (payment is made at the first session, so the paid cycle then fills up); if there is none, a new cycle is created.
3. A session is never in two cycles.
4. A cycle is **due from its first session** (payment at the start): unpaid with at least one completed session.
   A course can have several sessions per week (one weekly slot per day).
5. A **paid cycle is locked**: its sessions can't be changed or deleted. The only way back is "correct this payment",
   which makes it unpaid again and is recorded in a history that is never shortened.
6. Every change touching a session and a cycle is all-or-nothing.

## 5. Security

- Only her account can read or change her data. Anything else answers "not found".
- Password hashed, never stored or returned in clear.
- Login protected against password guessing (limited attempts) and session theft (httpOnly cookie, HTTPS).
- No secret (database password, signing key) in the code or in git.

## 6. Targets

| Topic | Target |
|---|---|
| Data size | A few hundred rows per school year. No pagination. |
| Time zone | Algeria (`Africa/Algiers`, UTC+1 all year) for "today" and local dates. |
| Money | Algerian dinars (DA), whole numbers. A price is for a whole cycle. |
| Cost | Free or a few euros a month. A slow first load after a quiet period is acceptable at first. |
| Hosting | Not tied to one host (start on Render). |

## 7. Out of scope (for now)

- Several users or families, roles, sharing.
- Password reset by email (one user; can be reset by hand in the database).
- Pages the frontend doesn't have yet: editing students/teachers/subjects/enrollments, `GET /auth/me` (contract §7).
- Notifications, exports, statistics on the server (the frontend computes them).
