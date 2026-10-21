# SPEC — Frigo · assistant Cerfa 15497 hors ligne (PWA statique)

## Contexte
Technicien frigoriste en intervention (chantier, sous-sol, chambre froide) : pas de réseau, des gants, du soleil sur l'écran. Il doit produire un Cerfa 15497 (fiche d'intervention fluides frigorigènes) signé par le client, puis transmettre un BSFF à TrackDéchets au retour du réseau.

Ce dépôt livre **uniquement le client** : formulaire 3 étapes, capture de signature, stockage local, file d'envoi, export. Aucune connexion à TrackDéchets dans cette version (jeton client requis, à brancher plus tard) ; on prépare seulement la charge utile JSON au format attendu.

## Contraintes techniques
- **Aucune dépendance externe, aucun build** : HTML + CSS + JavaScript ES modules natifs, servi tel quel.
- Cible : mobile 390×844, utilisable à une main, avec gants.
- **Fonctionne hors ligne après la première visite** (service worker, cache app shell).
- Persistance : `localStorage` (pas d'IndexedDB, inutile ici), clé `frigo.interventions.v1`.
- Accessibilité : libellés ≥ 18 px, cibles tactiles ≥ 48 px, contraste ≥ 4,5:1, focus visible, `aria-label` sur les boutons icônes.
- Aucun framework, aucun CDN, aucune police distante (polices système uniquement).

## Écrans
1. **Équipement** : Marque, Modèle, Numéro de série, Fluide (radio exclusif : R32 | R410A), Charge totale en kg (numérique, pas de 0,1, boutons − / + et saisie directe). Bouton unique « Suivant ». Barre « Étape 1 sur 3 ». Bandeau « Hors connexion » quand `navigator.onLine === false`.
2. **Intervention** : Type d'opération (radio : Mise en service | Maintenance | Démontage), Date (préremplie), Poids bouteille avant (kg), Poids bouteille après (kg), champ calculé **Charge récupérée = avant − après** (lecture seule, 2 décimales), Longueur de circuit (m, optionnel). Boutons « Retour » et « Suivant ».
3. **Signature & enregistrement** : zone de signature au doigt/souris sur `<canvas>` (pointer events, lissage simple), bouton « Effacer », nom du signataire (texte), récapitulatif en lecture seule des champs saisis, bouton principal « Signer et enregistrer », puis écran de confirmation avec « Nouvelle intervention ».

## Règles métier (à couvrir par des tests)
- Champs obligatoires : marque, modèle, fluide, charge totale > 0 ; étape 2 : type d'opération, poids avant > 0, poids après ≥ 0, poids après ≤ poids avant.
- `chargeRecuperee = poidsAvant - poidsApres`, arrondi à 2 décimales, jamais négatif (validation en amont).
- Une intervention enregistrée porte : `id` (uuid v4 via `crypto.randomUUID()`), `createdAt` ISO, les champs des 3 étapes, `signatureDataUrl` (PNG data URL), `status: "pending"`.
- La file se relit au démarrage (`loadQueue()`), tolère un JSON corrompu (retourne `[]` sans jeter).
- Export : `toBsffPayload(intervention)` produit un objet JSON stable, sans champs `undefined`.
- `toPrintableHtml(intervention)` produit une chaîne HTML autonome (styles inline) reprenant les champs + l'image de signature, avec la mention « Document de travail — ne remplace pas le Cerfa officiel signé ».

## Tests exigés
`node --test` (aucune dépendance) sur les fonctions pures, dans `tests/` :
1. validation étape 1 : refus si charge ≤ 0, si fluide absent ;
2. validation étape 2 : refus si poids après > poids avant ;
3. arrondi de `chargeRecuperee` (ex. 12,34 − 4,10 = 8,24) ;
4. `loadQueue()` sur JSON corrompu → `[]` ;
5. `toBsffPayload()` ne contient aucune valeur `undefined` ;
6. `toPrintableHtml()` contient le nom du signataire et l'image de signature.

Le code testé doit être dans des modules importables (`js/model.js`), pas dans des gestionnaires d'événements.

## Livrables attendus
```
index.html            # les 3 étapes dans un seul document, affichage piloté par l'état
js/model.js           # fonctions pures : validation, calculs, sérialisation, export
js/app.js             # DOM, navigation, canvas, localStorage
js/sw.js              # service worker : cache app shell, mise à jour propre
manifest.webmanifest  # nom, icônes générées en SVG inline data URI, display standalone
tests/model.test.js   # les 6 tests ci-dessus
README.md             # comment lancer (python3 -m http.server 8080), ce qui n'est PAS fait
```

## Definition of Done
- `node --test` passe (6 tests, 0 échec).
- `python3 -m http.server` sert l'app ; saisie complète des 3 étapes possible sans réseau après un premier chargement.
- Après « Signer et enregistrer » puis rechargement de la page, l'intervention est toujours dans `localStorage` et visible en bas de l'écran 1 (« 1 intervention en attente »).
- Aucune erreur console au chargement.
- Le code ne contient ni `TODO` ni fonction vide.

## Interdits
- Pas de backend, pas d'appel réseau applicatif, pas de dépendance npm.
- Ne pas prétendre produire un Cerfa officiel : le document exporté est un document de travail.
- Ne pas modifier `design/` (référence visuelle uniquement).
