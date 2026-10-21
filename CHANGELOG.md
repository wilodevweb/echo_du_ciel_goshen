# Changelog

## [0.1.0] — 2026-10-09

### Ajouté
- Création de `android-app/`, application Expo native avec connexion, accueil, appel par classe, stockage local sécurisé et synchronisation différée.
- Ajout du lockfile pnpm de l’application Android après vérification préalable du store local.
- Ajout de `src/app/api/mobile/session/route.ts` pour l’authentification mobile via JWT signé par NextAuth.
- Exclusion de `/api/mobile/session` du middleware web et protection de `/api/sync` par session/JWT.
- Confirmation serveur des seules présences enregistrées et conservation des modifications mobiles plus récentes pendant une synchronisation.
- Documentation de l’architecture et des instructions Android dans `ARCHITECTURE.md`, `README.md` et `android-app/README.md`.

### Fichiers
`android-app/**` (dont `pnpm-lock.yaml`), `src/app/api/mobile/session/route.ts`, `src/app/api/sync/route.ts`, `src/proxy.ts`, `ARCHITECTURE.md`, `README.md`, `CHANGELOG.md`.

### Optimisations et architecture mobile
- Séparation de la couche HTTP (`services/api.ts`), du coordinateur de synchronisation (`services/syncRepository.ts`) et des mutations de présence (`services/attendanceRepository.ts`).
- Sérialisation des pointages locaux et suppression des effets de bord dans l’updater React.
- Protection contre les synchronisations réseau concurrentes.
- Remplacement du rendu complet de la liste d’appel par `FlatList`, index des présences par enfant/date et lignes mémoïsées.
- Mise à jour de `ARCHITECTURE.md` pour refléter ces couches et flux.

### Fichiers
`android-app/src/App.tsx`, `android-app/src/screens/AttendanceScreen.tsx`, `android-app/src/screens/LoginScreen.tsx`, `android-app/src/services/api.ts`, `android-app/src/services/attendanceRepository.ts`, `android-app/src/services/syncRepository.ts`, `ARCHITECTURE.md`, `CHANGELOG.md`.

### Optimisations mobiles supplémentaires
- Ajout d’un état de démarrage pour charger session et cache avant d’afficher la connexion, avec gestion d’échec et nettoyage de l’abonnement réseau.
- Relance d’une passe de synchronisation si un pointage arrive pendant une synchronisation en cours, afin que la file mise à jour ne reste pas en attente.
- Mise à jour de la documentation d’architecture.

### Fichiers
`android-app/src/App.tsx`, `ARCHITECTURE.md`, `CHANGELOG.md`.

### Synchronisation automatique
- Déclenchement de la synchronisation au démarrage, au retour au premier plan, après un pointage et au rétablissement de la connexion.
- Ajout de nouvelles tentatives automatiques avec délais croissants en cas d’indisponibilité du serveur.
- Suppression du bouton manuel de synchronisation; l’accueil affiche l’état de synchronisation et la disponibilité réseau.

### Fichiers
`android-app/src/App.tsx`, `android-app/src/screens/HomeScreen.tsx`, `ARCHITECTURE.md`, `CHANGELOG.md`.

### Interface de synchronisation
- Suppression de la carte d’état qui pouvait ressembler à un bouton; l’état automatique reste visible dans la ligne de connexion.
- Mise à jour du message de classe vide pour expliquer le chargement automatique.

### Fichiers
`android-app/src/screens/HomeScreen.tsx`, `android-app/src/screens/AttendanceScreen.tsx`, `CHANGELOG.md`.

### Couverture fonctionnelle mobile
- Ajout d’écrans natifs de consultation pour l’annuaire et les archives d’enfants, les familles, les événements/tâches et les notifications d’absence.
- Ajout d’une route média mobile protégée par JWT, d’un écran d’archives avec recherche/filtres et ouverture des ressources.
- Extension du cache issu de `sync-v2` pour conserver familles, événements et tâches sur l’appareil.
- Documentation du périmètre mobile et des fonctions qui restent accessibles uniquement sur le web.

### Fichiers
`android-app/src/App.tsx`, `android-app/src/types.ts`, `android-app/src/services/api.ts`, `android-app/src/services/storage.ts`, `android-app/src/services/syncRepository.ts`, `android-app/src/screens/ChildrenScreen.tsx`, `android-app/src/screens/EventsScreen.tsx`, `android-app/src/screens/FamiliesScreen.tsx`, `android-app/src/screens/NotificationsScreen.tsx`, `android-app/src/screens/ResourcesScreen.tsx`, `src/app/api/mobile/resources/route.ts`, `src/proxy.ts`, `ARCHITECTURE.md`, `CHANGELOG.md`.

