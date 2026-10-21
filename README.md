# Frigo

Assistant local en trois étapes pour une fiche d’intervention de fluides frigorigènes. HTML, CSS et modules JavaScript natifs, sans dépendance, sans compilation, sans police distante.

## Lancer

Depuis la racine du dépôt :

```sh
python3 -m http.server 8080
```

Ouvrir **http://localhost:8080/**. Attendre « Disponible hors connexion sur cet appareil » avant de couper le réseau. Un premier chargement connecté est nécessaire. Le service worker exige localhost ou HTTPS : pour un téléphone accédant à une autre machine, un simple serveur HTTP sur le réseau local ne suffit pas.

Aucune installation npm n’est nécessaire. Node.js 22 ou ultérieur permet de lancer les tests :

```sh
node --test
```

Les six tests couvrent les validations des étapes 1 et 2, le calcul arrondi, le stockage corrompu et la persistance, la stabilité du JSON BSFF et le document HTML signé (avec échappement des textes).

## Utiliser et exporter

1. Renseigner marque, modèle, fluide et charge totale strictement positive. Le numéro de série est facultatif ; les boutons − et + modifient la charge de 0,1 kg.
2. Choisir l’opération, vérifier la date locale préremplie et renseigner les poids. La charge récupérée correspond à avant − après, avec deux décimales. La longueur de circuit est facultative.
3. Indiquer le nom, tracer la signature au doigt, au stylet ou à la souris, vérifier le récapitulatif, puis choisir « Signer et enregistrer ».
4. Après confirmation, commencer une nouvelle intervention. Les fiches en attente figurent en bas du premier écran et restent présentes après rechargement.

Chaque fiche propose trois téléchargements utilisables hors ligne :

- **Exporter JSON BSFF** : sous-ensemble de `BsffInput` contenant le type `COLLECTE_PETITES_QUANTITES`, la description du fluide et le poids récupéré en kilogrammes. Les clés et les valeurs sont déterministes et sans `undefined`.
- **Document imprimable** : fichier HTML autonome contenant tous les champs, la référence, la date d’enregistrement et la signature PNG. Ouvrir le fichier téléchargé dans un navigateur puis utiliser sa commande Imprimer, éventuellement vers PDF. Il porte la mention « Document de travail — ne remplace pas le Cerfa officiel signé ».
- **Sauvegarder la fiche** : JSON complet comprenant identifiant UUID v4, horodatage ISO, données saisies, signature PNG et statut `pending`.

Le JSON BSFF suit les champs documentés dans la [référence officielle BsffInput de TrackDéchets](https://developers.trackdechets.beta.gouv.fr/reference/api-reference/bsff/inputObjects#bsffinput). Il reste **incomplet pour une transmission** : le formulaire ne collecte pas les acteurs (SIRET, coordonnées de l’émetteur, du transporteur, du destinataire), la classification du déchet, les références des bouteilles ou les identifiants TrackDéchets des fiches d’intervention. Ces informations ne sont pas inventées. Le JSON complet de la fiche conserve les informations locales pour une future intégration.

## Stockage et fonctionnement hors ligne

Les fiches sont enregistrées dans `localStorage`, sous la clé `frigo.interventions.v1`. Un JSON illisible est toléré et donne une file vide. Les erreurs d’écriture sont signalées sans confirmer un enregistrement ni effacer le formulaire. La signature reste disponible pour une nouvelle tentative tant que la page reste ouverte. Les saisies non enregistrées ne survivent pas au rechargement.

Le stockage appartient au navigateur et à l’origine (protocole, hôte et port). Le vider ou utiliser un autre appareil ne permet pas de retrouver les fiches. Exporter régulièrement les fiches complètes pour les sauvegarder. Les données et signatures ne sont pas chiffrées par l’application.

Le cache contient uniquement l’app shell. `sw.js`, à la racine, charge `js/sw.js` : ce lanceur est nécessaire pour contrôler toute l’application sans en-tête HTTP spécial avec `python3 -m http.server`. Le service worker ne traite que les ressources statiques de cette application. Pour déployer une nouvelle version, incrémenter `CACHE_NAME` dans `js/sw.js` ; l’installation prépare le nouveau cache complet, attend la fermeture des anciens onglets, puis supprime les anciens caches Frigo lors de l’activation. Aucun rechargement forcé ne coupe une saisie en cours.

## Ce qui n’est pas fait

- Aucun backend, compte, jeton, appel API TrackDéchets, envoi automatique ou synchronisation entre appareils. Le retour du réseau masque le bandeau hors connexion mais laisse les fiches en attente.
- Aucun Cerfa officiel rempli ou PDF réglementaire, aucune signature électronique certifiée, aucune validation juridique du document de travail.
- Aucune importation des sauvegardes et aucune suppression des fiches dans l’interface.
- Aucun enregistrement automatique des brouillons.

## Definition of Done — vérification

Vérifications effectuées avec Node.js 26.7.0 et Chromium 155 en mode headless :

- [x] `node --test` : six tests, six réussites, zéro échec.
- [x] Application servie par `python3 -m http.server 8080` ; premier chargement, installation du cache, rechargement avec réseau désactivé, puis parcours complet des trois étapes et signature avec de véritables événements pointeur. Vérification à 390 × 844, sans débordement horizontal.
- [x] Enregistrement signé dans `frigo.interventions.v1`, puis rechargement hors ligne : fiche conservée et « 1 intervention en attente » visible sur le premier écran.
- [x] Aucune erreur console ni exception JavaScript au chargement ou pendant ce parcours. Refus de stockage simulé : erreur affichée, saisie conservée, aucune confirmation trompeuse.
- [x] Code inspecté : aucun marqueur de travail restant ni fonction vide. `design-ref/` et `design/` n’ont pas été modifiés.

Les contrôles de saisie et boutons ont au moins 52 px de hauteur, les libellés principaux 18 px, les couleurs de texte sont contrastées et le focus est visible. Les boutons d’incrémentation portent un nom accessible.

Restent à vérifier sur matériel réel : installation PWA selon le navigateur, Safari/iOS et Firefox, signature tactile avec gants, lisibilité au soleil, audit complet au lecteur d’écran, impression physique et cycle de mise à jour entre deux versions déployées. Le fonctionnement hors ligne et la persistance ont été vérifiés dans Chromium, pas sur ces autres environnements.
