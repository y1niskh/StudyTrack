# StudyTrack

Application web (Android et ordinateur) pour suivre les cours particuliers d'enfants : cours de la semaine, séances
effectuées, cycles de paiement en espèces. Spécification : `StudyTrack_Specification.docx`.

```text
StudyTrack/
├─ frontend/   React + TypeScript + Vite   → terminé page par page (voir frontend/README.md)
├─ backend/    Node.js + Express + MongoDB → à faire ; vide pour l'instant
└─ docs/
   └─ API_CONTRACT.md   ← À LIRE EN PREMIER pour le backend : routes, formats JSON, règles des cycles, tests
```

## Pour la personne qui développe le backend

1. Lire `docs/API_CONTRACT.md` (15 minutes) : il dit exactement ce que le frontend envoie et attend.
2. Les règles métier (cycles, verrouillage des cycles payés, cours qui se répètent) sont écrites en code lisible dans
   `frontend/src/services/mock.ts` : c'est le « faux serveur » du frontend, à reproduire côté Express et à couvrir de tests.
3. Brancher le frontend sur votre API en changeant une seule variable (`VITE_USE_MOCK=false`) : voir la section 8 du contrat.

## Lancer le frontend (Windows PowerShell)

```powershell
cd StudyTrack\frontend
npm install
npm run dev        # http://localhost:5173  (données de démonstration, sans backend)
```