### Parité web/mobile — 2026-10-10
- Ajout des formulaires mobiles de création/modification/archivage des enfants, de création d’événements et d’assignation/validation des tâches; mise en file locale et synchronisation automatique.
- Reproduction des notifications web (anniversaires, absences prolongées, maladies, profils incomplets) et des actions admin de transfert/archivage.
- Ajout de l’administration mobile protégée par rôle (liste, création et blocage/déblocage des comptes, journaux d’activité) et du téléversement média via DocumentPicker.
- Alignement des écrans sur les couleurs et cartes du site; adoption de SafeAreaContext et de la version NetInfo attendue par Expo.
- Suppressions définitives de comptes, événements et tâches restent désactivées; le garde-fou automatique a refusé une route qui incluait une suppression irréversible de compte sans confirmation dédiée.

### Fichiers
`android-app/package.json`, `android-app/pnpm-lock.yaml`, `android-app/src/**`, `src/app/api/mobile/admin/route.ts`, `src/app/api/mobile/upload/route.ts`, `src/app/api/admin/upload/route.ts`, `src/proxy.ts`, `ARCHITECTURE.md`, `README.md`, `android-app/README.md`, `CHANGELOG.md`.

### Auto-sync web et confort hors ligne — 2026-10-10
- Remplacement du bouton de synchronisation de l’accueil par un hook global avec déclencheurs au premier plan, verrou de concurrence, timeout, lots bornés et nouvelles tentatives progressives.
- Ajout d’un indicateur global hors ligne / modifications en attente / synchronisation, branché sur la file de modifications et les tombstones.
- Protection des acquittements contre les modifications concurrentes reçues pendant un transfert.
- Refonte de `/fichiers` en page client : liste et métadonnées conservées dans Dexie, filtrage local et chargement distant opportuniste.
- Ajout des indicateurs locaux sur les pointages et les fiches enfants, d’une confirmation de transfert de classe et du contrôle des dates de naissance futures ; seuil de swipe relevé à 80 px.
- Extraction de la maintenance locale ponctuelle auparavant embarquée dans `SyncPanel`.
- Ajout d’un shell statique pré-caché servi uniquement si la navigation d’accueil échoue faute de réseau ; les redirections d’authentification reçues du serveur restent prioritaires.

### Fichiers
`src/hooks/useAutoSync.ts`, `src/components/system/GlobalSyncBar.tsx`, `src/components/system/LocalDataCleanup.tsx`, `src/components/system/SyncPanel.tsx`, `src/app/layout.tsx`, `src/app/page.tsx`, `public/sw.js`, `public/offline-shell.html`, `src/app/fichiers/page.tsx`, `src/app/pointage/page.tsx`, `src/components/pointage/PointageCard.tsx`, `src/app/enfants/page.tsx`, `src/app/enfants/nouveau/page.tsx`, `src/app/notifications/page.tsx`, `src/lib/db.ts`, `TASKS_COORDINATION.md`, `ARCHITECTURE.md`, `CHANGELOG.md`.

### Accès aux ressources web
- La route des ressources accepte la session NextAuth du site et le JWT mobile, afin que la page web `/fichiers` puisse alimenter son cache Dexie.
- Le rafraîchissement des ressources fusionne les métadonnées reçues sans effacer les copies locales en cas de liste distante vide.

### Fichiers
`src/app/api/mobile/resources/route.ts`, `src/app/fichiers/page.tsx`, `ARCHITECTURE.md`, `CHANGELOG.md`.

### Synchronisation initiale web — 2026-10-11
- L’auto-sync démarre une passe après confirmation de la session NextAuth, y compris lorsqu’aucune modification locale n’attend dans la file.
- Les tentatives automatiques sont maintenant réservées aux sessions authentifiées; les déclencheurs réseau et de retour au premier plan restent actifs.

### Fichiers
`src/hooks/useAutoSync.ts`, `CHANGELOG.md`.

### Résolution des conflits de pointage — 2026-10-11
- Les pointages web et mobiles transmettent leur horodatage d’action dans le protocole compact; le serveur applique le plus récent et garde le pointage serveur en cas d’égalité.
- Ajout de `Attendance.updatedAt` comme curseur serveur indépendant de l’heure de l’action, pour propager aussi les pointages créés hors ligne après une synchronisation antérieure.
- Les clients reçoivent la valeur canonique des pointages envoyés, y compris lorsqu’une mutation plus ancienne perd le conflit.
- Une correction locale créée pendant une requête reste en attente et n’est pas écrasée par le delta reçu.
- Les versions Expo antérieures restent compatibles grâce à l’horodatage serveur de réception lorsque le champ client manque.

### Fichiers
`prisma/schema.prisma`, `prisma/migrations/20261011000000_attendance_updated_at/migration.sql`, `src/lib/db.ts`, `src/app/pointage/page.tsx`, `src/app/api/sync/route.ts`, `android-app/src/types.ts`, `android-app/src/services/syncRepository.ts`, `android-app/src/services/attendanceRepository.ts`, `ARCHITECTURE.md`, `CHANGELOG.md`.


