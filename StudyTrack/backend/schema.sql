-- StudyTrack : schéma de la base (Supabase Postgres). À exécuter une fois sur une base vide.
-- Règles et formats : docs/API_CONTRACT.md. Les contraintes ci-dessous protègent les données même si le code a un bug.

create table users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(name) between 2 and 100),
  email         text not null unique check (email = lower(email)),
  password_hash text not null,
  token_version integer not null default 0, -- +1 à la déconnexion : tous les anciens jetons deviennent invalides
  created_at    timestamptz not null default now()
);

-- Limite des tentatives de connexion (en base, pas en mémoire : marche chez n'importe quel hébergeur).
create table login_attempts (
  ip text not null,
  at timestamptz not null default now()
);
create index login_attempts_ip_at on login_attempts (ip, at);

create table students (
  id       uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users on delete cascade,
  name     text not null check (length(name) between 1 and 100)
);
create unique index students_owner_name on students (owner_id, lower(name));

create table teachers (
  id       uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users on delete cascade,
  name     text not null check (length(name) between 1 and 100)
);
create unique index teachers_owner_name on teachers (owner_id, lower(name));

create table subjects (
  id       uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users on delete cascade,
  name     text not null check (length(name) between 1 and 100)
);
create unique index subjects_owner_name on subjects (owner_id, lower(name));

-- Inscription : un élève suit une matière avec un enseignant.
create table enrollments (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references users on delete cascade,
  student_id uuid not null references students on delete cascade,
  teacher_id uuid not null references teachers on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  cycle_size integer not null check (cycle_size between 1 and 50), -- séances par paiement
  price      integer check (price >= 0),                            -- prix d'un cycle complet, en DA
  active     boolean not null default true,
  unique (owner_id, student_id, teacher_id, subject_id)
);

-- Cours qui se répète chaque semaine. Le serveur ne génère jamais de séances à partir d'un créneau.
create table slots (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references users on delete cascade,
  enrollment_id uuid not null references enrollments on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6),            -- 0 = dimanche
  time          text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), -- heure locale HH:MM
  since         date not null default (now() at time zone 'Africa/Algiers')::date,
  unique (owner_id, enrollment_id, weekday, time)
);

create table payment_cycles (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references users on delete cascade,
  enrollment_id uuid not null references enrollments on delete cascade,
  number        integer not null check (number > 0),
  amount        integer check (amount >= 0),
  status        text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  paid_at       timestamptz,
  events        jsonb not null default '[]', -- trace d'audit, en ajout seulement : [{ type: "paid"|"unpaid", at }]
  unique (owner_id, enrollment_id, number),
  check ((status = 'paid') = (paid_at is not null))
);

create table lessons (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references users on delete cascade,
  enrollment_id uuid not null references enrollments on delete cascade,
  date          timestamptz not null,
  status        text not null check (status in ('planned', 'completed', 'cancelled')),
  notes         text check (length(notes) <= 1000),
  slot_id       uuid references slots on delete set null,
  occurrence    date, -- date prévue d'origine (locale) quand la séance vient d'un créneau
  cycle_id      uuid references payment_cycles,
  -- Règles 1 et 5 : une séance est dans un cycle si et seulement si elle est effectuée, et jamais dans deux (une seule colonne).
  check ((status = 'completed') = (cycle_id is not null))
);
create unique index lessons_owner_slot_occurrence on lessons (owner_id, slot_id, occurrence) where slot_id is not null;
create index lessons_cycle on lessons (cycle_id);
