# Revue & Spécification d'Architecture Mobile Offline-First — Echo du Ciel Goshen
> **Document de cadrage et plan d'implémentation validé** (intégrant l'audit exhaustif du code et la revue d'architecture de Claude).
> **Objectif :** PWA 100% robuste hors ligne, zéro perte de données, synchronisation d'arrière-plan / premier-plan automatique et déterministe.

---

## 1. Diagnostics Confirmés & Nouveaux Angles Morts Identifiés

### 1.1 Faiblesses structurelles confirmées
- **P0-1 : Synchronisation manuelle** confinée au bouton flottant de la page d'accueil.
- **P0-2 : Absence de retour d'état global** sur les écrans de saisie (`/pointage`, `/enfants`, `/evenements`).
- **P0-3 : Rupture hors ligne sur `/fichiers`** (Server Component exécutant directement `prisma.mediaResource.findMany()`).
- **P1-1 : Suppressions non propagées** (absence de tombstones pour les tâches et événements supprimés hors ligne).

### 1.2 Nouveaux points critiques identifiés lors de la revue
1. **L'accueil (`/`) n'est pas un shell client autonome** :
   - `src/app/page.tsx` est un Server Component appelant `getServerSession()`, avec redirection vers `/login` si aucune session active n'est trouvée.
   - *Impact hors ligne* : Si l'utilisateur relance l'application hors ligne et que la session a expiré, l'application bloque sur `/login` (inaccessible sans réseau) au lieu de servir le shell PWA autonome.
2. **Troncature silencieuse des photos en base64** :
   - Dans le moteur de synchronisation, `getSyncStringValue` tronque les chaînes à 100 000 caractères. Une photo base64 capturée via le `<canvas>` dépassant 100 Ko arrive donc corrompue/incomplète sur le serveur.
3. **Absence de méthode `HEAD` sur `/api/sync`** :
   - La route `src/app/api/sync/route.ts` n'exporte actuellement que `POST`. Un ping en `HEAD` renverrait une erreur 405 (Method Not Allowed).
4. **Précision sur la boucle de synchronisation** :
   - Le risque de boucle dans `do...while` provient d'une file (`pendingSync`) qui ne se vide jamais (nouvelles écritures continues ou rejets récurrents d'éléments), plutôt que d'une simple déconnexion isolée.

---

## 2. Principes Directeurs d'Architecture Validés

### 2.1 Découplage Médias vs Données Métier
- **Pas de Base64 dans les patches de données** : IndexedDB conserve les métadonnées et une clé de référence.
- **Outbox Médias Dédiée** : Pour les photos prises hors ligne, stocker temporairement le `Blob` dans un store binaire local (Dexie/IndexedDB) associé à une tâche d'envoi. Ne libérer le Blob local qu'après acquittement explicite du serveur.
- Les fichiers lourds (documents, vidéos) sont stockés sous forme de références d'URLs distantes et mis en cache via `CacheStorage` uniquement à la demande.

### 2.2 Résolution des Conflits de Pointage (Présences)
- **Rejet de la règle « PRESENT prime toujours »** : cette règle arbitraire fausserait les corrections légitimes (ex: un enfant marqué présent par erreur puis corrigé absent).
- **Politique déterministe par métadonnées** :
  - Chaque opération de présence doit inclure : `operationId`, `author/deviceId`, `clientTimestamp` (horodatage local au moment de l'action).
  - Côté serveur : historisation des modifications pour audit et application déterministe (la modification la plus récente en horodatage d'action l'emporte, tout en journalisant les écritures concurrentes).

### 2.3 Moteur d'Auto-Sync au Premier Plan (Foreground First)
- Ne pas reposer uniquement sur l'API `Background Sync` (non supportée sur iOS Safari).
- Le moteur au premier plan s'exécute avec les déclencheurs suivants :
  1. Démarrage de l'application et retour au premier plan (`visibilitychange === 'visible'`).
  2. Rétablissement réseau (`window.addEventListener('online')`), avec un délai de stabilisation de 1,5 à 2 secondes.
  3. Après toute mutation locale, régulé par un debounce (ex: 2 secondes).
- **Garanties** : verrou d'exécution (un seul processus de sync simultané), timeout global de tentative, et backoff exponentiel en cas d'indisponibilité du serveur.

---

## 3. Plan d'Action Priorisé

### Phase 1 — Intégrité & Durabilité des Données Locales
1. **Implémenter une véritable Outbox avec Tombstones** :
   - Créer une table `pendingDeletions` pour les événements et les tâches afin que les suppressions hors ligne soient systématiquement rejouées côté serveur.
2. **Corriger la gestion des photos** :
   - Sortir les chaînes data-URI massives du payload JSON compact de `sync-v2`.
   - Transférer les photos via un endpoint d'upload dédié avec gestion de reprise, puis associer l'URL résultante à la fiche enfant.

### Phase 2 — Orchestration Globale de la Synchronisation
1. **Créer le hook / service central `useAutoSync`** :
   - Déplacer la logique hors de `src/app/page.tsx` pour l'exécuter dans le layout applicatif.
   - Intégrer les déclencheurs (online + stabilisation, focus/foreground, mutation debouncée).
   - Exporter un endpoint léger de santé (ex: `GET /api/sync/health` ou autoriser `HEAD /api/sync`).
   - Mettre en place un verrou (mutex) empêchant les syncs concurrentes et un arrêt propre après N tentatives.

### Phase 3 — Interface Utilisateur & Visibilité d'État (Feedback Global)
1. **Composant universel `GlobalSyncStatus` dans le Layout** :
   - Afficher en permanence et discrètement l'état :
     - *Local uniquement* (ex: "3 modifications enregistrées sur l'appareil").
     - *En cours d'envoi* (spinner discret).
     - *Synchronisé* (acquittement serveur certifié).
     - *En attente de connexion*.
2. **Indicateurs de statut sur les listes et cartes** :
   - Marqueur visuel discret sur les enfants pointés ou modifiés localement n'ayant pas encore reçu de confirmation serveur.

### Phase 4 — Résolution des Ruptures Hors Ligne
1. **Refonte de `/fichiers` en Client Component** :
   - Stocker la liste des ressources dans Dexie (`db.mediaResources`).
   - Servir la page à partir des données locales avec recherche et filtres instantanés.
2. **Autonomie du Shell d'Accueil (`/`)** :
   - Permettre au shell de s'afficher hors ligne même en cas d'absence de rafraîchissement de session serveur, en s'appuyant sur l'état authentifié conservé localement.

### Phase 5 — Ajustements UX & Finitions
1. **Confirmation sur le transfert de classe** (`/notifications`).
2. **Validation stricte de la date de naissance** sur `/enfants/nouveau` (`birthDate <= today`).
3. **Optimisation du carrousel de pointage** : passage du seuil de swipe de 48px à 80px pour éliminer les glissements accidentels.
4. **Optimisation de la requête de notifications** : remplacer le scan global de `attendances` par une sélection ciblée indexée.
