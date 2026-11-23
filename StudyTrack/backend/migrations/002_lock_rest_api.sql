-- Migration 002 : fermer l'API REST automatique de Supabase.
-- Supabase publie les tables du schéma public par une API web, accessible avec la clé publique du projet. Le serveur
-- ne s'en sert pas. Activer la sécurité par ligne (RLS) SANS aucune règle refuse tout à cette API ; le serveur se
-- connecte en propriétaire des tables, qui n'est pas concerné.
-- Toute nouvelle table devra faire de même (le test « chaque table a la RLS » le vérifie).

alter table users enable row level security;
alter table login_attempts enable row level security;
alter table students enable row level security;
alter table teachers enable row level security;
alter table subjects enable row level security;
alter table enrollments enable row level security;
alter table slots enable row level security;
alter table payment_cycles enable row level security;
alter table lessons enable row level security;
alter table schema_migrations enable row level security;
