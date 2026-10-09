# Revue UX Mobile — Echo du Ciel Goshen (v3 — Audit d'exhaustivité & Synthèse)
> Document destiné à **Codex** après lecture intégrale du code source de tous les écrans, composants, formulaires, modales, utilitaires Dexie, endpoints API, Service Worker et layout.
> Priorité absolue : **offline-first 100% robuste**, zéro écran d'erreur Chrome / Next.js hors ligne, synchronisation automatique intelligente et discrète lors de la reconnexion internet.

---

## 1. Cartographie Exhaustive de l'Application

### 1.1 Inventaire des Routes & État d'Offline

| Route | Type de Rendu | Source de Données | Statut Hors Ligne | Analyse Critique |
|---|---|---|---|---|
| `/` (accueil) | Client | Dexie (`getSyncStatus`) | ✅ 100% Hors ligne | Shell précaché par le SW, FAB de sync présent uniquement ici. |
| `/pointage` | Client | Dexie (`children`, `attendances`) | ✅ 100% Hors ligne | Carrousel swipe, mode fiche, ajouts enfants, historique. Totalement fonctionnel sans réseau. |
| `/enfants` | Client | Dexie (`children`, `parents`) | ✅ 100% Hors ligne | Filtre dynamique par classe, recherche deferred, consultation & ouverture modale. |
| `/enfants/nouveau` | Client | Dexie (`children`, `parents`) | ✅ 100% Hors ligne | Formulaire direct avec calcul d'âge dynamique et génération UUID local. |
| `/evenements` | Client | Dexie (`events`, `tasks`, `children`) | ✅ 100% Hors ligne | Liste des activités, comptage de tâches terminées, création d'événement locale. |
| `/evenements/[id]` | Client | Dexie (`events`, `tasks`, `children`) | ⚠️ Partiel (Bug suppression) | Affichage & pointage de tâches 100% offline. En revanche, les suppressions de tâches/événements sont perdues (non synchronisées). |
| `/famille` | Client | Dexie (`parents`, `children`) | ✅ 100% Hors ligne (Lecture seule) | Annuaire des parents et fratries. Attention : aucun bouton d'action ou modification directe sur cette page. |
| `/notifications` | Client | Dexie via scan complet `attendances` | ✅ 100% Hors ligne | Alertes maladies et absences prolongées. Action de transfert de classe sans dialogue de confirmation. |
| `/fichiers` | **Server Component** | **Prisma direct (`prisma.mediaResource`)** | ❌ **Rupture totale hors ligne** | Requiert une connexion active vers la BDD SQLite/Turso. Affiche la page fallback `/offline` si pas de réseau. |
| `/dashboard` | Client | `fetch('/api/admin/...')` | ❌ Requiert le réseau | Gestion administrative des comptes moniteurs, logs d'audit et téléversement média. |
| `/login` | Client | NextAuth `signIn('credentials')` | ❌ Requiert le réseau | Authentification serveur. Session cookie / JWT. |
| `/offline` | Client | Navigation statique | ✅ 100% Hors ligne | Écran de secours quand le SW intercepte une route non cachée. Détection réseau via `navigator.onLine` basique. |

---

## 2. Corrections Importantes par rapport aux Analyses Précédentes

1. **Upload photo enfant (`uploadChildPhoto`) — ERREUR PRÉCÉDENTE CORRIGÉE** :
   - *Analyse précédente* : stipulait à tort que l'upload photo dans la fiche enfant requérait internet.
   - *Réalité constatée dans le code (`src/components/pointage/utils.ts` L.123-149)* : Le redimensionnement (400px max) est effectué **100% côté client via un élément `<canvas>` HTML5** et encodé directement en base64 (`canvas.toDataURL("image/jpeg", 0.7)`). **Cette opération fonctionne parfaitement hors ligne** sans aucun appel réseau.
   - *Point de vigilance restant* : la photo en base64 est stockée directement dans IndexedDB et envoyée dans le patch synchronisé. Si la chaîne dépasse 100 Ko (`MAX_SYNC_STRING_VALUE_LENGTH`), elle pourrait être tronquée si non prise en compte par le compresseur de sync.

