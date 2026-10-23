# Frigo

Assistant local en trois étapes pour les interventions sur fluides frigorigènes. HTML, CSS et modules JavaScript natifs, sans backend, dépendance npm ni compilation.

## Lancer et tester

```sh
python3 -m http.server 8080
```

Ouvrir http://localhost:8080/ et attendre « Disponible hors connexion sur cet appareil ». Le premier chargement nécessite une connexion ; le service worker exige localhost ou HTTPS.

Avec Node.js 22 ou ultérieur :

```sh
node --test
```

Les 14 tests comprennent les six tests d’origine inchangés et huit tests couvrant le document imprimable, le bilan annuel, les variables GraphQL sans `undefined`, la simulation sans réseau, l’absence de jeton, les réponses GraphQL et HTTP et la migration des anciennes fiches. Le transport des tests est injecté et n’appelle aucun service externe.

## Utiliser

1. Dans **Réglages**, enregistrer SIRET, nom, contact, téléphone, email et adresse de l’entreprise. Le jeton TrackDéchets est masqué et peut être affiché. Choisir Bac à sable ou Production ; **Mode simulation** est coché par défaut.
2. Renseigner le détenteur de l’équipement et son adresse, puis marque, modèle, fluide et charge totale. Le numéro de série est facultatif.
3. Choisir le type d’intervention, la date, les poids avant/après et éventuellement la longueur du circuit. La charge récupérée est la différence des poids arrondie à deux décimales.
4. Indiquer le signataire, tracer sa signature et enregistrer. La confirmation et la liste locale proposent les actions suivantes.

- **Exporter en PDF** ouvre un document HTML autonome puis la boîte d’impression du navigateur : choisir l’enregistrement en PDF. Format A4 portrait, marges de 12 mm, mesures en tableau noir et blanc, signature PNG. Il porte la mention « Document de travail généré par Frigo — ne remplace pas le Cerfa officiel signé. »
- **Bilan F-Gas** imprime les interventions de l’année de la fiche choisie, avec date, client, fluide, kg récupérés et totaux. Les fiches de statut `draft` et les fluides inconnus sont exclus. Les statuts d’envoi n’excluent pas les interventions terminées.
- **Créer le brouillon TrackDéchets** simule par défaut et affiche `dry-run` sans réseau ni création de brouillon réel. Le statut local est conservé. Pour envoyer, enregistrer un jeton et décocher la simulation, puis cliquer explicitement sur ce bouton.
- **Sauvegarder la fiche** télécharge son JSON complet, signature et métadonnées comprises.

## TrackDéchets

`js/trackdechets.js` construit uniquement la mutation GraphQL `createDraftBsff(input: BsffInput!) { id }`. Le corps envoyé est `{ query, variables }`, avec `input.type: "BSFF"` et les coordonnées connues de l’émetteur. Les champs inconnus sont omis. Aucun POST REST métier ni création de BSFF complet n’est implémenté. Le bureau complète le brouillon dans TrackDéchets.

Environnements :

- Bac à sable : `https://api.sandbox.trackdechets.beta.gouv.fr`
- Production : `https://api.trackdechets.beta.gouv.fr`

Tout appel métier passe par `sendDraftBsff` avec `fetchImpl` explicitement injecté. L’import des modules, le retour du réseau et la lecture de la file ne déclenchent aucun envoi. Sans jeton en mode réel, une erreur claire apparaît et le statut devient `error`, sans réseau. Les erreurs HTTP, GraphQL et réseau sont remontées. Une réussite persiste `draft-created`, `trackdechetsId`, `sentAt` et efface `lastError`. Le bouton est ensuite désactivé pour cette fiche.

L’ancien utilitaire `toBsffPayload` reste disponible pour compatibilité avec les six tests d’origine ; il n’est utilisé par aucun envoi.

## Stockage et hors ligne

Les interventions sont conservées sous `frigo.interventions.v1`, les réglages sous `frigo.settings.v1`, dans `localStorage`. Une ancienne fiche sans `status` est lue comme `pending`. Les fiches en erreur et les brouillons créés restent disponibles après rechargement. Le premier écran affiche les trois compteurs.

Les données, signatures et le jeton sont stockés localement sans chiffrement. Le stockage dépend du navigateur et de l’origine ; exporter les fiches pour les sauvegarder. Les écritures impossibles sont signalées. Les saisies non enregistrées ne survivent pas au rechargement. L’importation et la suppression des fiches ne sont pas proposés.

`sw.js` met en cache l’application et tous ses modules, y compris `cerfa.js`, `bilan.js`, `trackdechets.js` et `settings.js`. Le cache est `frigo-shell-v3`. L’installation prépare le cache, active le nouveau worker et supprime les anciens caches. Les ressources GET utilisent le cache et les navigations essaient le réseau avec repli sur le document local. Le service worker n’intercepte aucun POST.

## Definition of Done vérifiée

- `node --test` : 14 tests, 0 échec ; les six tests d’origine sont inchangés.
- Chromium headless : parcours des trois étapes avec signature par événements pointeur, persistance des réglages et des fiches, contenu des deux exports et appel de `print()`.
- Observation réseau Chromium : aucune requête lors de la simulation, ni lors de l’essai réel sans jeton ; message explicite et statut `error` persisté.
- Vérification du cache des quatre nouveaux modules et rechargement hors ligne avec fiche et compteur conservés ; aucune exception JavaScript pendant le parcours.
- Aucun marqueur de travail restant ni fonction vide dans le code ajouté ; aucune dépendance npm ; `design-ref/` préservé.

Non vérifiés : création sur les services TrackDéchets réels (aucun jeton utilisé), impression physique, Safari/iOS et Firefox, installation PWA sur appareil et mise à jour entre deux versions déployées. Les documents sont des documents de travail et ne constituent pas un formulaire officiel ou une signature électronique certifiée.
