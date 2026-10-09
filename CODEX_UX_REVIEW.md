# Revue UX Mobile — Echo du Ciel Goshen (v2 — Analyse approfondie)
> Document destiné à Codex après lecture exhaustive de tous les écrans, composants, Service Worker et couche de données.
> Priorité absolue : **offline-first** avec sync automatique à la détection réseau, UX optimisée.

---

## 1. Cartographie réelle de l'application

### 1.1 Écrans et leur rapport à l'offline

| Route | Rendu | Source de données | Fonctionne hors ligne ? |
|---|---|---|---|
| `/` (accueil) | Client | — | ✅ Oui (SW précache) |
| `/pointage` | Client | Dexie (`children`, `attendances`) | ✅ Oui, 100 % |
| `/enfants` | Client | Dexie (`children`) | ✅ Oui, 100 % |
| `/enfants/nouveau` | Client | Dexie | ✅ Oui |
| `/evenements` | Client | Dexie (`events`, `tasks`) | ✅ Oui, 100 % |
| `/evenements/[id]` | Client | Dexie (`events`, `tasks`, `children`) | ✅ Oui, 100 % |
| `/fichiers` | **Server Component** | **Prisma direct** | ❌ Non — requiert réseau |
| `/famille` | Inconnu | Inconnu | ? |
| `/dashboard` | Client | **fetch `/api/admin/users`** | ❌ Non |
| `/login` | Client | **fetch `/api/auth`** | ❌ Non |
| `/notifications` | Inconnu | Inconnu | ? |

> **Découverte critique** : `/fichiers` est un **Server Component** qui appelle `prisma.mediaResource.findMany()` directement. Cette page est **impossible à rendre hors ligne**, quoi que fasse le Service Worker. Si un moniteur navigue vers "Archives" sans connexion, il verra la page `/offline` au lieu du contenu.

### 1.2 Flux de données par entité

```
Children / Parents / Attendances / Events / Tasks
  ↓ écriture immédiate dans Dexie (offline OK)
  ↓ markEntityForSync() → table pendingSync
  ↓ [MANUEL : bouton FAB sur /] → syncWithServer()
  ↓ POST /api/sync (mode sync-v2, compact patches)
  ↓ Prisma → Turso/SQLite
```

### 1.3 Service Worker — ce qu'il fait vraiment

```
Install  → précache 16 URLs statiques (pages HTML + icônes + logo)
Activate → purge des anciens caches
Fetch    → GET sur /api/* : PASS-THROUGH (pas de cache)
         → Navigation (mode=navigate) : stale-while-revalidate avec timeout 2.5s
         → Assets /_next/, /static/, images : cache-first
Message  → SKIP_WAITING : active le nouveau SW
         → REFRESH_PRECACHE : re-fetch les 16 URLs précachées
```

**Ce que le SW ne fait pas** :
- Pas de Background Sync API
- Pas de mise en cache des données dynamiques (API)
- Pas d'interception des POST → la sync de données repose entièrement sur Dexie + JS

---

## 2. Analyse approfondie par écran

### 2.1 `/pointage` — L'écran central

**Ce qui fonctionne bien :**
- Carrousel tactile (swipe) avec index de position (`visibleIndex + 1 / totalCards`)
- `setAttendanceStatus` : vérifie si le statut a changé avant d'écrire (évite les sync inutiles)
- Ajout d'enfant : crée aussi automatiquement une présence PRESENT pour la date courante
- Détection de doublons de téléphone parent lors de l'ajout (`db.children.where('parentPhone').equals(phone)`)
- `getAttendanceStatus` : normalise le statut qu'il vienne de `status` ou de `present`

**Ce qui manque :**
- **Aucun indicateur offline** : le moniteur sur `/pointage` ne sait pas s'il est connecté. Il coche les présences en espérant qu'elles partiront. Rien ne lui dit "3 modifications en attente d'envoi".
- **La date est libre** : on peut pointer sur n'importe quel dimanche passé. Le seul garde-fou est `selectedDate > maxSunday`. Aucun avertissement visuel si on change de date après avoir déjà pointé.
- **Swipe trop sensible** : seuil à 48px (`Math.abs(deltaX) < 48`). Sur un clic mal positionné ou une légère vibration, on peut sauter une carte.
- **La carte "Ajouter un enfant" (mode=add) appelle `uploadChildPhoto`** côté client. Cette fonction doit requérir le réseau. Si offline, l'upload de photo échouera silencieusement (l'erreur est catchée et affichée en `alert`, mais le champ `photoUrl` restera vide).

