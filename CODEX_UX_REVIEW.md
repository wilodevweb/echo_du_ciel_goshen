# Revue UX Mobile — Echo du Ciel Goshen
> Document destiné à Codex pour analyse et propositions d'amélioration UX.
> Priorité absolue : expérience **offline-first** avec sync automatique à la détection réseau.

---

## 1. Contexte et objectif

L'application est une **PWA Next.js 16** utilisée par des moniteurs d'école du dimanche, principalement sur téléphone en zone à connexion instable (Congo). Elle doit fonctionner **100 % hors ligne** et remonter automatiquement les données dès qu'un réseau est détecté.

L'architecture backend repose sur **Next.js App Router + Prisma + Turso/SQLite**. Le côté client utilise **Dexie.js (IndexedDB)** comme base de données locale, avec un système de file de synchronisation (`pendingSync`) et un protocole compact de delta-sync bidirectionnel (mode `sync-v2`).

---

## 2. Architecture actuelle — ce qui existe

### 2.1 Couche de données offline (Dexie — `src/lib/db.ts`)

| Table Dexie | Rôle |
|---|---|
| `children` | Annuaire complet des enfants (répliqué) |
| `parents` | Annuaire des parents (répliqué) |
| `attendances` | Pointages (répliqués, fenêtre glissante) |
| `events` | Événements (créés et sync bidirectionnelle) |
| `tasks` | Tâches par événement×enfant (sync bidirectionnelle) |
| `pendingSync` | **File de mutation** — `{entity, id, fields, updatedAt}` |
| `syncState` | `lastSyncAt`, `lastLocalChangeAt` |

**Encodage compact** : toutes les entités sont sérialisées en tableaux positionnels (`CompactChildPatch`, `CompactAttendancePatch`, etc.) avec des codes courts (`f`=firstName, `l`=lastName, `p`=présent…) pour minimiser la bande passante.

**Déclenchement de la sync** :
- Actuellement **100 % manuel** : un bouton FAB `<SyncPanel>` en bas à droite de l'écran d'accueil.
- Le badge rouge affiche le nombre de mutations en attente.
- Le bouton est grisé quand `navigator.onLine === false`.

### 2.2 API de synchronisation (`src/app/api/sync/route.ts`)

- Route unique `POST /api/sync` — accepte `mode: 'sync-v2'`.
- Reçoit : patches enfants (`c`), présences (`a`), événements (`e`), tâches (`t`), parents à supprimer (`dp`), `lastSyncAt` (`l`).
- Applique en **transaction Prisma** (timeout 30 s, maxWait 15 s).
- Retourne le delta serveur (ce que le client ne connaît pas encore).
- Auth : session cookie **ou** token Bearer JWT mobile (double path).

### 2.3 API mobile dédiée

| Route | Méthode | Rôle |
|---|---|---|
| `POST /api/mobile/session` | POST | Auth Bearer — retourne JWT 30 jours |
| `GET /api/mobile/resources` | GET | Liste des médias (images, vidéos, PDFs) |
| `POST /api/mobile/upload` | POST | Upload admin (multipart/form-data) |
| `GET/POST /api/mobile/admin` | GET+POST | Lecture comptes+logs / création+toggle-block |

### 2.4 Interface web actuelle

**Page d'accueil** (`src/app/page.tsx`) :
- Logo centré + titre.
- Bouton principal vert « Faire l'appel » (`/pointage`).
- 2 boutons secondaires : Annuaire (`/enfants`) et Archives (`/fichiers`).
- Boutons flottants haut-droite : Famille, Événements, Notifications, Admin (si ADMIN).
- FAB sync bas-droite (badge rouge si mutations en attente).

**Dashboard admin** (`/dashboard`) : 3 onglets — Moniteurs, Suivi d'activités, Upload.

---

## 3. Points forts actuels

1. **Protocole compact et efficace** — les patches binaires réduisent drastiquement la taille des payloads réseau. Bon pour les connexions lentes.
2. **Transactions Dexie robustes** — `applyServerDelta` est atomique et gère les purges, conflits d'ID locaux/serveur, et cascades.
3. **Déduplication côté client et serveur** — les clés `childId:date` évitent les doublons de pointage.
4. **Batching intelligent** — `buildSyncBatch` respecte une limite de 700 Ko par cycle et bascule en mode unitaire si un item dépasse seul la limite.
5. **Double auth** — cookies (web) et Bearer JWT (mobile natif potentiel) sur la même route `/api/sync`.

---

## 4. Problèmes UX identifiés

### 4.1 🔴 Critique — Sync entièrement manuelle
La synchronisation ne se déclenche **jamais automatiquement**. Un moniteur qui revient en zone réseau après avoir fait l'appel hors ligne doit penser à appuyer sur le bouton FAB. S'il oublie, les données restent bloquées localement.

**Impact** : perte de données silencieuse. Priorité maximale.

### 4.2 🔴 Critique — Aucun signal offline visible sur les écrans de saisie
Quand un moniteur fait l'appel, rien ne lui indique s'il est hors ligne. Il ne sait pas si son pointage est sauvegardé localement ou directement envoyé. Il peut abandonner l'action par peur de perdre des données.

