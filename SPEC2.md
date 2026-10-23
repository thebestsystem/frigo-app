# SPEC v2 — Frigo : du formulaire au document et à l'envoi TrackDéchets

Le socle existe (3 étapes, signature, file locale, hors ligne, 6 tests verts).
Cette version ajoute ce qui transforme la démo en outil utilisable en production,
**sans backend** et **sans nouvelle dépendance**.

## 1. Document Cerfa 15497 (`js/cerfa.js`)
- `buildCerfaHtml(intervention)` → chaîne HTML autonome, A4 portrait, styles inline,
  reprenant la structure du Cerfa 15497*04 : cadre « Détenteur de l'équipement »,
  « Opérateur », « Équipement » (marque, modèle, n° série, fluide, charge),
  « Intervention » (type, date, poids avant/après, charge récupérée, longueur circuit),
  bloc signature (image data URL + nom), mention en pied : **« Document de travail généré
  par Frigo — ne remplace pas le Cerfa officiel signé. »**
- `printToPdf()` côté UI : ouvre une fenêtre contenant le HTML et déclenche `print()`
  (l'utilisateur choisit « Enregistrer en PDF »). Aucune bibliothèque PDF.
- Contraintes d'impression : pas de bouton dans le document, marges 12 mm, texte ≥ 9 pt,
  signature encadrée, tableau des mesures lisible en noir et blanc.

## 2. Bilan F-Gas annuel (`js/bilan.js`)
- `aggregateBilan(interventions, year)` → `{ year, count, byFluid: {R32: {n, kg}, R410A: {...}}, totalKg }`
  en ne comptant que les interventions `status !== "draft"` de l'année demandée.
- `buildBilanHtml(bilan, company)` → document imprimable listant les interventions
  (date, client, fluide, charge récupérée) et les totaux par fluide.

## 3. Envoi TrackDéchets (`js/trackdechets.js`)
- `buildBsffPayload(intervention, company)` → objet JSON stable, sans `undefined` :
  `{ type: "BSFF", emitter: {companySiret, name}, waste: {code: "14 06 01*", pop: true},
     quantity: {value: chargeRecuperee, unit: "KG"}, takenOverAt: date, transporter: null,
     destination: null, externalId: intervention.id }`.
- `sendBsff(intervention, company, options)` avec `options = { token, endpoint, dryRun, fetchImpl }` :
  - `dryRun` → ne fait aucun appel réseau, retourne `{ ok: true, dryRun: true, payload }` ;
  - sans token → `{ ok: false, error: "token manquant" }` **sans** appel réseau ;
  - en réel → `POST endpoint` avec `Authorization: Bearer <token>` et le payload ;
    gère 200/201 (`ok: true`), 400/401/500 (`ok: false, error` avec le message serveur).
- `fetchImpl` injectable : les tests ne font aucun réseau.

## 4. Interface
- Écran **Réglages** (nouvel onglet accessible depuis l'en-tête) : SIRET de l'entreprise,
  nom, jeton TrackDéchets (champ mot de passe + case « afficher »), sélecteur
  Environnement : Bac à sable | Production, case **Mode simulation (aucun envoi)** cochée par défaut.
  Persistance dans `localStorage` clé `frigo.settings.v1`.
- Sur l'écran de confirmation : boutons **« Exporter en PDF »**, **« Bilan F-Gas »**,
  **« Envoyer à TrackDéchets »**. Chaque intervention porte désormais
  `status: "pending" | "sent" | "error"` + `lastError` + `sentAt`, persistés.
- Écran 1 : compteur « N interventions en attente · M envoyées ».

## 5. Tests (s'ajoutent aux 6 existants, tous doivent passer)
7. `buildCerfaHtml` contient marque, fluide, charge récupérée, nom du signataire et la mention obligatoire.
8. `aggregateBilan` sur 3 interventions (2 en 2026, 1 en 2025) → compte 2, totaux par fluide corrects.
9. `buildBsffPayload` : pas de `undefined`, `externalId` = id, quantité = charge récupérée.
10. `sendBsff` en `dryRun` → `ok: true`, aucun appel au `fetchImpl` fourni.
11. `sendBsff` sans token → `ok: false`, message explicite, aucun appel réseau.
12. `sendBsff` avec `fetchImpl` renvoyant 201 → `ok: true` et payload transmis conforme.
13. `sendBsff` avec `fetchImpl` renvoyant 400 → `ok: false`, message d'erreur remonté.
14. Migration : une intervention de l'ancien format (sans `status`) est lue comme `status: "pending"`.

## Definition of Done
- `node --test` : **14 tests, 0 échec**.
- Dans le navigateur : parcours complet d'une intervention, puis « Exporter en PDF » produit
  un document imprimable contenant les données et la signature ; « Bilan F-Gas » liste
  l'intervention ; « Envoyer à TrackDéchets » en mode simulation affiche `dry-run` sans réseau
  (vérifiable onglet Réseau vide) ; en mode réel sans jeton → message d'erreur clair, statut `error`.
- Hors ligne préservé (service worker, aucun appel réseau au chargement).
- Aucun `TODO`, aucune fonction vide, pas de dépendance npm.

## Interdits
- Ne pas écrire le mot « Cerfa » sans la mention « document de travail » dans les exports.
- Pas d'appel réseau implicite : tout envoi passe par `sendBsff` avec `fetchImpl`.
- Ne pas casser les 6 tests existants ni `design-ref/`.