### 2.2 `/enfants` — Annuaire

**Ce qui fonctionne bien :**
- Header collapsé au scroll avec effet glassmorphism
- `useDeferredValue` pour la recherche — ne bloque pas l'UI
- Archivage via `notes?.includes('[ARCHIVE]')` — simple et efficace
- Détection du paramètre URL `?newChildId` pour ouvrir la fiche après création

**Ce qui manque :**
- **Pas d'indicateur de mutation locale** : une fiche modifiée offline et non encore synchro est identique visuellement à une fiche synchro. Le moniteur ne sait pas si ses modifications ont bien été transmises.
- **La suppression via `ChildDetailsModal` (noms vides) est irréversible** et non confirmée dans l'annuaire — seule la modal de détails gère la logique de suppression.
- **Pas de FAB sync** sur cette page. Si un moniteur crée 5 enfants depuis `/enfants`, il doit revenir sur `/` pour synchro.
- **`orderBy('createdAt').reverse()`** : les nouveaux enfants apparaissent en tête. Logique pour voir ses ajouts récents, mais contre-intuitif pour chercher par nom. L'ordre alphabétique serait préférable quand on ne cherche pas.

### 2.3 `/evenements` et `/evenements/[id]`

**Ce qui fonctionne bien :**
- Création d'événement : `markEntityForSync('event', event.id)` — offline OK
- Ajout de tâches en bulk : `bulkAdd` + boucle `markEntityForSync` — offline OK
- Toggle de tâche : `markEntityForSync('task', task.id)` — offline OK
- Progression en temps réel via barre de progression
- Onglets Infos / Activités / Participants bien organisés

**Problème découvert — suppression de tâche non synchronisable :**
```typescript
// /evenements/[id]/page.tsx ligne 156-161
const deleteTask = async (taskId: string) => {
  // On ne peut pas synchroniser la suppression d'une tâche (pas de mécanisme de tombstone),
  // on la supprime juste localement et on retire de la queue de synchro
  await db.pendingSync.delete(`task:${taskId}`);
  await db.tasks.delete(taskId);
};
```
**Impact** : si un admin supprime une tâche sur son téléphone hors ligne, la suppression ne sera jamais synchronisée. Si un autre moniteur se synchronise après, la tâche réapparaîtra localement. **Incohérence de données garantie.**

