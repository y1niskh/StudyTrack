# StudyTrack — frontend

React 19 + TypeScript + Vite + React Router. Les textes de l'interface et les commentaires sont en français.

## Commandes (Windows PowerShell)

```powershell
npm install
npm run dev          # serveur de développement ; lancer aussi le backend (port 5000, voir ../backend)
npm run build        # vérification TypeScript + build de production
npm run lint
```

Variable (`.env.example`, jamais de secret) : `VITE_API_URL` (racine de l'API, `/api` par défaut).

## Pages

| Route | Fichier | Rôle |
|---|---|---|
| `/connexion`, `/inscription` | `pages/AuthPage.tsx` | Compte et connexion |
| `/` | `pages/DashboardPage.tsx` | Accueil : cours de demain, à payer / payés cette semaine |
| `/cours` | `pages/LessonsPage.tsx` | Semaine par semaine, cours à confirmer, cours qui se répètent |
| `/paiements` | `pages/PaymentsPage.tsx` | À payer (toutes semaines), cycles en cours, historique, correction d'un paiement |
| `/parametres` | `pages/SettingsPage.tsx` | Taille du texte, compte, cours suivis (cycle et prix), sauvegarde, « Nouvelle année » |

Les routes protégées sont dans `App.tsx` (sans session on renvoie vers `/connexion`).

## Où est quoi

```text
src/
├─ services/            tout ce qui parle au serveur
│  ├─ api.ts            LE CONTRAT : une fonction par route du backend (commentée)
│  ├─ auth.ts           connexion / inscription
│  ├─ http.ts           fetch commun : JSON, erreurs {message}, déconnexion sur 401 (le jeton est dans un cookie httpOnly)
│  └─ session.ts        utilisateur connecté (localStorage, jamais le jeton)
├─ lib/                 logique pure, sans React ni réseau
│  ├─ cycles.ts         semaine dimanche→samedi, cycles « à payer », en retard, couleurs par élève
│  ├─ slots.ts          calcul des cours qui se répètent (occurrences)
│  ├─ lessons.ts        dates/heures et libellés
│  ├─ prefs.ts          taille du texte (réglage local, localStorage)
│  ├─ backup.ts         fichier de sauvegarde JSON
│  └─ validation.ts     validation du formulaire de connexion
├─ pages/               une page = un fichier .tsx + son .css
├─ components/          Header, Brand, PayCard, formulaires (LessonForm, SlotForm), NewYearReset (page Paramètres)
├─ styles/              fridge.css (porte de frigo, aimants, papier) et board.css (éléments communs aux pages : résumés, cartes, fiche, boutons)
└─ types.ts             formes JSON échangées avec l'API
```

## Le backend

Le frontend parle au vrai backend (`../backend`, Express + Supabase Postgres). En développement, le proxy de Vite
envoie `/api` vers http://localhost:5000. En production, le même serveur sert le site construit et l'API.
Les règles métier (cycles, paiements) sont dans le backend : `../backend/src/modules/`.

## Reste à faire

À venir : PWA (installation sur téléphone, hors ligne), modification d'un cours qui se répète, renommer élèves/enseignants/matières. Voir `../docs/API_CONTRACT.md` §7 pour les routes déjà prévues.