### Correctifs de cohérence de synchronisation — 2026-10-11
- Le client web inclut ses identifiants d’enfants et clés de présences connus dans les lots; cela évite de renvoyer toutes les présences déjà présentes à chaque synchronisation et permet de récupérer les enregistrements manquants.
- L’application d’un delta ne supprime plus les enfants, événements ou tâches encore présents dans la file locale lorsque le serveur ne les connaît pas encore; les suppressions explicites du serveur restent appliquées une fois la file locale acquittée.
- Une modification qui dépasse la taille de lot ne fait plus supprimer son entrée de la file locale; le client signale le problème et conserve les données pour une reprise après correction.

### Fichiers
`src/lib/db.ts`, `ARCHITECTURE.md`, `CHANGELOG.md`.


### Fiabilité et coût de la synchronisation — 2026-10-11
- Suppression atomique des tâches et événements avec leurs tombstones pour fermer la fenêtre de perte en cas d’arrêt de l’application.
- Construction des clés de présences depuis l’index Dexie au lieu de charger tous les objets de présence en mémoire à chaque passage.
- Annulation des minuteries `online` et `visibilitychange` lorsque le hook d’auto-sync se démonte.

### Fichiers
`src/lib/db.ts`, `src/app/evenements/[id]/page.tsx`, `src/components/children/ChildDetailsModal/EventsTab.tsx`, `src/hooks/useAutoSync.ts`, `ARCHITECTURE.md`, `CHANGELOG.md`.

### Alertes mobiles et lisibilité — 2026-10-11
- Centralisation du calcul des alertes mobiles; le badge d’accueil compte les enfants concernés dans les mêmes catégories que l’écran Notifications.
- Limitation des absences prolongées à trois appels hebdomadaires consécutifs et récents; les signalements maladie anciens ne restent plus actifs indéfiniment.
- Affichage des dates et du contexte des absences, maladies et anniversaires; gestion visible des erreurs et de l’enregistrement des actions admin.

### Fichiers
android-app/src/notifications.ts, android-app/src/App.tsx, android-app/src/screens/NotificationsScreen.tsx, ARCHITECTURE.md, CHANGELOG.md.

### Annuaire mobile — photos et noms — 2026-10-11
- Affichage des photos des enfants dans des avatars parfaitement circulaires, avec initiale de secours si la photo manque ou ne charge pas.
- Formatage des noms dans l’annuaire : NOM POSTNOM Prénom.

### Fichiers
android-app/src/screens/ChildrenScreen.tsx, CHANGELOG.md.

### Annuaire des familles — regroupement et libellés — 2026-10-11
- Regroupement des enfants par responsable ou téléphone normalisé, avec nom de famille déduit du nom de l’enfant lorsque le responsable n’est pas renseigné.
- Masquage des fiches responsables vides, tri des familles et des enfants, recherche par nom/téléphone/enfant et compte des enfants visibles.

### Fichiers
android-app/src/screens/FamiliesScreen.tsx, CHANGELOG.md.

### Attribution de tâches mobile en lot — 2026-10-11
- L’attribution à plusieurs enfants écrit toutes les tâches ensemble et met leurs identifiants en file en une opération.
- Une seule synchronisation est demandée pour le lot; l’écran bloque les doubles soumissions et affiche les erreurs d’enregistrement.

### Fichiers
android-app/src/screens/EventsScreen.tsx, android-app/src/App.tsx, android-app/src/services/storage.ts, ARCHITECTURE.md, CHANGELOG.md.

### Accueil mobile — maquette « Enfants » — 2026-10-11
- Remplacement du tableau de bord clair par l’accueil sombre de la maquette, avec l’effectif local et la liste des enfants.
- La rangée des boutons devient sticky quand elle atteint le haut de l’écran; le titre et le reste de l’en-tête continuent de défiler.
- Ajout de la recherche, du filtre par classe, d’un accès direct à la création et à la fiche d’un enfant, et maintien du pointage, des notifications, du profil et des sections secondaires.
- Affichage des photos dans des cercles, des initiales colorées en secours et des noms au format NOM POSTNOM Prénom.
- Ajout de transitions natives légères à l’apparition de la barre sticky, des panneaux et des premières lignes, avec retour tactile animé sur les boutons.
- Ajout d’un effacement direct de la recherche, de messages vides adaptés au filtre/réseau et d’un retour en haut si recherche ou menu sont ouverts depuis la barre sticky.
- Désactivation du détachement des lignes hors écran, qui pouvait faire disparaître des enfants avec leurs animations; ajout d’espace en bas pour dégager la dernière ligne du bouton flottant et d’icônes système claires sur fond sombre.
- Adaptation de la taille des six boutons à la largeur disponible pour éviter leur débordement sur les petits téléphones.
- Indication discrète de l’état réseau et de la synchronisation automatique; aucun paquet d’icônes supplémentaire n’est requis.

### Fichiers
android-app/src/screens/HomeScreen.tsx, android-app/src/screens/ChildrenScreen.tsx, android-app/src/App.tsx, ARCHITECTURE.md, CHANGELOG.md.