**Problème — suppression d'événement non synchronisable :**
```typescript
// handleDelete dans EventDetailPage
await db.tasks.where("eventId").equals(eventId).delete();
await db.events.delete(eventId);
await db.pendingSync.bulkDelete(keysToDelete);
// Pas de markEntityForSync → la suppression ne part jamais au serveur
```
Même problème : la suppression ne part au serveur que si on est en ligne au moment de la navigation (via un reload de la page qui repasserait par le serveur, mais ce n'est pas garanti).

**Problème — accès admin basé sur la session next-auth côté client :**
```typescript
const { data: session } = useSession();
const isAdmin = (session?.user as any)?.role === "ADMIN";
```
Si la session expire offline (31 jours pour le JWT mobile, mais `useSession` côté web), un admin pourrait se retrouver sans les boutons de création/suppression même si son JWT est valide.

### 2.4 `/fichiers` — Problème structurel

Cette page est un **Server Component** avec un appel direct à Prisma :
```typescript
const dbFiles = await prisma.mediaResource.findMany({ ... });
```

**Conséquences :**
1. **Zéro offline** : Si l'utilisateur clique sur "Archives" sans réseau, il atterrit sur `/offline`.
2. **Pas de cache Dexie** pour les médias : si les médias sont des images en base64 (pattern détecté dans `/api/mobile/upload`), elles ne peuvent pas être précachées par le SW (trop volumineuses).
3. **Recherche via URL params** : la recherche recharge la page entière à chaque frappe (paramètre `?q=`). Mauvaise UX sur mobile (clavier qui disparaît).

**Solution envisageable** : passer en Client Component + `useLiveQuery` sur une table Dexie `mediaResources` synchronisée par le protocole sync-v2. Nécessite d'ajouter l'entité dans le protocole.

### 2.5 Layout global — Ce qui manque

```typescript
// layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <RegisterPWA />   ← gère les mises à jour SW uniquement
        <PushNotifier />  ← gère les notifications push
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

**Absent du layout :**
- Aucun bandeau/overlay global de statut offline
- Aucun déclencheur automatique de sync
- Le `SyncPanel` n'est rendu **que** sur la page d'accueil `/` (page.tsx)

---

## 3. Analyse du Service Worker

### Points forts
- Stratégie stale-while-revalidate pour la navigation avec timeout 2.5s → l'app charge depuis le cache si le réseau est lent
- `REFRESH_PRECACHE` : quand `RegisterPWA` détecte la reconnexion (`online` event), il poste `REFRESH_PRECACHE` au SW qui rafraîchit silencieusement les 16 URLs — astucieux
- Gestion des mises à jour SW avec toast de confirmation utilisateur

### Lacunes
- **Pas de Background Sync API** (`registration.sync.register(...)`) : si l'onglet est fermé quand le réseau revient, la sync ne se déclenche jamais
- **Les requêtes POST à `/api/sync` ne sont pas interceptées** : normal (le SW ignore toutes les requêtes `/api/`), mais ça signifie qu'il n'y a pas de file réseau SW-level
- **`/fichiers` n'est pas précachée de manière utile** : le SW précache la coquille HTML, mais le contenu (données Prisma) ne peut pas être précaché
- **Pas de `sync` event** dans le SW → pas de déclenchement de sync en arrière-plan

---

## 4. Analyse du protocole sync-v2

### Points forts
- **Encodage compact** : les patches enfants sont des tableaux positionnels avec codes à 1 lettre. Payload minimal.
- **Delta intelligent** : le serveur retourne uniquement ce que le client ne connaît pas (`updatedAt > lastSyncAt` + `id NOT IN knownIds`)
- **Déduplication côté client ET serveur** : `deduplicateAttendancePatches` côté serveur, gestion des clés `childId:date` côté client
- **Batch limité à 700 Ko et 5 items** : évite de saturer le réseau sur des gros payloads
- **Transaction Prisma 30s/15s** : robuste pour les writes concurrents

### Lacunes
- **Pas de tombstone pour les suppressions** : les suppressions d'événements et de tâches ne se synchronisent pas. Seules les suppressions d'enfants (via noms vides = soft-delete) et les parents (`dp` = deleted parents) sont gérées.
- **`lastSyncAt` stocké dans Dexie `syncState`** : si IndexedDB est purgé (navigateur en mode privé, quota dépassé), toute la sync repart de zéro (full sync). Normal mais à documenter.
- **Pas de versioning de conflit** : last-write-wins. Si deux moniteurs modifient le même enfant en simultané offline, le dernier sync écrase l'autre. Acceptable pour ce cas d'usage mais à mentionner.
- **Boucle `do...while` sans timeout global** dans `handleSync` de `SyncPanel` : si le réseau est intermittent, peut boucler indéfiniment.

---

## 5. Problèmes UX classés et détaillés

### 🔴 P0 — Bloquants UX (à corriger en priorité)

#### P0-1 : Sync entièrement manuelle, FAB uniquement sur `/`
- **Fichiers** : `src/app/page.tsx` (ligne 103), `src/components/system/SyncPanel.tsx`
- **Impact** : Un moniteur peut faire l'appel de 50 enfants offline et repartir sans synchro. Données perdues si l'appareil est remplacé.
- **Fix** : auto-sync à l'event `online` + déplacer `SyncPanel` dans `layout.tsx`

#### P0-2 : Aucun indicateur de statut réseau sur les écrans de saisie
- **Fichiers** : `src/app/pointage/page.tsx`, `src/app/enfants/page.tsx`
- **Impact** : le moniteur ne sait pas s'il est offline. Il peut penser que ses pointages ont été envoyés immédiatement.
- **Fix** : composant `OfflineBanner` dans `layout.tsx` avec `useLiveQuery(getSyncStatus)`

#### P0-3 : `/fichiers` ne fonctionne pas hors ligne
- **Fichier** : `src/app/fichiers/page.tsx`
- **Impact** : une fonctionnalité entière est inaccessible offline alors que l'app est présentée comme offline-first.
- **Fix** : migrer vers Client Component + table Dexie `mediaResources` + sync via protocol `sync-v2` (ajouter entité `m`)

### 🟠 P1 — Importants

#### P1-1 : Suppressions de tâches et événements non synchronisées
- **Fichiers** : `src/app/evenements/[id]/page.tsx` (lignes 156-161, 467-481)
- **Impact** : incohérence de données garantie si suppression offline
- **Fix** : implémenter un mécanisme de tombstone (table `deletedEntities` ou champ `deletedAt`)

#### P1-2 : Boucle de sync sans timeout global
- **Fichier** : `src/components/system/SyncPanel.tsx` (lignes 113-127)
- **Impact** : si réseau intermittent, la boucle peut tenir l'UI bloquée indéfiniment
- **Fix** : ajouter un timeout global (ex: max 3 tentatives ou 60 secondes)

#### P1-3 : `navigator.onLine` non fiable (faux positifs)
- **Fichiers** : `src/components/system/SyncPanel.tsx`, `src/components/system/RegisterPWA.tsx`
- **Impact** : sur Wi-Fi captif ou réseau sans internet, `navigator.onLine === true` mais les requêtes échouent
- **Fix** : validation réseau réelle via `HEAD /api/sync` avec timeout

#### P1-4 : Photo d'enfant — upload impossible offline
- **Fichier** : `src/components/pointage/PointageCard.tsx` (lignes 404-419), `src/components/pointage/utils.ts`
- **Impact** : si offline, le champ `photoUrl` reste vide. L'erreur est affichée via `alert()` (mauvaise UX)
- **Fix** : stocker la photo en base64 localement dans Dexie (déjà partiellement prévu vu `MAX_SYNC_STRING_VALUE_LENGTH = 100_000`), et ne l'uploader que lors de la sync

### 🟡 P2 — Améliorations importantes

#### P2-1 : Aucune distinction visuelle "local vs synchronisé"
- **Fichiers** : `src/app/enfants/page.tsx`, `src/app/evenements/page.tsx`
- Ajouter un micro-indicateur (point orange) sur les fiches/événements présents dans `pendingSync`

#### P2-2 : Feedback de sync trop verbeux et fugace
- **Fichier** : `src/components/system/SyncPanel.tsx` (lignes 130-135)
- Message texte affiché 6s au-dessus du FAB. Trop petit, peu visible, disparaît avant que l'utilisateur puisse le lire
- Fix : toast pleine largeur en bas d'écran, 4s, avec icône

#### P2-3 : Ordre des enfants dans l'annuaire contre-intuitif
- **Fichier** : `src/app/enfants/page.tsx` (ligne 61)
- `orderBy('createdAt').reverse()` : les plus récents en tête. OK pour voir ses ajouts, mais mauvais pour chercher
- Fix : par défaut alphabétique, avec une option "Récents" dans les filtres

#### P2-4 : Swipe trop sensible sur le carrousel
- **Fichier** : `src/app/pointage/page.tsx` (ligne 358)
- Seuil 48px peut déclencher accidentellement un changement de carte
- Fix : augmenter le seuil à 80px ou ajouter une vélocité minimale

#### P2-5 : Session `useSession()` peut expirer côté web (admin sans boutons)
- **Fichiers** : `src/app/evenements/page.tsx`, `src/app/evenements/[id]/page.tsx`
- L'accès admin est conditionné par `useSession()`. Si session expirée, les boutons admin disparaissent
- Fix : vérifier également via le token local stocké dans localStorage/sessionStorage

### 🟢 P3 — Confort et polish

#### P3-1 : Recherche dans `/fichiers` recharge la page entière
- Migrer `/fichiers` vers Client Component résout ce problème

#### P3-2 : Pas de retry automatique avec backoff après échec réseau
- Après un échec de sync, ne pas laisser l'utilisateur sans feedback pendant plusieurs minutes
- Fix : retry à 10s, 30s, 2min

#### P3-3 : Pas de Background Sync SW
- `registration.sync.register('goshen-sync')` permettrait la sync même si l'onglet est fermé
- Pertinent si des moniteurs oublient régulièrement de synchro avant de fermer l'appli

---

## 6. Architecture cible recommandée

### 6.1 Nouveau composant `OfflineBanner` dans `layout.tsx`

```tsx
// src/components/system/OfflineBanner.tsx
"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { getSyncStatus } from "@/lib/db";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncState, setSyncState] = useState<"idle"|"syncing"|"done"|"error">("idle");
  const syncStatus = useLiveQuery(() => getSyncStatus(), []);
  const pending = syncStatus?.pendingChanges ?? 0;

  // Écouter online/offline
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  if (isOnline && pending === 0 && syncState === "idle") return null; // Tout va bien, rien à afficher

  const bgColor = !isOnline
    ? "bg-amber-500"
    : syncState === "syncing" ? "bg-blue-500"
    : syncState === "done" ? "bg-green-500"
    : syncState === "error" ? "bg-red-500"
    : "bg-amber-500";

  const message = !isOnline
    ? `📡 Hors ligne${pending > 0 ? ` — ${pending} modification${pending > 1 ? "s" : ""} en attente` : ""}`
    : syncState === "syncing" ? "🔄 Synchronisation en cours…"
    : syncState === "done" ? "✅ Tout est à jour"
    : syncState === "error" ? "⚠️ Échec de sync — Réessai en cours…"
    : `⏳ ${pending} modification${pending > 1 ? "s" : ""} à envoyer…`;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] py-2 px-4 text-center text-xs font-bold text-white ${bgColor} transition-all`}>
      {message}
    </div>
  );
}
```

