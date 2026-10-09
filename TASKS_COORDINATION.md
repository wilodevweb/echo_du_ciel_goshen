# Plan de Répartition des Tâches — Echo du Ciel Goshen
> **Document de coordination & partage des tâches entre les agents d'implémentation (Antigravity & Codex).**
> Priorité : architecture **Offline-First**, intégrité des données, zéro rupture hors ligne et synchronisation automatique déterministe.

---

## 🎯 Vue d'ensemble de la répartition

- **Agent A (Antigravity) :** Couche Données, Base locale Dexie, Protocole de Sync, Endpoints API & Sécurité des modèles.
- **Agent B (Codex) :** Couche Client, UX/UI réactive, Gestion des composants d'état, Feedback visuel et refonte des pages hors ligne.

---

## 📋 Tableau de Bord des Tâches

| ID | Domaine | Intitulé de la Tâche | Agent Assigné | Dépendances | Statut |
|---|---|---|:---:|---|:---:|
| **T01** | Data / Dexie | **Tombstones de suppression (Tâches & Événements)**<br>Ajout table `pendingDeletions` dans Dexie et migration schéma. | **Antigravity** | - | ✅ Implémenté |
| **T02** | API / Sync | **Support des Tombstones côté Serveur (`/api/sync`)**<br>Traitement de la suppression persistante d'événements et tâches avec soft-delete / cascades. | **Antigravity** | T01 | ✅ Implémenté |
| **T03** | Data / Médias | **Outbox Médias & fin de la troncature Base64**<br>Découpler les photos des patches de sync. Créer une table `mediaOutbox` pour les blobs binaires locaux. | **Antigravity** | - | ⏳ À faire |
| **T04** | API / Médias | **Endpoint dédié d'upload avec acquittement**<br>Créer ou consolider `/api/upload/child-photo` pour uploader les blobs séparément et renvoyer l'URL finale. | **Antigravity** | T03 | ⏳ À faire |
| **T05** | API / Route | **Route de santé dédiée pour la connectivité**<br>Ajouter le support `HEAD /api/sync` ou route `GET /api/sync/health` légère pour valider le réseau réel. | **Antigravity** | - | ✅ Implémenté |
| **T06** | Data / Dexie | **Table `mediaResources` dans Dexie**<br>Préparer le schéma local pour stocker les métadonnées des ressources/archives hors ligne. | **Antigravity** | - | ✅ Implémenté |
| **T07** | Client / Hook | **Moteur `useAutoSync` au Premier Plan**<br>Création du hook universel avec verrou d'exécution (mutex), backoff exponentiel, déclencheurs `online` (+1.5s) et `visibilitychange`. | **Codex** | La requête de sync authentifiée fait foi ; T05 reste utile mais n'est pas bloquant. | ✅ Implémenté |
| **T08** | Client / UI | **Composant universel `GlobalSyncBar` dans `layout.tsx`**<br>Bandeau/pastille discret indiquant l'état en direct : hors ligne, modifications en attente, sync en cours, tout à jour. | **Codex** | T07 | ✅ Implémenté |
| **T09** | Client / Refonte | **Refonte de `/fichiers` en Client Component**<br>Remplacer le Server Component Prisma par une vue Dexie offline-first branchée sur `useLiveQuery`. | **Codex** | T06 | ✅ Implémenté (métadonnées et liste hors ligne) |
| **T10** | Client / Auth | **Sécurisation du Shell d'Accueil (`/`) hors ligne**<br>Adapter le repli PWA de `/` sans contourner l'authentification serveur. | **Codex** | - | ✅ Implémenté (shell statique hors ligne ; session serveur inchangée) |
| **T11** | Client / UX | **Affichage des statuts locaux sur les cartes & listes**<br>Ajout d'une discrète puce "En attente de sync" sur les enfants pointés ou modifiés localement. | **Codex** | T07 | ✅ Implémenté |
| **T12** | Client / UX | **Ajustements ergonomiques fins**<br>1. Seuil de swipe du carrousel à 80px (au lieu de 48px).<br>2. Dialogue de confirmation pour transfert de classe (`/notifications`).<br>3. Contrôle de date future sur `/enfants/nouveau`. | **Codex** | - | ✅ Implémenté |
| **T13** | Data / Perf | **Optimisation du scan d'historique dans `PushNotifier`**<br>Remplacer le scan complet de la table `attendances` par une requête ciblée sur les 4 dernières semaines. | **Antigravity** | - | ✅ Implémenté |

---

## 🛠️ Détail des Lots de Travail

### Lot 1 : Données, Tombstones & Stockage Médias (Antigravity)
- **T01** : Dans `src/lib/db.ts`, créer une nouvelle version Dexie ajoutant la table `pendingDeletions: "id, entityType, deletedAt"`. Adapter `deleteTask` et `deleteEvent` pour insérer dans cette table au lieu d'une suppression locale muette.
- **T02** : Dans `src/app/api/sync/route.ts`, accepter le tableau `deletions: Array<{ id: string, entity: 'task' | 'event' }>` et appliquer la suppression en base Prisma.
- **T03** : Supprimer le passage de photos data-URI dans `getSyncStringValue`. Créer un magasin local `mediaOutbox` pour conserver l'image brute jusqu'à téléversement effectif.
- **T04** : Créer l'endpoint permettant au client de vider sa file `mediaOutbox` une fois le réseau disponible, et retourner une URL sécurisée.

### Lot 2 : Moteur d'Auto-Sync & Interface Globale (Codex)
- **T07** : Implémenter `src/hooks/useAutoSync.ts`. Ce hook centralise les tentatives de synchronisation, s'assure qu'une seule requête de synchronisation tourne à la fois, applique un timeout global et debouncre après chaque mutation locale.
- **T08** : Intégrer `GlobalSyncBar` dans `src/app/layout.tsx`. Supprimer le `SyncPanel` isolé de `src/app/page.tsx` et offrir un retour visuel permanent mais non intrusif sur l'ensemble des écrans.
- **T09** : Réécrire `src/app/fichiers/page.tsx` en `use client` s'appuyant sur `useLiveQuery(() => db.mediaResources.toArray())`.
- **T10** : Servir `public/offline-shell.html` uniquement si une navigation `/` échoue faute de réseau ; conserver la protection et les redirections du serveur lorsqu’il répond.

### Lot 3 : Confort UX, Performance & Polissage (Conjoint)
- **T11 & T12 (Codex)** : Calibrage tactile, modales de confirmation manquantes et indicateurs d'attente sur les cartes d'enfants.
- **T13 (Antigravity)** : Optimisation des requêtes d'historique dans `PushNotifier.tsx` pour préserver le CPU et la batterie des terminaux mobiles.