2. **Validation des dates de naissance** :
   - Sur `/pointage` (ligne 267-273), une validation empêche d'ajouter un enfant né dans le futur (`birthDate > today`).
   - Sur `/enfants/nouveau/page.tsx`, cette vérification n'est pas présente, permettant d'enregistrer des dates de naissance futures.

3. **Performance d'audit des présences (`buildAttendanceHistoryMapAsync`)** :
   - Utilisé dans `/notifications/page.tsx` et dans le composant de push local `PushNotifier.tsx`.
   - Effectue un scan linéaire de toute la table `attendances` triée par date (`db.attendances.orderBy('date').reverse().toArray()`).
   - Au bout de plusieurs mois de cours avec des milliers d'appels, ce scan exécuté toutes les 30 secondes en tâche de fond dans `PushNotifier` peut saturer le thread principal JS des smartphones modestes.

---

## 3. Revue Détaillée Écran par Écran & Composants Clés

### 3.1 `/pointage` — Moteur de présence principal
- **Points forts** :
  - Fluidité extrême grâce à Dexie et `useLiveQuery`.
  - Double index composé `[childId+date]` pour retrouver l'historique instantanément.
  - Détection automatique et association intelligente du parent via son numéro de téléphone normalisé.
  - Sauvegarde locale automatique lors du clic sur PRESENT, SICK ou ABSENT.
- **Faiblesses UX** :
  - **Sensibilité du geste swipe (48px)** : Risque élevé de tourner la page involontairement lors d'un tap imprécis sur un bouton de statut.
  - **Absence de visibilité du statut de sync** : Aucun badge "Enregistré localement - Non envoyé" sur la carte de l'enfant qui vient d'être pointé.
  - **Restriction des dates futures** : La page bloque le pointage des dimanches futurs, ce qui est excellent pour éviter les erreurs de saisie.

### 3.2 `/enfants` & Modale de Fiche Enfant (`ChildDetailsModal`)
- **Édition du parent (`ParentEditor.tsx`)** :
  - Gestion fine des parents "legacy" (anciennes fiches ayant seulement un nom texte sans entité Parent formelle).
  - Suppression d'un parent : stocke l'ID dans `pending-deleted-parents` sous localStorage et tente immédiatement un `fetch('/api/sync')`. Si la machine est offline, la requête échoue mais le localStorage retient la clé.
  - *Problème UX* : Si le parent est supprimé offline, l'erreur réseau est interceptée en silence, mais l'utilisateur n'a aucun retour explicite lui assurant que la suppression se synchronisera dès le retour du Wi-Fi.
- **Historique de présence (`AttendanceHistoryList.tsx`)** :
  - Affichage mois par mois avec carrousel horizontal tactile.
  - Excellent usage de l'index composé `[childId+date]` avec curseur Dexie sans tri en mémoire.

### 3.3 `/evenements` & `/evenements/[id]` — Événements & Tâches
- **Tombstones manquants (Bug critique de synchronisation)** :
  - `deleteTask` (L.130-132 de `EventsTab.tsx` et L.156-161 de `evenements/[id]/page.tsx`) : supprime uniquement la tâche dans Dexie et enlève son entrée de `pendingSync`. **Aucun marqueur de suppression n'est propagé au serveur**.
  - Conséquence : la tâche supprimée hors ligne réapparaîtra automatiquement sur le téléphone dès que le serveur renverra la liste globale lors d'une prochaine synchronisation.
  - Même constat pour la suppression d'un événement complet dans `EventDetailPage`.