### 6.2 Hook `useAutoSync` centralisé

```typescript
// src/hooks/useAutoSync.ts
import { useEffect, useRef } from "react";
import db, { syncWithServer } from "@/lib/db";

async function isNetworkReachable(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch("/api/sync", { method: "HEAD", signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    return res.ok || res.status < 500;
  } catch { return false; }
}

export function useAutoSync(onSyncStart?: () => void, onSyncEnd?: (success: boolean) => void) {
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const attemptSync = async (attempt = 1) => {
    const pending = await db.pendingSync.count();
    if (pending === 0) return;

    const reachable = await isNetworkReachable();
    if (!reachable) {
      const delay = Math.min(10_000 * Math.pow(2, attempt - 1), 120_000);
      retryRef.current = setTimeout(() => attemptSync(attempt + 1), delay);
      return;
    }

    onSyncStart?.();
    const result = await syncWithServer();
    onSyncEnd?.(result.success);

    if (!result.success && attempt < 5) {
      const delay = Math.min(10_000 * Math.pow(2, attempt), 120_000);
      retryRef.current = setTimeout(() => attemptSync(attempt + 1), delay);
    }
  };

  useEffect(() => {
    const handleOnline = async () => {
      // Délai de stabilisation réseau
      await new Promise(r => setTimeout(r, 1500));
      attemptSync();
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);
}
```

