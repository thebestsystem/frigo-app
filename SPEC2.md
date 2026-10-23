# SPEC v2 — Frigo : document imprimable, bilan F-Gas, brouillon TrackDéchets

Le socle existe (3 étapes, signature, file locale, hors ligne, 6 tests verts).
Cette version ajoute de quoi rendre l'outil utilisable, **sans backend** et **sans dépendance npm**.

## 0. Contrainte corrigée : l'API TrackDéchets est en GraphQL
L'API Trackdéchets n'accepte **pas** un POST REST avec un objet métier. C'est un endpoint
**GraphQL** unique, authentifié par `Authorization: Bearer <token>`, avec `{ query, variables }`.

Deux mutations nous concernent :
- `createDraftBsff(input: BsffInput!)` : seuls le `type` et un SIRET sont requis → c'est ce que
  le technicien peut faire sur chantier.
- `createFicheIntervention(...)` : reporte les données d'une fiche d'intervention papier
  (détenteur, équipement, fluides) et peut ensuite être rattachée à un BSFF.

La mutation `createBsff` complète exige transporteur, destination, emballages et poids :
**hors périmètre terrain**. On ne l'implémente pas. Le bureau complète le brouillon ensuite
dans TrackDéchets.

Endpoints :
- bac à sable : `https://api.sandbox.trackdechets.beta.gouv.fr`
- production : `https://api.trackdechets.beta.gouv.fr`

## 1. Document imprimable (`js/cerfa.js`)
- `buildCerfaHtml(intervention, company)` → HTML autonome A4 portrait, styles inline :
  détenteur de l'équipement (client), opérateur (entreprise + SIRET), équipement
  (marque, modèle, n° série, fluide, charge), intervention (type, date, poids avant/après,
  charge récupérée, longueur circuit), bloc signature (image data URL + nom), et en pied la mention
  **« Document de travail généré par Frigo — ne remplace pas le Cerfa officiel signé. »**
- `printDoc(html)` côté UI : ouvre une fenêtre, y écrit le HTML, appelle `print()`.
  Aucune bibliothèque PDF, aucun appel réseau.
- Impression : marges 12 mm, texte ≥ 9 pt, tableau mesures lisible en noir et blanc, pas de bouton imprimé.

## 2. Bilan F-Gas (`js/bilan.js`)
- `aggregateBilan(interventions, year)` → `{ year, count, byFluid: { R32: {n, kg}, R410A: {n, kg} }, totalKg }`.
  On ne compte que les interventions de l'année, `status !== "draft"`, fluide connu.
- `buildBilanHtml(bilan, company)` → document imprimable : lignes (date, client, fluide, kg) + totaux.

## 3. Client TrackDéchets (`js/trackdechets.js`)
- `buildDraftBsffVariables(intervention, company)` → `{ input: { type: "BSFF", emitter: { company: { siret, name, contact, phone, mail, address } } } }`,
  sans aucune valeur `undefined` (champs inconnus omis, pas mis à `null` sans raison).
- `GRAPHQL_CREATE_DRAFT_BSFF` : la mutation en texte, avec `Bsff` et son `id` en sélection.
- `sendDraftBsff(intervention, company, options)` avec
  `options = { token, endpoint, dryRun, fetchImpl }` :
  - `dryRun` (défaut) → `{ ok: true, dryRun: true, body }`, **aucun appel réseau** ;
  - token absent → `{ ok: false, error: "jeton TrackDéchets manquant" }`, aucun appel réseau ;
  - réel → `POST endpoint` en JSON `{ query, variables }`, en-têtes `Authorization: Bearer` et `Content-Type: application/json` ;
    gère 200 avec `errors` GraphQL → `ok: false` et message ; 200 sans erreur → `{ ok: true, id }` ;
    400/401/500 → `ok: false` avec le message serveur.
- `fetchImpl` injectable : les tests ne font aucun réseau.

## 4. Interface
- Onglet **Réglages** : SIRET, nom, contact, téléphone, email, adresse de l'entreprise ;
  jeton TrackDéchets (champ masqué + case afficher) ; environnement Bac à sable | Production ;
  case **Mode simulation** cochée par défaut. Persistance `localStorage` clé `frigo.settings.v1`.
- Écran de confirmation : boutons **« Exporter en PDF »**, **« Bilan F-Gas »**,
  **« Créer le brouillon TrackDéchets »**. Statut par intervention :
  `status: "pending" | "draft-created" | "error"`, plus `lastError`, `sentAt`, `trackdechetsId`, persistés.
- Écran 1 : compteur « N en attente · M brouillons créés · K erreurs ».

## 5. Tests (6 existants + 8 nouveaux = 14, tous verts)
7. `buildCerfaHtml` contient marque, fluide, charge récupérée, nom du signataire et la mention obligatoire.
8. `aggregateBilan` sur 3 interventions (2 en 2026, 1 en 2025) → compte 2, totaux par fluide exacts.
9. `buildDraftBsffVariables` : `input.type === "BSFF"`, SIRET présent, aucune valeur `undefined` (test récursif).
10. `sendDraftBsff` en `dryRun` → `ok: true`, `dryRun: true`, `fetchImpl` **jamais appelé**.
11. `sendDraftBsff` sans token → `ok: false`, message explicite, aucun appel réseau.
12. `sendDraftBsff` avec `fetchImpl` renvoyant 200 + `{data:{createDraftBsff:{id:"bsff_1"}}}` → `ok: true`, `id` remonté, corps envoyé conforme (`query` + `variables`).
13. `sendDraftBsff` avec `fetchImpl` renvoyant 200 + `{errors:[{message:"SIRET invalide"}]}` → `ok: false`, message remonté.
14. Migration : intervention ancien format (sans `status`) lue comme `status: "pending"`.

## Definition of Done
- `node --test` : **14 tests, 0 échec** (les 6 d'origine inclus).
- Navigateur : parcours complet → « Exporter en PDF » affiche un document conforme et imprimable ;
  « Bilan F-Gas » liste l'intervention ; « Créer le brouillon » en simulation affiche `dry-run`
  **sans aucune requête réseau** (vérifiable dans l'onglet Réseau) ; sans jeton en mode réel → erreur claire
  et statut `error`.
- Hors ligne préservé : les nouveaux modules sont ajoutés au cache du service worker.
- Aucun `TODO`, aucune fonction vide, zéro dépendance npm.

## Interdits
- Aucun appel réseau implicite : tout passe par `sendDraftBsff` avec `fetchImpl`.
- Ne jamais écrire « Cerfa » dans un export sans la mention « document de travail ».
- Ne pas casser les 6 tests existants, ni `design-ref/`, ni le mode hors ligne.
