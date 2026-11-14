# StudyTrack — frontend

React 19 + TypeScript + Vite + React Router. Les textes de l'interface et les commentaires sont en français.

## Commandes (Windows PowerShell)

```powershell
npm install
npm run dev          # serveur de développement (fausse API par défaut, voir .env.development)
npm run build        # vérification TypeScript + build de production
npm run lint
```

Variables (`.env.example`, jamais de secret) : `VITE_API_URL` (racine de l'API, `/api` par défaut) et
`VITE_USE_MOCK` (`true` = fausse API dans le navigateur, `false` = vrai backend).

## Pages

| Route | Fichier | Rôle |
|---|---|---|
| `/connexion`, `/inscription` | `pages/AuthPage.tsx` | Compte et connexion |
| `/` | `pages/DashboardPage.tsx` | Accueil : cours de demain, à payer / payés cette semaine |
| `/cours` | `pages/LessonsPage.tsx` | Semaine par semaine, cours à confirmer, cours qui se répètent |
| `/paiements` | `pages/PaymentsPage.tsx` | À payer (toutes semaines), cycles en cours, historique, correction d'un paiement |

Les routes protégées sont dans `App.tsx` (sans session on renvoie vers `/connexion`).

## Où est quoi

```text
src/
├─ services/            tout ce qui parle au serveur
│  ├─ api.ts            LE CONTRAT : une fonction par route du backend (commentée)
│  ├─ auth.ts           connexion / inscription
│  ├─ http.ts           fetch commun : jeton, erreurs {message}, déconnexion sur 401
│  ├─ session.ts        jeton et utilisateur connecté (localStorage)
│  └─ mock.ts           FAUSSE API de développement + règles métier de référence (supprimable)
├─ lib/                 logique pure, sans React ni réseau
│  ├─ cycles.ts         semaine dimanche→samedi, cycles « à payer », en retard, couleurs par élève
│  ├─ slots.ts          calcul des cours qui se répètent (occurrences)
│  ├─ lessons.ts        dates/heures et libellés
│  └─ validation.ts     validation du formulaire de connexion
├─ pages/               une page = un fichier .tsx + son .css
├─ components/          Header, Brand, PayCard, formulaires (LessonForm, SlotForm), NewYearReset (réservé aux Paramètres)
├─ styles/              fridge.css (porte de frigo, aimants, papier) et board.css (éléments communs aux pages : résumés, cartes, fiche, boutons)
└─ types.ts             formes JSON échangées avec l'API
```

## Pour brancher le vrai backend

Tout est expliqué dans `../docs/API_CONTRACT.md` (section 8). En résumé : `VITE_USE_MOCK=false`, le backend sur le
port 5000 (proxy Vite `/api`), puis supprimer `src/services/mock.ts` quand tout marche.

## Reste à faire

Pages à venir : paramètres (y compris le composant `NewYearReset`, déjà écrit), PWA. Voir `../docs/API_CONTRACT.md` §7 pour les routes déjà prévues.