### 6.3 Migration `/fichiers` vers offline-first

**Étape 1** : Ajouter l'entité `MediaResource` à Dexie :
```typescript
// db.ts — version 12
db.version(12).stores({
  // ... existant ...
  mediaResources: "id, type, createdAt",
});
```

**Étape 2** : Ajouter `mr` (mediaResources) au protocole sync-v2 :
- Côté serveur (`/api/sync`) : retourner `mr: serverMediaResources.map(compactMedia)`
- Côté client (`db.ts`) : `applyServerDelta` upsert dans `db.mediaResources`

**Étape 3** : Convertir `/fichiers/page.tsx` en Client Component avec `useLiveQuery`.

**Attention** : les images en base64 encodées dans `url` sont potentiellement très lourdes. La sync initiale avec des dizaines d'images pourrait dépasser la limite de 700 Ko par batch. Recommandation : stocker uniquement les métadonnées (titre, type, thumbnail, aspectRatio), et charger les URLs depuis le réseau à la demande.

### 6.4 Tombstone pour les suppressions

Ajouter une table `deletedEntities` à Dexie et une route côté sync :

```typescript
// db.ts
export interface DeletedEntity {
  key: string; // "event:uuid" ou "task:uuid"
  entity: "event" | "task";
  id: string;
  deletedAt: string;
}
// db.version(13).stores({ ..., deletedEntities: "key, entity, deletedAt" })
```

Et dans le protocole sync-v2, ajouter un champ `del` (deletions) avec les IDs à supprimer côté serveur.

---