### 4.3 🟠 Majeur — FAB de sync isolé sur la page d'accueil uniquement
Le FAB `<SyncPanel>` n'est rendu que sur `/` (page d'accueil). Si un moniteur est sur `/pointage` et revient en ligne, il doit naviguer vers l'accueil pour déclencher la sync. Friction inutile.

### 4.4 🟠 Majeur — Feedback de sync trop verbeux et fugace
Le message de confirmation (`X enfants / Y pointages récupérés, Z enfants / W pointages envoyés`) dure 6 secondes puis disparaît. Il est affiché dans une petite bulle au-dessus du FAB que l'utilisateur peut ne pas voir.

### 4.5 🟡 Mineur — Badge de mutations seulement sur la page d'accueil
Le badge rouge sur le FAB est le seul indicateur de mutations en attente. Un moniteur sur `/pointage` ou `/enfants` ne voit pas cet état.

### 4.6 🟡 Mineur — Pas de distinction visuelle entre "sauvegardé localement" et "synchronisé avec le serveur"
Un enfant nouvellement créé offline et un enfant déjà synchro ont exactement la même apparence dans l'annuaire.

### 4.7 🟡 Mineur — Sync en boucle `do…while` — risque de blocage UI
`handleSync` boucle jusqu'à `pendingChanges === 0` sans timeout global. Si la connexion est intermittente, la boucle peut se retrouver dans un état partiellement synchro indéfiniment.

---

## 5. Propositions d'amélioration prioritaires

### 5.1 ✅ Auto-sync à la détection réseau (priorité 1)

Ajouter dans `<SyncPanel>` (ou un nouveau hook `useAutoSync`) :

```typescript
// Pseudo-code
useEffect(() => {
  const handleOnline = async () => {
    setIsOnline(true);
    // Délai court pour laisser le réseau se stabiliser
    await new Promise(r => setTimeout(r, 1500));
    const pending = await db.pendingSync.count();
    if (pending > 0) {
      triggerSync(); // déclenche handleSync sans intervention utilisateur
    }
  };
  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}, []);
```

Le délai de 1,5 s est important : `navigator.onLine` peut basculer `true` avant que le réseau soit réellement joignable (cas fréquent sur Android avec Wi-Fi captif).

**Validation réseau recommandée** : tenter un `HEAD /api/sync` avec timeout court avant de lancer le vrai sync. Si ça échoue, attendre l'événement `online` suivant.

### 5.2 ✅ Bandeau offline persistant sur tous les écrans (priorité 1)

Ajouter dans `src/app/layout.tsx` un `<OfflineBanner>` global :

```
┌──────────────────────────────────────────────┐
│  📡 Hors ligne — X modification(s) en attente │
└──────────────────────────────────────────────┘
```

- Affiché en haut de l'écran, couleur ambre/orange.
- Disparaît automatiquement quand `isOnline === true && pendingChanges === 0`.
- Quand la connexion revient + sync en cours : `🔄 Synchronisation en cours…` en vert.
- Quand la sync réussit : `✅ Tout est à jour` pendant 3 s.

Ce composant doit utiliser `useLiveQuery(getSyncStatus)` et l'état `navigator.onLine`.

### 5.3 ✅ Indicateurs "en attente" sur les fiches (priorité 2)

Dans `<ChildAttendanceCard>` et dans la fiche enfant de l'annuaire, ajouter un micro-indicateur discret si l'entité est dans `pendingSync` :

```
● non synchronisé  (petit point orange, tooltip au tap)
```

Cela se fait avec un `useLiveQuery` ciblé :
```typescript
const isPending = useLiveQuery(
  () => db.pendingSync.get(`child:${child.id}`),
  [child.id]
);
```

### 5.4 ✅ Toast de sync non-bloquant avec résumé (priorité 2)

Remplacer le message textuel fugace par un toast positionné en bas de l'écran, visible 4 s, avec icône et texte concis :

```
✅  12 pointages envoyés · 3 enfants mis à jour
```

Si erreur :
```
⚠️  Sync partielle — Réessai dans 30 s
```

### 5.5 ✅ Retry automatique avec backoff exponentiel (priorité 2)

En cas d'échec réseau lors de la sync auto, implémenter un retry avec backoff :

```
Tentative 1 → échec → attendre 10 s
Tentative 2 → échec → attendre 30 s
Tentative 3 → échec → attendre 2 min
... jusqu'à la prochaine détection `online`
```

Éviter de saturer un réseau instable.

### 5.6 ✅ FAB sync accessible depuis tous les écrans (priorité 3)

Déplacer `<SyncPanel>` de `page.tsx` vers `layout.tsx` (avec un z-index élevé). Il sera visible sur tous les écrans sans duplication de logique.

Attention : s'assurer que le FAB ne masque pas les boutons d'action principaux sur les pages de saisie (pointage). Utiliser `bottom-20` sur les pages avec navigation en bas, `bottom-6` ailleurs.

### 5.7 ✅ Validation réseau réelle avant sync (priorité 3)

`navigator.onLine` est notoire pour retourner `true` même sans réseau (captive portals, Wi-Fi sans internet). Ajouter une vérification concrète :

