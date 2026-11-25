# StudyTrack

Application web (Android et ordinateur) pour suivre les cours particuliers d'enfants : cours de la semaine, séances
effectuées, cycles de paiement en espèces. Spécification : `StudyTrack_Specification.docx`.

```text
StudyTrack/
├─ frontend/   React + TypeScript + Vite            (voir frontend/README.md)
├─ backend/    Node.js + Express + Supabase Postgres (règles des cycles, connexion, tests)
├─ docs/       API_CONTRACT.md (routes, formats, règles), PRD, TRD, PLAN
└─ package.json  npm run build / npm start : un seul serveur pour le site et l'API (hébergé sur Render)
```

## Travailler en local (Windows PowerShell)

1. Backend : `cd StudyTrack\backend`, copier `.env.example` en `.env` et le remplir (base Supabase, secret, e-mails
   autorisés), puis :

   ```powershell
   npm install
   npm run db:migrate   # crée ou met à jour les tables
   npm test             # tous les tests (base en mémoire, sans Internet)
   npm run dev          # API sur http://localhost:5000/api
   ```

2. Frontend, dans un deuxième terminal :

   ```powershell
   cd StudyTrack\frontend
   npm install
   npm run dev          # http://localhost:5173 (le proxy envoie /api au backend)
   ```

## Mise en ligne

Render, un seul service web : Root Directory `StudyTrack`, Build `npm run build`, Start `npm start`, Health Check
`/api/health`. Variables d'environnement : `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_CA_CERT`, `JWT_SECRET`,
`ALLOWED_EMAILS` (voir `backend/.env.example`). Toute nouvelle migration : `npm run db:migrate` **avant** de déployer le
code qui en a besoin.
