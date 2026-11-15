# StudyTrack — Contrat entre le frontend et le backend

Ce document est destiné à la personne qui développe le **backend** (Node.js + Express + MongoDB/Mongoose).
Il décrit exactement ce que le frontend (React, dossier `frontend/`) envoie et attend. Il complète le cahier des
charges `StudyTrack_Specification.docx` : en cas de doute, ce contrat décrit ce que le frontend fait **réellement**.

Le code de référence est dans le frontend :

| Besoin | Fichier |
|---|---|
| Toutes les routes appelées par les écrans | `frontend/src/services/api.ts` et `frontend/src/services/auth.ts` |
| Gestion des requêtes, du jeton et des erreurs | `frontend/src/services/http.ts` |
| Formes JSON (TypeScript) | `frontend/src/types.ts` |
| **Règles métier de référence** (cycles, verrouillage, cours qui se répètent) | `frontend/src/services/mock.ts` (faux serveur, lisible comme une spécification exécutable) |
| Ce que le frontend calcule lui-même | `frontend/src/lib/cycles.ts`, `frontend/src/lib/slots.ts` |

---

## 1. Conventions générales

- **Base** : `VITE_API_URL` (par défaut `/api`). Toutes les routes ci-dessous sont relatives à cette base.
- **Format** : JSON dans les deux sens (`Content-Type: application/json`).
- **Authentification** : `Authorization: Bearer <jwt>` sur toutes les routes sauf `register` et `login`.
- **Identifiants** : chaînes nommées **`id`** (pas `_id`). Avec Mongoose, ajouter une transformation `toJSON` qui renomme `_id` en `id` et retire `__v` et `ownerId`.
- **Dates et heures** : chaînes ISO 8601 en **UTC** (`"2026-11-14T11:00:00.000Z"`). Exceptions, qui sont des valeurs *locales* (Algérie, UTC+1 toute l'année) : `Slot.since` et `Lesson.occurrence` (`"AAAA-MM-JJ"`) et `Slot.time` (`"HH:MM"`).
- **Erreurs** : bon code HTTP et corps `{ "message": "texte en français" }`. Le frontend affiche `message` **tel quel** à une personne âgée : il doit être clair, sans jargon technique ni stack trace.
  - `400` données invalides · `401` jeton absent ou expiré (le frontend déconnecte et renvoie vers `/connexion`) · `404` ressource inexistante *ou qui appartient à quelqu'un d'autre* · `409` conflit métier (voir plus bas) · `500` erreur serveur.
- **Propriété des données** : chaque ressource a un `ownerId` ; **toute** requête est filtrée par l'utilisateur du jeton. Ne jamais faire confiance à un `ownerId` venant du client.
- **Taille des listes** : les `GET` renvoient pour l'instant **toutes** les données de l'utilisateur (quelques centaines de lignes par an). Pas de pagination attendue.

## 2. Modèles

Ceux du cahier des charges (§5), avec ces ajouts. Les champs marqués ★ sont nouveaux par rapport au cahier.

```text
Student      { ownerId, name }
Teacher      { ownerId, name }
Subject      { ownerId, name }
Enrollment   { ownerId, studentId, teacherId, subjectId, cycleSize, price?, active }
Lesson       { ownerId, enrollmentId, date, status, notes?, slotId ★, occurrence ★ }
PaymentCycle { ownerId, enrollmentId, number, lessonIds[], amount?, status, paidAt?, notes?, events[] ★ }
Slot ★       { ownerId, enrollmentId, weekday, time, since }
```

- **`Enrollment.price`** : le frontend le traite comme le **prix d'un cycle** complet (en DA), pas d'une séance. `PaymentCycle.amount` reçoit cette valeur à la création du cycle. Si vous préférez « prix par séance », dites-le : il suffit de multiplier par `cycleSize` côté serveur (le frontend affiche seulement `amount`).
- **`PaymentCycle.events` ★** (trace d'audit, cahier §6) : tableau **en ajout seulement** `{ type: "paid" | "unpaid", at: ISO }`. Le serveur ajoute un événement à chaque `mark-paid` et `mark-unpaid`, sans jamais en supprimer. Le frontend s'en sert pour afficher « Ce paiement a déjà été corrigé une fois ». Vous pouvez y ajouter d'autres champs (qui, adresse IP…) : le frontend les ignore.
- **`Lesson.status`** : `"planned" | "completed" | "cancelled"`.
- **`Slot` ★** (« cours qui se répète chaque semaine ») : `weekday` 0 = dimanche … 6 = samedi, `time` `"HH:MM"`, `since` = date de création. **Le serveur ne génère jamais de séances à partir d'un `Slot`** : le frontend calcule les occurrences à l'affichage (`frontend/src/lib/slots.ts`). Une `Lesson` n'est enregistrée que lorsque la personne la confirme, l'annule ou la modifie ; elle porte alors `slotId` et `occurrence` (la date prévue d'origine, même si l'heure a été déplacée).
- **Index conseillés** : `Lesson` unique sur `(ownerId, slotId, occurrence)` quand `slotId` existe (évite les doublons) ; `Slot` unique sur `(ownerId, enrollmentId, weekday, time)` ; `PaymentCycle` unique sur `(ownerId, enrollmentId, number)`.
- **`Enrollment` renvoyé « à plat »** : en plus de ses champs, la réponse **doit** contenir `studentName`, `teacherName` et `subjectName` (faire un `populate`). Sans eux, le frontend n'affiche rien. Les champs `studentId`, `teacherId`, `subjectId`, `active` peuvent être présents, le frontend les ignore pour l'instant.

## 3. Routes utilisées par le frontend aujourd'hui

### Authentification
| Route | Corps | Réponse |
|---|---|---|
| `POST /auth/register` | `{ name, email, password }` | `201` `{ token, user: { id, name, email } }` |
| `POST /auth/login` | `{ email, password }` | `200` `{ token, user: { id, name, email } }` |

Erreurs : `409` « Un compte existe déjà avec cet e-mail. Connecte-toi plutôt. » · `401` « E-mail ou mot de passe incorrect. » (même message que l'e-mail soit inconnu ou le mot de passe faux). Mot de passe haché (bcrypt/Argon2), jamais renvoyé. Le frontend valide : e-mail correct, mot de passe d'au moins 8 caractères, nom d'au moins 2 caractères (à re-valider côté serveur).

### Lecture (toutes protégées, filtrées par `ownerId`)
| Route | Réponse |
|---|---|
| `GET /enrollments` | `Enrollment[]` (avec `studentName`, `teacherName`, `subjectName`) |
| `GET /lessons` | `Lesson[]` — **toutes**, y compris celles rangées dans des cycles payés |
| `GET /payment-cycles` | `PaymentCycle[]` — payés et non payés (l'historique) |
| `GET /slots` | `Slot[]` |

Exemples :
```json
{ "id": "e1", "studentName": "Sara", "teacherName": "M. Arris", "subjectName": "Maths", "cycleSize": 4, "price": 6000 }
{ "id": "l9", "enrollmentId": "e1", "date": "2026-11-14T11:00:00.000Z", "status": "completed", "notes": "Chapitre 3", "slotId": "s1", "occurrence": "2026-11-14" }
{ "id": "c2", "enrollmentId": "e1", "number": 2, "lessonIds": ["l5","l6","l7","l8"], "amount": 6000, "status": "unpaid" }
{ "id": "c1", "enrollmentId": "e1", "number": 1, "lessonIds": ["l1","l2","l3","l4"], "amount": 6000, "status": "paid", "paidAt": "2026-10-05T08:00:00.000Z" }
{ "id": "s1", "enrollmentId": "e1", "weekday": 6, "time": "12:00", "since": "2026-11-11" }
```

### Cours suivis (inscriptions)
| Route | Corps | Réponse |
|---|---|---|
| `PATCH /enrollments/:id` | `{ cycleSize?, price? }` | `200` l'`Enrollment` (avec les noms, voir §2) |

- `cycleSize` : entier ≥ 1 (sinon `400` « Le nombre de cours avant paiement doit être un nombre entier, par exemple 4. »). `price` : nombre ≥ 0, ou **`null` pour retirer le prix** (sinon `400` « Le prix doit être un nombre, par exemple 6000. »).
- **Les cycles déjà payés ne changent jamais.** Un nouveau `price` est recopié dans `amount` de tous les cycles **non payés** de cette inscription. Aucune séance n'est déplacée d'un cycle à l'autre. Un cycle non payé qui contient déjà au moins `cycleSize` séances devient « à payer » (le frontend le calcule) ; un cycle qui en contient plus que le nouveau `cycleSize` reste tel quel.
- Le frontend ne modifie que ces deux champs ; renommer un élève, un enseignant ou une matière viendra plus tard.

### Séances
| Route | Corps | Réponse |
|---|---|---|
| `POST /lessons` | `{ enrollmentId, date, status, notes?, slotId?, occurrence? }` | `201` la `Lesson` créée |
| `PATCH /lessons/:id` | `{ date?, status?, notes? }` (jamais `enrollmentId`) | `200` la `Lesson` |
| `DELETE /lessons/:id` | — | `204` |

- `POST` avec `status: "completed"` : la séance est rangée dans un cycle (règles §4). `409` « Ce cours est déjà enregistré. » si `(slotId, occurrence)` existe déjà.
- `PATCH` qui fait passer `status` à/depuis `completed` : la séance entre dans un cycle ou en sort (règles §4).
- `PATCH` et `DELETE` : **`409` « Ce cours fait partie d'un cycle déjà payé : il ne peut plus être modifié. »** si la séance appartient à un cycle `paid`.

### Cours qui se répètent
| Route | Corps | Réponse |
|---|---|---|
| `POST /slots` | `{ studentName, subjectName, teacherName, weekday, time, cycleSize, price? }` | `201` le `Slot` |
| `DELETE /slots/:id` | — | `204` |

- `POST /slots` : le serveur **retrouve ou crée** l'élève, l'enseignant, la matière puis l'inscription. Comparaison des noms **sans tenir compte des majuscules ni des espaces autour**. `cycleSize` et `price` ne servent qu'à *créer* l'inscription ; si elle existe déjà, ils sont ignorés. `since` = date du jour (Algérie). `409` « Ce cours existe déjà à ce jour et à cette heure. » si `(inscription, weekday, time)` existe.
- `DELETE /slots/:id` : supprime le `Slot` **et** les séances `planned` de ce `slotId` dont la date est dans le futur. Les séances passées, confirmées (`completed`) ou annulées sont **conservées**.

### Paiement
| Route | Corps | Réponse |
|---|---|---|
| `PATCH /payment-cycles/:id/mark-paid` | `{}` (date facultative `paidAt`, sinon maintenant) | `200` le `PaymentCycle` |
| `PATCH /payment-cycles/:id/mark-unpaid` | `{}` | `200` le `PaymentCycle` |

- **`mark-paid`** : le serveur **doit vérifier** que le cycle est `unpaid` et complet (`lessonIds.length >= cycleSize`), sinon `409` « Ce cycle n'est pas encore complet. » ou « Ce cycle est déjà marqué comme payé. ». Il met `status = "paid"` et `paidAt`, et ajoute l'événement `paid`. Le cycle suivant peut être créé tout de suite ou, plus simplement, au moment où une séance en aura besoin (§4) ; le frontend accepte les deux.
- **`mark-unpaid`** (correction d'une erreur de la mère) : seulement si le cycle est `paid`, sinon `409` « Ce cycle n'est pas marqué comme payé. ». Il met `status = "unpaid"`, **supprime `paidAt`**, ajoute l'événement `unpaid`. Rien d'autre n'est effacé : les séances du cycle restent dedans (elles redeviennent modifiables, voir §4 règle 6). Le frontend demande déjà une confirmation avant d'appeler cette route.

### Nouvelle année
| Route | Corps | Réponse |
|---|---|---|
| `POST /reset-year` | `{}` | `204` |

Supprime **toutes** les données de l'utilisateur (élèves, enseignants, matières, inscriptions, séances, cours qui se répètent, cycles). Le compte est conservé. Action irréversible : le frontend demande déjà une confirmation et propose de télécharger une copie.

## 4. Règles des cycles (le cœur du métier)

Reprises du cahier des charges, avec les décisions prises pour ce qu'il laissait ouvert. Implémentation de référence : `attach`, `detach` et `markPaid` dans `frontend/src/services/mock.ts`.

1. **Seules les séances `completed` comptent.** Une séance `planned` ou `cancelled` n'est dans aucun cycle.
2. **Entrer dans un cycle** (séance qui devient `completed`) : elle rejoint le **premier cycle `unpaid` de l'inscription qui n'est pas plein** (par numéro croissant). Il n'y en a pas : un nouveau cycle est créé (`number` = plus grand numéro existant + 1, `amount` = `Enrollment.price`).
   - Conséquence voulue : si le cycle 2 est plein mais **pas encore payé**, la séance suivante va dans le cycle 3 ; elle ne « déborde » jamais dans un cycle plein.
   - Un **ajout rétroactif** (séance `completed` avec une date passée) suit la même règle : jamais dans un cycle payé.
3. **Sortir d'un cycle** (séance qui n'est plus `completed`, ou supprimée) : son id est retiré de `lessonIds`.
4. **Cycle « à payer »** : `status = "unpaid"` **et** `lessonIds.length >= cycleSize`.
5. **Une séance n'est jamais dans deux cycles.**
6. **Cycle payé = verrouillé** : ses séances ne peuvent plus être modifiées ni supprimées (`409`). L'historique n'est jamais détruit ; la correction d'un paiement fait par erreur est `PATCH /payment-cycles/:id/mark-unpaid` : le cycle redevient `unpaid` (donc ses séances redeviennent modifiables) et un événement d'audit est ajouté.
7. Chaque opération qui touche à la fois une séance et un cycle doit être **atomique** (transaction MongoDB, ou à défaut une opération qui ne laisse jamais un état à moitié fait).

### Cas de test à écrire en premier (cahier §4, « tests avant le reste »)
- Cycle de 4 : 1, 2, 3 séances `completed` → pas à payer ; la 4e → à payer.
- Séances `planned` ou `cancelled` : ne changent jamais le compteur.
- Après `mark-paid` : la séance `completed` suivante crée/alimente le cycle suivant ; le cycle payé garde ses 4 séances et sa date.
- Cycle 2 plein et non payé + une 5e séance → elle va dans le cycle 3.
- Séance `completed` repassée en `cancelled` (cycle non payé) → elle sort du cycle ; le cycle n'est plus « à payer ».
- Modifier ou supprimer une séance d'un cycle payé → `409`, rien ne change.
- `mark-unpaid` sur un cycle payé → `unpaid`, `paidAt` supprimé, événement `unpaid` ajouté, séances inchangées et de nouveau modifiables ; sur un cycle non payé → `409`. L'historique `events` n'est jamais raccourci.
- `mark-paid` sur un cycle incomplet → `409`.
- Ajout rétroactif → premier cycle non payé non plein, jamais un cycle payé.
- Deux inscriptions d'un même élève ont chacune leurs cycles (aucune confusion).
- `PATCH /enrollments/:id` : les cycles payés gardent leur `amount` ; les cycles non payés prennent le nouveau prix ; `cycleSize` 0, négatif ou décimal → `400`.
- Un utilisateur ne peut ni lire ni modifier les données d'un autre (`404`).

## 5. Ce que le frontend calcule seul (le backend n'a pas à le faire)

- **Semaine** « du dimanche au samedi » (écran « À payer cette semaine », « Payés cette semaine »), « demain », « aujourd'hui », « en retard » (cycle plein dont la dernière séance date d'avant la semaine en cours).
- **Date d'un cycle plein** : date de sa dernière séance (donc `GET /lessons` doit contenir toutes les séances référencées dans `lessonIds`).
- **Occurrences des cours qui se répètent**, les séances « à confirmer », les statistiques de l'accueil.
- Couleurs par élève, tris et filtres.

## 6. Sécurité et configuration

- Mots de passe : bcrypt ou Argon2. JWT signé avec un secret long, durée limitée (le frontend gère l'expiration : un `401` déconnecte).
- **Stockage du jeton côté navigateur** : aujourd'hui `localStorage` (`frontend/src/services/session.ts`). Un **cookie `httpOnly`** posé par le serveur serait plus sûr contre le vol de jeton ; si vous le choisissez, le changement côté frontend se limite à `http.ts` et `session.ts` (ajouter `credentials: "include"`, retirer l'en-tête `Authorization`).
- CORS : en développement le proxy de Vite (`/api` → `http://localhost:5000`) évite le problème. En production, autoriser uniquement l'adresse du site.
- Valider **toutes** les entrées côté serveur (le frontend valide pour l'ergonomie, pas pour la sécurité). Limiter les tentatives de connexion. Ne jamais committer `.env`, clés ou URI MongoDB.

## 7. Prévu par le cahier des charges, pas encore utilisé par le frontend

Le frontend ne les appelle pas aujourd'hui ; les prochaines pages les utiliseront :
`GET /auth/me`, CRUD `/students`, `/teachers`, `/subjects`, la création/suppression directe d'`/enrollments`, le changement de mot de passe, et la modification d'un cours qui se répète.

**Gardé seulement dans le navigateur** (rien à faire côté serveur) : la taille du texte choisie dans *Paramètres* (`localStorage`, `frontend/src/lib/prefs.ts`) et le fichier de sauvegarde JSON, construit par le frontend à partir des quatre `GET` de lecture (`frontend/src/lib/backup.ts`).

## 8. Brancher le frontend sur le vrai backend

1. Lancer le backend sur le port **5000** (ou changer le proxy dans `frontend/vite.config.ts`).
2. Dans `frontend/.env.development`, mettre `VITE_USE_MOCK=false` (et `VITE_API_URL=/api`).
3. `cd frontend`, `npm install`, `npm run dev`.
4. Parcours de recette : créer un compte → se connecter → ajouter un cours « Maths, M. Arris, chaque samedi 12:00 » (page *Cours*) → confirmer des séances « à confirmer » jusqu'à remplir un cycle → l'accueil affiche « À payer cette semaine » → « Marquer comme payé » → page *Paiements* : le paiement est dans l'historique → « Corriger ce paiement » le remet à payer → page *Paramètres* : changer « tous les … cours » ou le prix d'un cours suivi ; « Nouvelle année » vide les données.
5. Quand tout marche : supprimer `frontend/src/services/mock.ts`, puis retirer dans `api.ts` les lignes `if (MOCK) …` (et la ligne `const mock = …`) et dans `auth.ts` la branche `MOCK`.