```typescript
async function isNetworkReachable(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch('/api/sync', {
      method: 'HEAD',
      signal: ctrl.signal,
      cache: 'no-store',
    });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}
```

---

## 6. Architecture recommandée — hook `useNetworkSync`

Centraliser toute la logique dans un hook réutilisable :

```typescript
// src/hooks/useNetworkSync.ts
export function useNetworkSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState<'idle'|'syncing'|'success'|'error'>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const pendingChanges = useLiveQuery(() => db.pendingSync.count(), []);

  // Auto-sync à la reconnexion
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attemptSync = async (attempt = 1) => {
      if (!(await isNetworkReachable())) {
        const delay = Math.min(10_000 * Math.pow(2, attempt - 1), 120_000);
        retryTimer = setTimeout(() => attemptSync(attempt + 1), delay);
        return;
      }
      setSyncState('syncing');
      const result = await syncWithServer();
      setSyncState(result.success ? 'success' : 'error');
      if (!result.success && attempt < 5) {
        const delay = Math.min(10_000 * Math.pow(2, attempt), 120_000);
        retryTimer = setTimeout(() => attemptSync(attempt + 1), delay);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      db.pendingSync.count().then(count => { if (count > 0) attemptSync(); });
    };
    const handleOffline = () => { setIsOnline(false); if (retryTimer) clearTimeout(retryTimer); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  return { isOnline, syncState, pendingCount: pendingChanges ?? 0, triggerSync };
}
```

---

## 7. UX recommandée — flux complet

```
[Hors ligne]
  Moniteur fait l'appel →
  Données sauvegardées dans Dexie (IndexedDB) →
  Badge rouge sur FAB (+N) →
  Bandeau ambre : "📡 Hors ligne — N modification(s) en attente"

[Retour réseau détecté]
  event 'online' →
  Vérification réseau réelle (HEAD /api/sync, timeout 4s) →
  Si OK : auto-sync déclenché après 1.5s de stabilisation →
  Bandeau vert : "🔄 Synchronisation en cours…"
  Badge sur FAB tourne (spinner)

[Sync réussie]
  Toast bas : "✅ 12 pointages envoyés · 3 enfants mis à jour"
  Bandeau disparaît (isOnline && pendingCount === 0)
  Badge FAB disparaît

[Sync échouée]
  Toast bas : "⚠️ Sync partielle — Réessai dans 30 s"
  Retry automatique avec backoff
  Le moniteur peut aussi forcer manuellement via le FAB
```

---

## 8. Questions ouvertes pour Codex

1. **Service Worker** : le `public/sw.js` existe. Est-il configuré pour mettre en cache les assets statiques ? Peut-on brancher la détection de la reconnexion réseau directement dans le SW (via `sync` Background Sync API) plutôt que dans l'event listener JS ? Cela fonctionnerait même si l'onglet est en arrière-plan ou fermé.

2. **Background Sync API** : `navigator.serviceWorker.ready.then(reg => reg.sync.register('sync-data'))` permettrait de déclencher la sync même après fermeture de l'onglet. Pertinent ici ?

3. **Conflit de sync** : si deux moniteurs modifient le même enfant hors ligne, le serveur applique le dernier arrivé (last-write-wins). Est-ce acceptable ? Une stratégie de merge par champ (le serveur a déjà `fields` dans le patch compact) serait-elle nécessaire ?

4. **Optimistic UI** : les pointages et modifications d'enfants sont-ils affichés immédiatement dans l'UI sans attendre la confirmation serveur ? (Ils devraient l'être, via `useLiveQuery` sur Dexie — à vérifier sur chaque écran.)

5. **Fenêtre de rétention** : les présences antérieures à `SYNC_ATTENDANCE_MIN_DATE` sont purgées automatiquement. Cette fenêtre est-elle configurable ou codée en dur ? Peut-on l'exposer comme constante d'environnement ?

6. **Performance de `pendingSync`** : la table `pendingSync` est lue à chaque render via `useLiveQuery`. Si elle contient des centaines d'items (bug, connexion coupée longtemps), cela peut-il poser un problème de performance ?

---

## 9. Résumé des priorités pour Codex

| Priorité | Action | Fichiers concernés |
|---|---|---|
| P0 — Bloquant UX | Auto-sync à la reconnexion réseau | `db.ts`, `SyncPanel.tsx` ou nouveau hook |
| P0 — Bloquant UX | Bandeau offline global dans le layout | `layout.tsx`, nouveau `OfflineBanner.tsx` |
| P1 — Important | Validation réseau réelle (HEAD ping) avant sync | `db.ts` ou hook |
| P1 — Important | Retry avec backoff exponentiel | hook `useNetworkSync` |
| P2 — Amélioration | Indicateur "en attente" sur les fiches enfants | `ChildAttendanceCard.tsx`, annuaire |
| P2 — Amélioration | Toast de résultat de sync non-bloquant | `SyncPanel.tsx` |
| P3 — Confort | FAB accessible depuis tous les écrans | `layout.tsx` |
| P3 — Confort | Distinction visuelle local vs synchronisé | annuaire, pointage |