### 3.4 `/notifications` & `PushNotifier.tsx`
- **Notifications Web Push Locales** :
  - Déclenchées sans serveur push (pas de VAPID externe nécessaire) : le Service Worker local instancié affiche directement `registration.showNotification` en arrière-plan.
  - Détection automatique : 1) Enfant signalé malade au dernier pointage, 2) Absence prolongée (3 dimanches consécutifs d'absence).
  - *Problème de confirmation UX* : Dans `/notifications/page.tsx`, le bouton "Transférer dans la classe supérieure" applique la mutation instantanément dans Dexie sans modale de confirmation préalable, contrairement à l'archivage qui demande confirmation.

### 3.5 `/famille`
- **Comportement actuel** :
  - Regroupe les enfants par parent (par `parentId` ou nom normalisé).
  - Filtrage des orphelins legacy (`f.children.length > 0 || !f.isLegacy`).
  - *Lacune UX* : Écran 100% en lecture seule. Impossible de corriger le numéro d'un parent ou d'ajouter une note familiale directement depuis cet écran sans passer par la fiche d'un enfant spécifique.

### 3.6 `/fichiers` — Dépendance Serveur Incompatible Hors Ligne
- La page est un Server Component React Next.js :
  ```tsx
  // src/app/fichiers/page.tsx
  const dbFiles = await prisma.mediaResource.findMany({ ... });
  ```
- **Problème** : Lors d'une navigation hors ligne, Next.js ne peut pas exécuter le code serveur. Le Service Worker renvoie alors la page fallback `/offline.html`. L'utilisateur est expulsé de son application pour une page d'erreur.
- **De plus**, le téléversement de médias via `/dashboard` (`/api/admin/upload`) encode le fichier complet sous forme de chaîne base64 data-URI directement dans la colonne SQLite `url`.

---

## 4. Synthèse des Problèmes Détectés (Classés par Gravité)

| Réf | Gravité | Problème Détecté | Fichier(s) Source | Impact Utilisateur |
|---|---|---|---|---|
| **P0-1** | 🔴 Bloquant | **Synchronisation 100% manuelle & locale à l'accueil** | `src/app/page.tsx` (L.103), `SyncPanel.tsx` | Si un moniteur fait l'appel sans retourner sur l'accueil pour cliquer sur le bouton de sync, les données restent isolées sur l'appareil. |
| **P0-2** | 🔴 Bloquant | **Rupture hors ligne sur `/fichiers`** | `src/app/fichiers/page.tsx` | La section "Archives / Ressources" est inaccessible sans réseau. |
| **P0-3** | 🔴 Bloquant | **Perte des suppressions hors ligne (Tâches & Événements)** | `evenements/[id]/page.tsx`, `EventsTab.tsx` | Supprimer une tâche ou un événement hors ligne ne l'efface pas sur le serveur. Il ressuscite à la prochaine sync. |
| **P1-1** | 🟠 Majeur | **Absence d'indicateur réseau & statut de sync persistant** | `layout.tsx`, `pointage/page.tsx` | L'utilisateur ne sait jamais si ses pointages sont arrivés au serveur ou stockés localement. |
| **P1-2** | 🟠 Majeur | **Faux positifs de `navigator.onLine`** | `SyncPanel.tsx`, `offline/page.tsx`, `RegisterPWA.tsx` | Réseau mobile avec 0 data ou portail captif : le navigateur dit "En ligne", mais la sync échoue ou boucle sans fin. |
| **P1-3** | 🟠 Majeur | **Boucle `do...while` infinie potentielle lors de la sync** | `SyncPanel.tsx` (L.113-127) | En cas de réseau instable, la synchronisation par lots peut bloquer l'UI indéfiniment. |
| **P1-4** | 🟠 Majeur | **Expiration de session NextAuth offline pour les Admins** | `evenements/page.tsx`, `evenements/[id]/page.tsx` | Un moniteur admin connecté hors ligne peut perdre subitement ses droits et ses boutons d'action si le cookie expire. |
| **P2-1** | 🟡 Modéré | **Scan global non optimisé dans `PushNotifier` et notifications** | `PushNotifier.tsx`, `utils.ts` | Lecture séquentielle de l'intégralité de la table `attendances` toutes les 30s sur le téléphone. |
| **P2-2** | 🟡 Modéré | **Absence de confirmation sur le transfert de classe** | `src/app/notifications/page.tsx` | Clic involontaire déplace l'enfant d'une classe sans avertissement ni annulation possible. |
| **P2-3** | 🟡 Modéré | **Absence de validation de date de naissance sur `/enfants/nouveau`** | `src/app/enfants/nouveau/page.tsx` | Possibilité d'enregistrer une date de naissance dans le futur (contrairement à `/pointage`). |
| **P2-4** | 🟡 Modéré | **Sensibilité du geste swipe sur le carrousel** | `src/app/pointage/page.tsx` (L.358) | Seuil de 48px trop faible sur les écrans tactiles récents. |
| **P3-1** | 🟢 Mineur | **Écran `/famille` en lecture seule** | `src/app/famille/page.tsx` | Impossibilité de corriger les coordonnées d'un parent depuis cette vue d'ensemble. |
| **P3-2** | 🟢 Mineur | **Ordre d'affichage des enfants par défaut** | `src/app/enfants/page.tsx` | Affichage par `createdAt` décroissant plutôt qu'ordre alphabétique standard. |

---

## 5. Architecture Recommandée & Propositions pour Codex

### 5.1 Orchestration Automatique de la Synchronisation (`useAutoSync`)

Ne plus forcer l'utilisateur à cliquer sur un bouton :
1. **Écouteur d'événement `window.ononline`** combiné à un **ping réel** (`HEAD /api/sync` avec timeout strict de 3 secondes).
2. **Temporisation de stabilisation** : attendre 1,5 à 2 secondes après le retour réseau avant de lancer le flux pour laisser le Wi-Fi / 4G s'établir.
3. **Backoff exponentiel intelligent** en cas d'échec : 5s, 15s, 45s, puis toutes les 2 minutes.
4. **Trigger automatique lors de la mise au premier plan** (`visibilitychange === 'visible'`).

### 5.2 Composant Universel dans `layout.tsx` : `GlobalSyncBar`

Remplacer le panneau flottant isolé sur `/` par un bandeau discret ou un indicateur d'état global intégré au header de l'application :
- **État hors ligne** : Pastille ou bandeau discret : *"Mode hors ligne (N modifications enregistrées sur cet appareil)"*.
- **État synchronisation** : Spinner doux : *"Synchronisation des présences..."*.
- **État synchronisé** : Pastille verte furtive (disparaît après 3s) : *"Tout est à jour"*.
- **État conflit / erreur** : Indication rassurante : *"Vos modifications sont conservées sur le téléphone. Nouvelle tentative dès que la connexion s'améliore."*.

### 5.3 Mécanisme de Tombstones pour les Suppressions

Pour éviter que les tâches et événements supprimés hors ligne ne réapparaissent :
1. Ajouter une table `deletedEntities` dans Dexie (`{ key, entityType, entityId, deletedAt }`).
2. Lors de la suppression locale d'une tâche ou d'un événement, insérer son ID dans `deletedEntities` et marquer un flag de sync.
3. Côté `/api/sync`, ajouter une section `deletions: string[]` qui exécute un `prisma.task.deleteMany({ where: { id: { in: deletedIds } } })`.

### 5.4 Refonte de `/fichiers` en Client Component Offline-Friendly

1. Ajouter la table `mediaResources` dans Dexie.
2. Synchroniser les métadonnées (titre, type d'activité, miniature optimisée ou icône) via `sync-v2`.
3. Les documents lourds (vidéos, PDF volumineux) restent téléchargeables à la demande en ligne, mais la liste et les fiches descriptives restent consultables 100% hors ligne.

---

## 6. Questions & Orientations Soumises à Codex

1. **Format des Médias & Quota de Stockage Mobile** :
   Le stockage de médias en data-URI base64 directement en BDD est pratique mais gonfle IndexedDB sur les téléphones d'entrée de gamme. Codex préconise-t-il de maintenir les données base64 dans Dexie, ou de ne synchroniser que les miniatures vectorielles/compressées avec mise en cache CacheStorage pour les gros fichiers ?

2. **Stratégie de Résolution des Conflits de Pointage** :
   Si deux moniteurs pointent le même enfant sur deux téléphones hors ligne (ex: l'un le met "PRESENT" à 10h05, l'autre "ABSENT" à 10h10) :
   - Faut-il garder la règle simple *Last Write Wins* (le dernier synchronisé l'emporte) ?
   - Ou appliquer une règle métier stricte (ex: le statut "PRESENT" prime toujours sur "ABSENT") ?

3. **Background Sync API vs AutoSync en Foreground** :
   L'API Background Sync (`registration.sync.register`) n'est pas supportée par Safari iOS (WebKit). Faut-il privilégier un moteur JS pur au premier plan (`window.ononline` + `visibilitychange`), ou coupler les deux approches ?