## 7. Flux UX complet cible

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ÉTAT OFFLINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Bandeau ambre (fixé en haut, z-100) :
 "📡 Hors ligne — 3 modifications en attente"

 Le moniteur fait l'appel normalement :
  → Dexie écrit instantanément
  → markEntityForSync() met à jour pendingSync
  → Le bandeau se met à jour : "…4 modifications…"
  → Micro-point orange sur les cartes modifiées

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 RETOUR RÉSEAU DÉTECTÉ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 event 'online' reçu
   → attendre 1500ms (stabilisation réseau)
   → HEAD /api/sync (timeout 4s)
   → Si KO → retry dans 10s, 30s, 2min…
   → Si OK → déclencher syncWithServer()

 Bandeau bleu : "🔄 Synchronisation en cours…"
 FAB spinner (si visible)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SYNC RÉUSSIE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Toast bas : "✅ 12 pointages envoyés · 3 enfants mis à jour"
 Bandeau vert 3s : "✅ Tout est à jour" → disparaît
 Points orange sur les cartes disparaissent
 Badge FAB disparaît

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SYNC ÉCHOUÉE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Bandeau rouge 5s : "⚠️ Échec de sync — Réessai dans 30s"
 Retry automatique avec backoff exponentiel
 FAB toujours dispo pour forcer manuellement
```

---

## 8. Résumé des priorités pour Codex

| Priorité | Action | Fichiers à modifier |
|---|---|---|
| **P0** | Auto-sync à la reconnexion réseau | `layout.tsx`, nouveau `useAutoSync.ts` |
| **P0** | Bandeau offline global dans layout | `layout.tsx`, nouveau `OfflineBanner.tsx` |
| **P0** | Migrer `/fichiers` vers Client Component + Dexie | `fichiers/page.tsx`, `db.ts`, `api/sync/route.ts` |
| **P1** | Tombstone pour suppressions tâches/événements | `db.ts`, `api/sync/route.ts`, `evenements/[id]/page.tsx` |
| **P1** | Validation réseau réelle (HEAD ping) | `useAutoSync.ts` |
| **P1** | Timeout global sur la boucle de sync | `SyncPanel.tsx` |
| **P1** | Photo offline (base64 → Dexie → upload lors sync) | `PointageCard.tsx`, `db.ts`, `utils.ts` |
| **P2** | Indicateur "en attente" sur les fiches | `enfants/page.tsx`, `evenements/page.tsx` |
| **P2** | Toast de résultat de sync | `SyncPanel.tsx` ou `OfflineBanner.tsx` |
| **P2** | Ordre alphabétique par défaut dans annuaire | `enfants/page.tsx` |
| **P2** | Retry avec backoff exponentiel | `useAutoSync.ts` |
| **P3** | Background Sync API dans le SW | `public/sw.js` |
| **P3** | FAB sync accessible depuis tous les écrans | `layout.tsx` |

---

## 9. Questions ouvertes pour Codex

1. **`/fichiers` base64 dans Dexie** : les médias stockés en base64 dans Prisma (`url = "data:image/..."`) sont potentiellement énormes. Faut-il les exclure de la sync mobile et afficher une page "connexion requise" uniquement pour les médias lourds ? Ou implémenter une pagination de la sync médias ?

2. **Background Sync API** : le SW a déjà un handler `REFRESH_PRECACHE`. Peut-on y ajouter un handler `sync` pour déclencher `syncWithServer()` même onglet fermé ? Le défi est que `syncWithServer()` accède à Dexie (IndexedDB) depuis le contexte SW, ce qui est possible mais nécessite un import séparé.

3. **Conflit de sync** : deux moniteurs pointent le même enfant différemment (l'un marque "PRESENT", l'autre "ABSENT" pour le même dimanche). Le serveur applique le dernier arrivé. Est-ce acceptable ? Ou faut-il un mécanisme de résolution (ex: favoriser PRESENT sur ABSENT) ?

4. **Quota IndexedDB** : sur Android bas de gamme, le quota peut être aussi bas que 50 Mo. Avec des centaines d'enfants + photos base64 + historique d'attendance, le risque de quota exceeded est réel. Y a-t-il une stratégie de purge progressive ou une alerte quota ?

5. **`useSession()` vs localStorage pour le rôle admin** : en production, les boutons admin disparaissent si la session next-auth expire (même si l'utilisateur a un JWT Bearer valide). Faut-il dupliquer le rôle dans localStorage pour les décisions UI offline ?
